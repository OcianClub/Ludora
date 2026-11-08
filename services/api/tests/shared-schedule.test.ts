import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prisma } from '../src/lib/prisma';
import { criarCompartilhadasRoutes } from '../src/modules/partidas/compartilhadas.routes';
import { consultarListaPartidas } from '../src/modules/partidas/partidas-lista.service';
import { publicarPartida } from '../src/modules/publico/publico.service';
import { escopoPartidas, escopoCategoriaPartidas } from '../src/modules/partidas/visibilidade';
import { FiltroDataInvalido } from '../src/modules/partidas/filtros-data.utils';

// Executa os handlers e as consultas reais contra persistência em memória.
// Não lê credenciais, não conecta ao Supabase e não altera partidas de usuários.
function matches(row: any, where: any): boolean {
  return Object.entries(where || {}).every(([key, value]: [string, any]) => {
    if (value === undefined) return true;
    if (key === 'OR') return value.some((item: any) => matches(row, item));
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every((item: any) => matches(row, item));
    const actual = row[key];
    if (value instanceof Date) return +new Date(actual) === +value;
    if (value && typeof value === 'object') {
      if ('some' in value) return (actual || []).some((item: any) => matches(item, value.some));
      if ('none' in value) return !(actual || []).some((item: any) => matches(item, value.none));
      if ('in' in value) return value.in.includes(actual);
      if ('not' in value) return actual !== value.not;
      if ('equals' in value) return value.mode === 'insensitive' ? String(actual).toLowerCase() === value.equals.toLowerCase() : actual === value.equals;
      return matches(actual || {}, value);
    }
    return actual === value;
  });
}

test('propostas e agenda compartilhada: duas perspectivas, respostas e permissões', async t => {
  const categories = [
    { id: 7, nome: 'SUB-7', faixaIdade: 0, tipo: 'INICIACAO', clube_id: 2 },
    { id: 88, nome: 'sub-7', faixaIdade: 7, tipo: 'INICIACAO', clube_id: 3 },
    { id: 89, nome: 'SUB-8', faixaIdade: 8, tipo: 'INICIACAO', clube_id: 3 },
  ];
  const clubs = [{ id: 2, nome: 'Ocian', escudo: null }, { id: 3, nome: 'Santos', escudo: null }];
  const teams = [
    { id: 20, nome: 'Ocian SUB-7', categoria_id: 7, clube_representado_id: 2, arquivado: false, clubeRepresentado: clubs[0] },
    { id: 30, nome: 'Santos SUB-7', categoria_id: 7, clube_representado_id: 3, arquivado: false, clubeRepresentado: clubs[1] },
    { id: 40, nome: 'Adversário local', categoria_id: 7, clube_representado_id: null, arquivado: false },
  ];
  const proposals: any[] = [], games: any[] = [], emissions: any[] = [], notifications: any[] = [];
  let role = 'ADMIN', allowed = [7, 88], member = true;
  function replace(target: any, name: string, value: any) {
    const old = target[name]; target[name] = value; t.after(() => { target[name] = old; });
  }
  const category = (id: number) => categories.find(c => c.id === id);
  const game = (id: number) => games.find(p => p.id === id);
  replace(prisma, '$transaction', async (fn: any) => fn(prisma));
  replace(prisma, '$queryRaw', async () => []);
  replace(prisma.categoria, 'findUnique', async ({ where }: any) => category(where.id));
  replace(prisma.categoria, 'findUniqueOrThrow', async ({ where }: any) => category(where.id));
  replace(prisma.categoria, 'findFirst', async ({ where }: any) => categories.find(c => matches(c, where)) || null);
  replace(prisma.categoria, 'findMany', async ({ where }: any) => categories.filter(c => matches(c, where)));
  replace(prisma.time, 'findMany', async ({ where }: any) => teams.filter(c => matches(c, where)));
  replace(prisma.usuarioClube, 'findUnique', async () => member ? { papel: role, acesso_todas_categorias: false, categorias: allowed.map(id => ({ categoria_id: id })) } : null);
  replace(prisma.usuarioClube, 'findMany', async () => []);
  replace(prisma.dispositivoPush, 'findMany', async () => []);
  replace(prisma.clube, 'findMany', async () => clubs);
  replace(prisma.notificacao, 'create', async ({ data }: any) => { notifications.push(data); return data; });
  replace(prisma.propostaPartida, 'findUnique', async ({ where }: any) => proposals.find(p => p.id === where.id) || null);
  replace(prisma.propostaPartida, 'findUniqueOrThrow', async ({ where }: any) => proposals.find(p => p.id === where.id));
  replace(prisma.propostaPartida, 'findFirst', async ({ where }: any) => proposals.find(p => matches(p, where)) || null);
  replace(prisma.propostaPartida, 'findMany', async ({ where, take }: any) => proposals.filter(p => matches(p, where)).slice(0, take));
  replace(prisma.propostaPartida, 'count', async ({ where }: any) => proposals.filter(p => matches(p, where)).length);
  replace(prisma.propostaPartida, 'create', async ({ data }: any) => {
    const p = { id: `proposal-${proposals.length + 1}`, status: 'PENDENTE', tipo: 'CRIACAO', versao: 0, partida_id: null, ...data };
    proposals.push(p); return p;
  });
  replace(prisma.propostaPartida, 'update', async ({ where, data }: any) => {
    const p = proposals.find(p => p.id === where.id);
    Object.assign(p, { ...data, versao: data.versao?.increment ? p.versao + data.versao.increment : p.versao }); return p;
  });
  replace(prisma.partida, 'findFirst', async ({ where }: any) => games.find(p => matches(p, where)) || null);
  replace(prisma.partida, 'findUnique', async ({ where }: any) => game(where.id) || null);
  replace(prisma.partida, 'findUniqueOrThrow', async ({ where }: any) => game(where.id));
  replace(prisma.partida, 'findMany', async ({ where }: any) => games.filter(p => matches(p, where)));
  replace(prisma.partida, 'updateMany', async ({ where, data }: any) => {
    const rows = games.filter(p => matches(p, where));
    for (const p of rows) Object.assign(p, { ...data, versao: data.versao?.increment ? p.versao + data.versao.increment : p.versao });
    return { count: rows.length };
  });
  replace(prisma.partida, 'update', async ({ where, data }: any) => Object.assign(game(where.id), data));
  replace(prisma.participantePartida, 'updateMany', async ({ where, data }: any) => {
    const rows = game(where.partida_id).participantes; rows.forEach((e: any) => Object.assign(e, data)); return { count: rows.length };
  });
  replace(prisma.partida, 'create', async ({ data }: any) => {
    const p = { id: games.length + 1, status: 'AGENDADA', versao: 0, gols_mandante: 0, gols_visitante: 0, competicao: null,
      ...data, categoria: category(data.categoria_id), mandante: teams.find(t => t.id === data.mandante_id), visitante: teams.find(t => t.id === data.visitante_id),
      participantes: data.participantes.create.map((e: any) => ({ ...e, categoria: category(e.categoria_id), pronta: false })),
    }; games.push(p); return p;
  });
  replace(prisma.auditoriaPartida, 'create', async () => ({}));
  const channel = (namespace: string) => ({ to: (room: string) => ({ emit: (event: string, data: any) => emissions.push({ namespace, room, event, data }) }) });
  const io: any = { ...channel('private'), of: () => channel('public') };
  const router = criarCompartilhadasRoutes(io);
  const body = (day = '2026-12-15') => ({ categoria_id: 7, mandante_id: 20, visitante_id: 30, data: day, horario: '19:30', local: 'Quadra Ludora' });
  async function call(path: string, club: number, data: any, id = '', method = 'post') {
    const route = (router as any).stack.find((l: any) => l.route?.path === path && l.route.methods[method]).route;
    let status = 200, result: any;
    const res = { status(n: number) { status = n; return res; }, json(value: any) { result = value; } };
    await route.stack.at(-1).handle({ usuarioId: 1, clubeId: club, params: { id }, body: data }, res);
    return { status, result };
  }
  const response = (club: number, p: any, acao: string, extra = {}) => call('/partidas/solicitacoes/:id/responder', club, { acao, versao: p.versao, ...extra }, p.id);

  await t.test('convite pendente não cria jogo e somente o destinatário com acesso pode responder', async () => {
    const created = await call('/partidas', 2, body()); assert.equal(created.status, 201);
    assert.equal(games.length, 0); const p = proposals[0];
    assert.equal(p.categoria_destino_id, 88); assert.equal(p.respondente_id, 3);
    assert.equal((await call('/partidas', 2, body())).status, 409, 'não duplicar convite pendente');
    assert.equal((await response(2, p, 'ACEITAR')).status, 403);
    assert.equal((await response(99, p, 'ACEITAR')).status, 404);
    for (const papel of ['TORCEDOR', 'OLHEIRO']) { role = papel; assert.equal((await response(3, p, 'ACEITAR')).status, 403); }
    role = 'TECNICO'; allowed = [89]; assert.equal((await response(3, p, 'ACEITAR')).status, 403);
    allowed = [88]; member = false; assert.equal((await response(3, p, 'ACEITAR')).status, 403); member = true; role = 'ADMIN';
    assert.equal(games.length, 0);
  });
  await t.test('sugestão troca o respondente, protege versão antiga e aceite cria um único jogo', async () => {
    const p = proposals[0];
    assert.equal((await response(3, p, 'SUGERIR', { data: '2026-12-16', horario: '20:00', local: 'Nova quadra' })).status, 200);
    assert.equal(p.respondente_id, 2); assert.equal(p.versao, 1); assert.equal(games.length, 0);
    assert.equal((await response(3, p, 'ACEITAR')).status, 403);
    const stale = await call('/partidas/solicitacoes/:id/responder', 2, { acao: 'ACEITAR', versao: 0 }, p.id);
    assert.equal(stale.status, 409);
    assert.equal((await response(2, p, 'ACEITAR')).status, 200);
    assert.equal(p.status, 'ACEITA'); assert.equal(games.length, 1);
    assert.equal(games[0].horario, '20:00'); assert.equal(games[0].local, 'Nova quadra');
    assert.deepEqual(games[0].participantes.map((e: any) => [e.clube_id, e.categoria_id, e.time_id]), [[2, 7, 20], [3, 88, 30]]);
    assert.equal((await response(2, p, 'ACEITAR')).status, 409); assert.equal(games.length, 1);
    for (const club of [2, 3]) assert.ok(emissions.some(e => e.room === `clube:${club}` && e.event === 'partida_atualizada' && e.data.id === games[0].id));
  });
  await t.test('os cinco estados aparecem nas duas agendas com a categoria local, mesmo com faixas antigas diferentes', async () => {
    for (const status of ['AGENDADA', 'PREPARADA', 'AO_VIVO', 'FINALIZADA', 'CANCELADA']) {
      games[0].status = status;
      for (const club of [2, 3]) for (const resumo of ['0', '1']) {
        const cat = club === 2 ? 7 : 88;
        const rows = await consultarListaPartidas(prisma, club, { categoria_id: String(cat), status, resumo });
        assert.equal(rows.length, 1, `${club} / ${status} / ${resumo}`);
        assert.equal(rows[0].id, games[0].id); assert.equal(rows[0].categoria_id, cat); assert.equal(rows[0].categoria.id, cat);
        assert.equal(rows[0].emCasa, club === 2); assert.equal(rows[0].organizador_id, 2);
        const published = publicarPartida(games[0], club);
        assert.equal(published.categoria_id, cat); assert.equal(published.emCasa, club === 2); assert.equal(published.somente_leitura, true);
      }
    }
    assert.equal((await consultarListaPartidas(prisma, 3, { categoria_id: '89' })).length, 0);
    assert.equal((await consultarListaPartidas(prisma, 3, { categoria_id: '7' })).length, 0);
    assert.equal((await consultarListaPartidas(prisma, 99, {})).length, 0);
  });
  await t.test('recusar ou cancelar criação não cria jogo; recusar alteração não anuncia confirmação falsa', async () => {
    for (const [club, acao, expected, date] of [[3, 'RECUSAR', 'RECUSADA', '2026-12-17'], [2, 'CANCELAR', 'CANCELADA', '2026-12-18']] as const) {
      await call('/partidas', 2, body(date)); const p = proposals.at(-1);
      assert.equal((await response(club, p, acao)).status, 200); assert.equal(p.status, expected); assert.equal(games.length, 1);
    }
    const pending = { ...proposals[0], id: 'alteration', status: 'PENDENTE', versao: 0, tipo: 'ALTERACAO', respondente_id: 3, partida_id: games[0].id };
    proposals.push(pending); const before = emissions.length;
    assert.equal((await response(3, pending, 'RECUSAR')).status, 200);
    assert.equal(emissions.slice(before).some(e => e.event === 'partida_atualizada' || e.event === 'partidas_alteradas'), false);
    assert.equal(notifications.some(n => n.titulo === 'Confronto confirmado ou atualizado' && n.dados?.solicitacaoId === pending.id), false);
  });
  await t.test('mandante pode editar antes de confirmar; alterar só local não recria conflito de horário legado', async () => {
    const p = games[0]; p.status = 'AGENDADA';
    p.participantes.forEach((e: any) => { e.pronta = false; });
    const collision = { ...p, id: 999 }; games.push(collision);
    const result = await call('/partidas/:id', 2, { local: 'Local corrigido', versao: p.versao }, String(p.id), 'patch');
    assert.equal(result.status, 200); assert.equal(result.result.solicitacao.tipo, 'ALTERACAO');
    assert.equal(result.result.solicitacao.respondente_id, 3);
    assert.equal((await response(3, result.result.solicitacao, 'ACEITAR')).status, 200);
    assert.equal(p.local, 'Local corrigido');
    collision.horario = '20:30';
    assert.equal((await call('/partidas/:id', 2, { horario: '20:30' }, String(p.id), 'patch')).status, 409, 'remarcação para horário ocupado continua bloqueada');
    games.pop();
    assert.equal((await call('/partidas/:id', 2, { local: 'Versão antiga', versao: p.versao - 1 }, String(p.id), 'patch')).status, 409);
    assert.equal((await call('/partidas/:id', 99, { local: 'Intruso' }, String(p.id), 'patch')).status, 404);
    role = 'TORCEDOR'; assert.equal((await call('/partidas/:id', 2, { local: 'Visitante' }, String(p.id), 'patch')).status, 403); role = 'ADMIN';
    p.status = 'AO_VIVO'; assert.equal((await call('/partidas/:id', 2, { local: 'Depois do início' }, String(p.id), 'patch')).status, 400);
    p.status = 'AGENDADA';
  });
  await t.test('remarcação sugerida pelo adversário só vale após aceite e preserva os dois vínculos', async () => {
    const p = games[0]; p.status = 'PREPARADA'; p.participantes.forEach((e: any) => { e.pronta = true; });
    const originalTime = p.data.toISOString();
    const edit = await call('/partidas/:id', 3, { data: '2026-12-20', horario: '18:15', local: 'Quadra Santos' }, String(p.id), 'patch');
    assert.equal(edit.status, 200); assert.equal(p.data.toISOString(), originalTime); assert.equal(p.status, 'PREPARADA');
    assert.equal(edit.result.solicitacao.origem_id, 3); assert.equal(edit.result.solicitacao.respondente_id, 2);
    assert.equal((await response(3, edit.result.solicitacao, 'ACEITAR')).status, 403);
    assert.equal((await response(2, edit.result.solicitacao, 'ACEITAR')).status, 200);
    assert.equal(p.data.toISOString().slice(0, 10), '2026-12-20'); assert.equal(p.horario, '18:15'); assert.equal(p.local, 'Quadra Santos');
    assert.equal(p.organizador_id, 2); assert.equal(p.status, 'AGENDADA');
    assert.ok(p.participantes.every((e: any) => !e.pronta));
    for (const club of [2, 3]) assert.equal((await consultarListaPartidas(prisma, club, { status: 'AGENDADA' }))[0].id, p.id);
  });
  await t.test('adversário sem cadastro cria direto e não exige participante fictício', async () => {
    const created = await call('/partidas', 2, { ...body('2026-12-19'), visitante_id: 40 });
    assert.equal(created.status, 201); assert.equal(created.result.participantes.length, 1);
    assert.equal(created.result.participantes[0].clube_id, 2);
    assert.equal((await consultarListaPartidas(prisma, 3, {})).length, 1);
  });
  await t.test('participante é vínculo de leitura e filtros legados não misturam categorias', async () => {
    const p = games[0]; p.mandante.clube_representado_id = null; p.visitante.clube_representado_id = null;
    assert.equal(matches(p, escopoPartidas(3)), true); assert.equal(matches(p, escopoPartidas(99)), false);
    assert.equal((await consultarListaPartidas(prisma, 3, { categoria_id: '88' })).length, 1);
    assert.equal(publicarPartida(p, 2).emCasa, true);
    assert.equal(publicarPartida(p, 3).emCasa, false);
    const legacy = { categoria_id: 7, categoria: categories[0], participantes: [] };
    assert.equal(matches(legacy, escopoCategoriaPartidas(3, categories[1] as any)), true);
    assert.equal(matches({ ...legacy, categoria: { ...legacy.categoria, tipo: 'BASE' } }, escopoCategoriaPartidas(3, categories[1] as any)), false);
    assert.equal(matches({ ...legacy, categoria: { ...legacy.categoria, nome: 'SUB-8' } }, escopoCategoriaPartidas(3, categories[1] as any)), false);
  });
  await t.test('filtros inválidos falham antes de chamar o banco', async () => {
    for (const filter of [{ status: 'PROXIMAS' }, { categoria_id: 'abc' }, { competicao_id: '999999999999' }, { categoria_id: ['7'] }])
      await assert.rejects(consultarListaPartidas(prisma, 2, filter), FiltroDataInvalido);
  });
  await t.test('solicitações respeitam a categoria local do técnico antes do limite da consulta', async () => {
    const allowedProposal = { ...proposals[0], id: 'allowed-old', categoria_destino_id: 88 };
    proposals.splice(0, proposals.length, ...Array.from({ length: 120 }, (_, i) => ({ ...proposals[0], id: `other-category-${i}`, categoria_destino_id: 89 })), allowedProposal);
    role = 'TECNICO'; allowed = [88];
    const list = await call('/partidas/solicitacoes', 3, {}, '', 'get');
    assert.equal(list.status, 200); assert.deepEqual(list.result.map((p: any) => p.id), ['allowed-old']);
    assert.equal(list.result[0].categoria_nome, 'sub-7');
    role = 'TORCEDOR'; assert.equal((await call('/partidas/solicitacoes', 3, {}, '', 'get')).status, 403);
    role = 'ADMIN';
  });
});
