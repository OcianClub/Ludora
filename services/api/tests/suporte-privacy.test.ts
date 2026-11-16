import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prisma } from '../src/lib/prisma';
import { criarSuporteRoutes } from '../src/modules/suporte/routes';
test('chamados pertencem ao usuário e respostas nunca vão à sala do clube', async t => {
  const tickets = [{ id: 'one', usuarioId: 7, clubeId: 2, assunto: 'Conta um', revisao: 1, status: 'NOVO', fila: 'SUPORTE', origem: 'CLIENTE', tipo: 'ERRO', restrito: false, historico: [] }, { id: 'two', usuarioId: 8, clubeId: 2, assunto: 'Conta dois', historico: [] }];
  const patch = (target: any, key: string, fn: any) => { const old = target[key]; target[key] = fn; t.after(() => { target[key] = old; }); };
  patch(prisma.suporteChamado, 'findMany', async ({ where }: any) => { assert.ok(where.usuarioId); return tickets.filter(c => c.usuarioId === where.usuarioId); });
  patch(prisma.suporteChamado, 'findFirst', async ({ where }: any) => tickets.find(c => c.id === where.id && c.usuarioId === where.usuarioId) || null);
  patch(prisma.suporteChamado, 'findUnique', async () => tickets[0]);
  patch(prisma.suporteChamado, 'updateMany', async () => ({ count: 1 }));
  patch(prisma, '$transaction', async (fn: any) => fn(prisma));
  patch(prisma.suporteHistorico, 'create', async ({ data }: any) => ({ id: 99, ...data }));
  const emitted: any[] = [];
  const io = { of: (namespace: string) => ({ to: (room: string) => ({ emit: (event: string, payload: unknown) => emitted.push({ namespace, room, event, payload }) }) }) };
  const router = criarSuporteRoutes(io as any);
  async function call(method: string, path: string, user: number, id = '', body: object = {}) {
    const layer = (router as any).stack.find((l: any) => l.route?.path === path && l.route.methods[method]);
    let status = 200, result: any;
    const res = { locals: { funcionario: { id: 1, papel_plataforma: 'SUPORTE' } }, status(n: number) { status = n; return res; }, json(v: any) { result = v; return res; } };
    await layer.route.stack.at(-1).handle({ usuarioId: user, params: { id }, body }, res); return { status, result };
  }
  assert.deepEqual((await call('get', '/suporte', 7)).result.map((c: any) => c.id), ['one']);
  assert.deepEqual((await call('get', '/suporte', 8)).result.map((c: any) => c.id), ['two']);
  assert.equal((await call('get', '/suporte/:id', 8, 'one')).status, 404);
  assert.equal((await call('post', '/suporte/:id/responder', 8, 'one', { mensagem: 'Tentativa de responder em outra conta.' })).status, 404);
  assert.equal((await call('patch', '/admin/equipe/chamados/:id', 1, 'one', { acao: 'COMENTAR', motivo: 'Estamos trabalhando na solução.', revisao: 1, publico: true, usuarioId: 8 })).status, 200);
  assert.equal(emitted.length, 1); assert.equal(emitted[0].namespace, '/suporte'); assert.equal(emitted[0].room, 'usuario:7'); assert.equal(emitted[0].event, 'resposta_suporte');
});
