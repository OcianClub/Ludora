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
  notificacao: { deleteMany: async args => { chamadas.push(args); return { count: 1 }; } },
  dispositivoPush: { deleteMany: async args => { chamadas.push(args); return { count: 1 }; } },
} } };
const router = require(resolve('modules/notificacoes/notificacao.routes.js')).default();
async function executar(url, extras = {}) {
  const route = router.stack.find(layer => layer.route?.path === url && layer.route.methods.delete).route;
  const resposta = { codigo: 200, status(codigo) { this.codigo = codigo; return this; }, json(dados) { this.dados = dados; return this; } };
  await route.stack.at(-1).handle({ usuarioId: 42, clubeId: 7, params: {}, body: {}, ...extras }, resposta);
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
test('logout só desvincula o token pertencente ao usuário autenticado', async () => {
  assert.equal((await executar('/notificacoes/dispositivos', { body: { token: 'ExpoPushToken[teste]' } })).codigo, 200);
  assert.deepEqual(chamadas.at(-1).where, { usuario_id: 42, token: 'ExpoPushToken[teste]' });
});
test('token de dispositivo inválido não executa exclusão', async () => {
  const antes = chamadas.length;
  assert.equal((await executar('/notificacoes/dispositivos', { body: { token: 'invalido' } })).codigo, 400);
  assert.equal(chamadas.length, antes);
});
