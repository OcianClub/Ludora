const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');

// Teste isolado dos filtros das rotas. Não carrega .env nem o Prisma real.
const root = path.resolve(__dirname, '../dist/src');
const resolve = file => require.resolve(path.join(root, file));
const chamadas = [];
const pass = (_req, _res, next) => next();
require.cache[resolve('middlewares/auth.middleware.js')] = { exports: { exigirAutenticacao: pass } };
require.cache[resolve('middlewares/permissoes.middleware.js')] = { exports: { exigirMembroDoClube: pass } };
require.cache[resolve('lib/prisma.js')] = { exports: { prisma: {
  notificacao: {
    deleteMany: async args => { chamadas.push(args); return { count: 1 }; },
    findMany: async args => { chamadas.push(args); return Array.from({ length: 4 }, (_, index) => ({ id: 100 - index })); },
    count: async () => 4,
  },
  dispositivoPush: { deleteMany: async args => { chamadas.push(args); return { count: 1 }; } },
} } };
const router = require(resolve('modules/notificacoes/notificacao.routes.js')).default();
async function executar(url, extras = {}, method = 'delete') {
  const route = router.stack.find(layer => layer.route?.path === url && layer.route.methods[method]).route;
  assert.equal(route.stack[0].handle, pass, 'Rota exige autenticação ou vínculo ao clube');
  const resposta = { codigo: 200, status(codigo) { this.codigo = codigo; return this; }, json(dados) { this.dados = dados; return this; } };
  await route.stack.at(-1).handle({ usuarioId: 42, clubeId: 7, params: {}, body: {}, query: {}, ...extras }, resposta);
  return resposta;
}
test('excluir aviso sempre limita a consulta à conta e ao clube ativos', async () => {
  const res = await executar('/notificacoes/:id', { params: { id: '15' } });
  assert.equal(res.codigo, 200);
  assert.deepEqual(chamadas.at(-1).where, { id: 15, usuario_id: 42, clube_id: 7 });
});
test('ID inválido é recusado sem chamar o banco', async () => {
  const antes = chamadas.length;
  assert.equal((await executar('/notificacoes/:id', { params: { id: 'invalido' } })).codigo, 400);
  assert.equal(chamadas.length, antes);
});
test('limpar lidas preserva não lidas, outras contas e outros clubes', async () => {
  await executar('/notificacoes/lidas');
  assert.deepEqual(chamadas.at(-1).where, { usuario_id: 42, clube_id: 7, lida: true });
});

test('limpar tudo só remove os avisos do usuário no clube ativo', async () => {
  const result = await executar('/notificacoes');
  assert.equal(result.codigo, 200);
  assert.deepEqual(chamadas.at(-1).where, { usuario_id: 42, clube_id: 7 });
  assert.deepEqual(result.dados, { removidas: 1 });
});

test('histórico usa paginação limitada e mantém o escopo da conta e do clube', async () => {
  const result = await executar('/notificacoes', { query: { limite: '2', cursor: '120' } }, 'get');
  const query = chamadas.at(-1);
  assert.deepEqual(query.where, { usuario_id: 42, clube_id: 7 });
  assert.equal(query.take, 3);
  assert.deepEqual(query.cursor, { id: 120 });
  assert.equal(query.skip, 1);
  assert.deepEqual(result.dados.notificacoes.map(item => item.id), [100, 99]);
  assert.equal(result.dados.proximoCursor, 99);
});

test('cursor inválido é recusado antes de consultar o banco', async () => {
  const before = chamadas.length;
  assert.equal((await executar('/notificacoes', { query: { cursor: '-1' } }, 'get')).codigo, 400);
  assert.equal(chamadas.length, before);
});
test('logout só desvincula o token pertencente ao usuário autenticado', async () => {
  assert.equal((await executar('/notificacoes/dispositivos', { body: { token: 'ExpoPushToken[teste]' } })).codigo, 200);
  assert.deepEqual(chamadas.at(-1).where, { usuario_id: 42, token: 'ExpoPushToken[teste]' });
});
test('token de dispositivo inválido não executa exclusão', async () => {
  const antes = chamadas.length;
  assert.equal((await executar('/notificacoes/dispositivos', { body: { token: 'invalido' } })).codigo, 400);
  assert.equal(chamadas.length, antes);
});
