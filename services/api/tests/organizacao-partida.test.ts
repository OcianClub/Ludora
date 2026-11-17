import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prisma } from '../src/lib/prisma';
import { criarOrganizacaoRoutes } from '../src/modules/partidas/organizacao.routes';
import { bloquearDuplicidade, chaveConfronto, filtroConflitoAgenda } from '../src/modules/partidas/compartilhadas.service';

const categorias = [{ id: 1, nome: 'SUB-7', tipo: 'INICIACAO', clube_id: 2 }];
const times = [{ id: 10, nome: 'Ocian', categoria_id: 1, clube_representado_id: 2 }, { id: 20, nome: 'Santos', categoria_id: 1, clube_representado_id: 3 }];
test('consultas de organização respeitam categorias, limitam histórico e ocultam compromissos de terceiros', async t => {
  const patch = (obj: any, key: string, value: any) => { const old = obj[key]; obj[key] = value; t.after(() => { obj[key] = old; }); };
  let role = 'ADMIN', catClub = 2, conflict: any = null, proposal: any = null;
  const cat = () => ({ ...categorias[0], clube_id: catClub, ativa: true, faixaIdade: 7 });
  patch(prisma.categoria, 'findUnique', async () => cat());
  patch(prisma.categoria, 'findMany', async () => [{ ...cat(), id: 99, clube_id: 3 }]);
  patch(prisma.usuarioClube, 'findUnique', async () => ({ papel: role, acesso_todas_categorias: false, categorias: [] }));
  patch(prisma.time, 'findMany', async () => times.slice(0, 2));
  patch(prisma.clube, 'count', async () => 1);
  let recentWhere: any, conflictWhere: any;
  patch(prisma.partida, 'findMany', async (args: any) => {
    assert.equal(args.take, 30); assert.equal(args.select.eventos, undefined); recentWhere = args.where;
    return [{ id: 1, data: new Date('2026-11-15'), mandante: times[1], visitante: times[0], emCasa: false, participantes: [{ time_id: 10 }] }];
  });
  patch(prisma.partida, 'findFirst', async (args: any) => {
    if (args.select?.local) return { id: 2, local: '  Ginásio do clube  ' };
    conflictWhere = args.where; return conflict;
  });
  patch(prisma.propostaPartida, 'findFirst', async () => proposal);
  const router = criarOrganizacaoRoutes();
  async function get(path: string, query: object) {
    const route = (router as any).stack.find((l: any) => l.route?.path === `/partidas/organizacao/${path}`).route;
    assert.equal(route.stack.length, 2, 'route includes permission middleware');
    let status = 200, result: any; const res = { status(n: number) { status = n; return res; }, json(value: any) { result = value; return res; } };
    await route.stack.at(-1).handle({ usuarioId: 1, clubeId: 2, query }, res);
    return { status, result };
  }
  const q = { categoria_id: '1', mandante_id: '10', visitante_id: '20', data: '2027-01-01', horario: '18:30' };
  const ctx = await get('contexto', { categoria_id: '1' });
  assert.equal(ctx.status, 200); assert.equal(ctx.result.recentes[0].timeId, 20); assert.equal(ctx.result.ultimoLocalCasa.local, 'Ginásio do clube');
  assert.deepEqual(recentWhere.OR, [{ categoria_id: 1 }, { participantes: { some: { clube_id: 2, categoria_id: 1 } } }]);
  assert.deepEqual(recentWhere.status.in, ['AO_VIVO', 'FINALIZADA']);
  assert.equal((await get('conflitos', q)).result.conflito, false);
  assert.deepEqual(conflictWhere, filtroConflitoAgenda(2, 3, cat(), { data: q.data, horario: q.horario }));
  conflict = { id: 88, categoria: { clube_id: 3 }, participantes: [{ clube_id: 3 }] };
  const privado = (await get('conflitos', q)).result;
  assert.equal(privado.conflito, true); assert.equal(privado.partidaId, null); assert.equal(privado.propostaId, null);
  assert.equal(JSON.stringify(privado).includes('88'), false);
  conflict.participantes.push({ clube_id: 2 });
  assert.equal((await get('conflitos', q)).result.partidaId, 88);
  conflict = null; proposal = { id: 'proposta-1' };
  assert.equal((await get('conflitos', q)).result.propostaId, 'proposta-1');
  role = 'TORCEDOR'; assert.equal((await get('contexto', { categoria_id: '1' })).status, 403); assert.equal((await get('conflitos', q)).status, 403);
  role = 'TECNICO'; assert.equal((await get('contexto', { categoria_id: '1' })).status, 403);
  role = 'ADMIN'; catClub = 50; assert.equal((await get('contexto', { categoria_id: '1' })).status, 403);
  catClub = 2; assert.equal((await get('conflitos', { ...q, horario: '25:99' })).status, 400);
});
test('envio final conserva trava e consulta de conflitos mesmo com prévia sem conflito', async () => {
  let locked = false, checked: any;
  const tx: any = { $queryRaw: async () => { locked = true; }, partida: { findFirst: async ({ where }: any) => { assert.equal(locked, true); checked = where; return { id: 20 }; } }, propostaPartida: { findFirst: async () => null } };
  const cat = { nome: 'SUB-7', faixaIdade: 7, tipo: 'INICIACAO' }, dados = { data: '2027-01-01', horario: '18:30', mandante_id: 10, visitante_id: 20 };
  await assert.rejects(bloquearDuplicidade(tx, 2, 3, cat, dados), /conflito de agenda/);
  assert.deepEqual(checked, filtroConflitoAgenda(2, 3, cat, dados));
  assert.equal(chaveConfronto(2, 3, cat, dados), chaveConfronto(3, 2, cat, { ...dados, mandante_id: 20, visitante_id: 10 }));
});
