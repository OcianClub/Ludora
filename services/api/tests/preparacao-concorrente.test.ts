import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { criarCompartilhadasRoutes } from '../src/modules/partidas/compartilhadas.routes';
import { transacao } from '../src/modules/partidas/compartilhadas.service';

test('equipes preparam simultaneamente com versões independentes; conflito real preserva a própria escalação', async t => {
  const equipes = [1, 2].map(id => ({ id, clube_id: id, time_id: id * 10, categoria_id: id + 20, versao: 0, pronta: false, publicada_em: null as Date | null, clube: { id, nome: `Clube ${id}` } }));
  const p: any = { id: 1, versao: 10, status: 'AGENDADA', data: new Date('2026-11-16'), horario: '19:30', periodo_atual: 2, organizador_id: 1, sumula_clube_id: 1, titulares_necessarios: 5, categoria: { clube_id: 1 }, participantes: equipes, mandante_id: 10, visitante_id: 20, mandante: { clube_representado_id: 1 }, visitante: { clube_representado_id: 2 } };
  const jogadores = equipes.flatMap(e => Array.from({ length: 6 }, (_, i) => ({ id: e.clube_id * 100 + i, nome: `Atleta ${e.clube_id}-${i}`, categoria_id: e.categoria_id, ativo: true, numCamisa: i + 1, posicao: i === 0 ? 'Goleiro' : 'Fixo' })));
  let rows: any[] = [], role = 'ADMIN', retryOnce = true, retries = 0;
  const audits: any[] = [], emissions: any[] = [];
  const patch = (object: any, key: string, value: any) => { const old = object[key]; object[key] = value; t.after(() => { object[key] = old; }); };
  patch(prisma.partida, 'findUnique', async () => structuredClone(p));
  patch(prisma.partida, 'findUniqueOrThrow', async () => structuredClone(p));
  patch(prisma.partida, 'updateMany', async ({ where }: any) => { if (where.versao !== p.versao) return { count: 0 }; p.versao++; return { count: 1 }; });
  patch(prisma.partida, 'update', async ({ data }: any) => Object.assign(p, data));
  patch(prisma.usuarioClube, 'findUnique', async () => ({ papel: role, categorias: [] }));
  patch(prisma.participantePartida, 'update', async ({ where, data }: any) => { const e = equipes.find(e => e.id === where.id)!; const { versao, ...values } = data; Object.assign(e, values); if (versao?.increment) e.versao += versao.increment; return e; });
  patch(prisma.participantePartida, 'count', async () => equipes.filter(e => !e.pronta).length);
  patch(prisma.jogador, 'findMany', async ({ where }: any) => jogadores.filter(j => where.id.in.includes(j.id) && j.categoria_id === where.categoria_id));
  patch(prisma.escalacaoPartida, 'deleteMany', async ({ where }: any) => { rows = rows.filter(r => r.time_id !== where.time_id); });
  patch(prisma.escalacaoPartida, 'createMany', async ({ data }: any) => { rows.push(...data.map((r: any) => ({ ...r, jogador: jogadores.find(j => j.id === r.jogador_id) }))); });
  patch(prisma.escalacaoPartida, 'findMany', async ({ where }: any) => rows.filter(r => typeof where.time_id === 'number' ? r.time_id === where.time_id : where.time_id.in.includes(r.time_id)));
  patch(prisma.evento, 'findMany', async () => []);
  patch(prisma.auditoriaPartida, 'create', async ({ data }: any) => { audits.push({ id: audits.length + 1, criado_em: new Date(), ...data }); });
  patch(prisma.auditoriaPartida, 'findMany', async ({ where }: any) => audits.filter(a => !where.acao || a.acao === where.acao));
  let queue: Promise<unknown> = Promise.resolve();
  patch(prisma, '$transaction', (fn: any) => {
    const result = queue.then(async () => {
      if (retryOnce) { retryOnce = false; retries++; throw new Prisma.PrismaClientKnownRequestError('serialization failure', { code: 'P2034', clientVersion: 'test' }); }
      return fn(prisma);
    });
    queue = result.catch(() => {}); return result;
  });
  const io = { to: (room: string) => ({ emit: (event: string, data: unknown) => emissions.push({ room, event, data }) }), of: () => ({ to: () => ({ emit() {} }) }) };
  const router = criarCompartilhadasRoutes(io as any);
  async function call(method: string, path: string, club: number, body: object = {}) {
    const route = (router as any).stack.find((l: any) => l.route?.path === path && l.route.methods[method]).route;
    let status = 200, result: any; const res = { status(n: number) { status = n; return res; }, json(value: any) { result = value; return res; } };
    await route.stack.at(-1).handle({ usuarioId: club, clubeId: club, params: { id: '1' }, body }, res); return { status, result };
  }
  const body = (club: number, versao_equipe = 0) => ({ versao: 10, versao_equipe, jogadores: jogadores.filter(j => j.categoria_id === club + 20).map((j, i) => ({ jogador_id: j.id, numCamisa: j.numCamisa, titular: i < 5 })) });
  const salvos = await Promise.all([call('put', '/partidas/:id/escalacao', 1, body(1)), call('put', '/partidas/:id/escalacao', 2, body(2))]);
  assert.deepEqual(salvos.map(r => r.status), [200, 200]); assert.equal(retries, 1);
  assert.equal(rows.length, 12); assert.deepEqual(equipes.map(e => e.versao), [1, 1]); assert.equal(p.versao, 12);
  assert.equal(audits.filter(a => a.acao === 'ESCALACAO_SALVA').length, 2, 'retry does not duplicate committed actions');
  const confirmados = await Promise.all([call('post', '/partidas/:id/preparacao', 1, { versao: 10, versao_equipe: 1 }), call('post', '/partidas/:id/preparacao', 2, { versao: 10, versao_equipe: 1 })]);
  assert.deepEqual(confirmados.map(r => r.status), [200, 200]); assert.equal(p.status, 'PREPARADA'); assert.deepEqual(equipes.map(e => e.versao), [2, 2]);
  const antes = structuredClone(rows), versao = p.versao;
  assert.equal((await call('put', '/partidas/:id/escalacao', 1, body(1, 1))).status, 409);
  assert.equal((await call('post', '/partidas/:id/preparacao', 1, { versao_equipe: 1 })).status, 409);
  assert.deepEqual(rows, antes); assert.equal(p.versao, versao);
  assert.ok(emissions.some(e => e.room === 'clube:1' && e.event === 'partida_atualizada'));
  assert.ok(emissions.some(e => e.room === 'clube:2' && e.event === 'partida_atualizada'));

  p.status = 'AO_VIVO'; role = 'TORCEDOR';
  audits.push({ id: 50, acao: 'SUBSTITUICAO', criado_em: new Date('2026-11-16T22:10:00Z'), usuario_id: 999, dados: { time_id: 10, sai: 101, entra: 105, periodo: 2, request_id: 'segredo-interno', assinatura: 'nao-publicar' } });
  const publico = await call('get', '/partidas/:id/gestao', 2);
  assert.equal(publico.status, 200); assert.deepEqual(publico.result.auditoria, []);
  assert.equal(publico.result.substituicoes.length, 1);
  assert.deepEqual(publico.result.substituicoes[0].sai, { nome: 'Atleta 1-1', numCamisa: 2 });
  assert.deepEqual(publico.result.substituicoes[0].entra, { nome: 'Atleta 1-5', numCamisa: 6 });
  assert.equal(JSON.stringify(publico.result).includes('segredo-interno'), false);
  assert.equal(JSON.stringify(publico.result.substituicoes).includes('usuario_id'), false);
});

test('nova tentativa da preparação é limitada e não repete erros de unicidade ou fluxos sem autorização de retry', async t => {
  const original = prisma.$transaction; t.after(() => { prisma.$transaction = original; });
  let calls = 0, code = 'P2034';
  (prisma as any).$transaction = async () => { calls++; throw new Prisma.PrismaClientKnownRequestError('conflict', { code, clientVersion: 'test' }); };
  await assert.rejects(transacao(async () => true, true), /Outro usuário/); assert.equal(calls, 3);
  code = 'P2002'; calls = 0;
  await assert.rejects(transacao(async () => true, true), /Outro usuário/); assert.equal(calls, 1);
  code = 'P2034'; calls = 0;
  await assert.rejects(transacao(async () => true), /Outro usuário/); assert.equal(calls, 1);
});
