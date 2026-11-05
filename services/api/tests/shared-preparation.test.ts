import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prisma } from '../src/lib/prisma';
import { criarCompartilhadasRoutes } from '../src/modules/partidas/compartilhadas.routes';
import { validarEquipe } from '../src/modules/partidas/compartilhadas.service';

test('preparação: consultas paralelas, privacidade e numeração atualizada', async t => {
  const own = { id: 1, clube_id: 2, categoria_id: 7, time_id: 10, publicada_em: null as Date | null, clube: { id: 2, nome: 'Ocian' } };
  const opponent = { id: 2, clube_id: 3, categoria_id: 8, time_id: 20, publicada_em: null as Date | null, clube: { id: 3, nome: 'Santos' } };
  const p: any = { id: 1, versao: 0, status: 'AGENDADA', organizador_id: 2, sumula_clube_id: 2,
    titulares_necessarios: 5, categoria: { clube_id: 2 }, participantes: [own, opponent],
    mandante: { clube_representado_id: 2 }, visitante: { clube_representado_id: 3 } };
  let role = 'ADMIN';
  let gate: Promise<void> = Promise.resolve();
  const started: string[] = [];
  const filters: number[][] = [];
  let organizerReads = 0;
  const players = Array.from({ length: 6 }, (_, i) => ({ id: i + 100, numCamisa: i + 1 }));
  let lineup: any[] = players.map((j, i) => ({ jogador_id: j.id, numCamisa: j.numCamisa, titular: i < 5,
    jogador: { numCamisa: j.numCamisa, ativo: true, categoria_id: 7 } }));
  let writes = 0;
  function replace(target: any, name: string, value: any) {
    const old = target[name]; target[name] = value; t.after(() => { target[name] = old; });
  }
  replace(prisma.partida, 'findUnique', async () => p);
  replace(prisma.usuarioClube, 'findUnique', async () => ({ papel: role, categorias: [] }));
  replace(prisma.clube, 'findUnique', async () => { organizerReads++; return own.clube; });
  replace(prisma.escalacaoPartida, 'findMany', async ({ where }: any) => {
    if (!where.time_id?.in) return lineup;
    started.push('escalacao'); filters.push(where.time_id.in); await gate;
    return [10, 20].filter(id => where.time_id.in.includes(id)).map(time_id => ({ time_id, jogador_id: time_id }));
  });
  replace(prisma.evento, 'findMany', async () => { started.push('eventos'); await gate; return []; });
  replace(prisma.auditoriaPartida, 'findMany', async () => { started.push('auditoria'); await gate; return []; });
  replace(prisma, '$transaction', async (callback: any) => callback(prisma));
  replace(prisma.jogador, 'findMany', async () => players);
  replace(prisma.partida, 'updateMany', async () => { writes++; return { count: 1 }; });
  replace(prisma.escalacaoPartida, 'deleteMany', async () => { writes++; });
  replace(prisma.escalacaoPartida, 'createMany', async () => { writes++; });
  replace(prisma.participantePartida, 'update', async () => { writes++; });
  replace(prisma.auditoriaPartida, 'create', async () => { writes++; });
  const router = criarCompartilhadasRoutes({} as any);
  async function call(method: string, path: string, body = {}, club = 2) {
    const route = (router as any).stack.find((l: any) => l.route?.path === path && l.route.methods[method]).route;
    let status = 200, result: any;
    const res = { status(n: number) { status = n; return res; }, json(value: any) { result = value; } };
    await route.stack.at(-1).handle({ usuarioId: 1, clubeId: club, params: { id: '1' }, body }, res);
    return { status, result };
  }
  await t.test('leituras independentes começam juntas e o organizador não é consultado novamente', async () => {
    let release!: () => void;
    gate = new Promise<void>(resolve => { release = resolve; });
    const pending = call('get', '/partidas/:id/gestao');
    try {
      await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual(started.sort(), ['auditoria', 'escalacao', 'eventos']);
    } finally { release(); }
    const { status, result } = await pending;
    assert.equal(status, 200);
    assert.equal(organizerReads, 0);
    assert.deepEqual(filters.at(-1), [10]);
    assert.equal(result.equipes[0].escalacao.length, 1);
    assert.equal(result.equipes[1].escalacao.length, 0);
  });
  await t.test('visitante vê somente escalação publicada e clube estranho não lê a partida', async () => {
    role = 'TORCEDOR';
    const count = filters.length;
    const privateResult = await call('get', '/partidas/:id/gestao');
    assert.equal(privateResult.result.podePreparar, false);
    assert.equal(filters.length, count);
    opponent.publicada_em = new Date();
    const published = await call('get', '/partidas/:id/gestao');
    assert.deepEqual(filters.at(-1), [20]);
    assert.equal(published.result.equipes[1].escalacao.length, 1);
    assert.equal(published.result.equipes[0].escalacao.length, 0);
    const before = filters.length;
    assert.equal((await call('get', '/partidas/:id/gestao', {}, 99)).status, 404);
    assert.equal(filters.length, before);
    role = 'ADMIN';
  });
  await t.test('salvar rejeita camisa antiga antes de qualquer escrita e aceita a numeração atual', async () => {
    const rows = players.map((j, i) => ({ jogador_id: j.id, numCamisa: j.numCamisa, titular: i < 5 }));
    const invalid = rows.map((j, i) => i ? j : { ...j, numCamisa: 90 });
    const rejected = await call('put', '/partidas/:id/escalacao', { jogadores: invalid, versao: 0 });
    assert.equal(rejected.status, 409);
    assert.match(rejected.result.error, /numeração do elenco mudou/);
    assert.equal(writes, 0);
    assert.equal((await call('put', '/partidas/:id/escalacao', { jogadores: rows, versao: 0 })).status, 200);
    assert.equal(writes, 5);
  });
  await t.test('confirmar exige cinco titulares e camisas atuais, inclusive na reserva', async () => {
    await validarEquipe(prisma, p, own as any);
    lineup[5].jogador.numCamisa = 70;
    await assert.rejects(validarEquipe(prisma, p, own as any), /numeração do elenco mudou/);
    lineup[5].jogador.numCamisa = 6;
    lineup = lineup.slice(0, 4);
    await assert.rejects(validarEquipe(prisma, p, own as any), /exatamente 5 titulares/);
  });
});
