const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET ||= 'club-discovery-local-test-secret';
const { prisma } = require('../dist/src/lib/prisma');
const auth = require('../dist/src/auth/jwt');
const router = require('../dist/src/modules/clubes/clube.routes').default;

test('descoberta mostra somente as categorias atribuídas ao próprio usuário e ordena os subs numericamente', async t => {
  const originalAuth = auth.getUsuarioId;
  const originalFind = prisma.clube.findMany;
  const originalMatches = prisma.partida.findMany;
  prisma.partida.findMany = async ({ where, select }) => {
    assert.deepEqual(where, { status: 'AO_VIVO' });
    assert.deepEqual(Object.keys(select).sort(), ['categoria', 'mandante', 'visitante']);
    return [
      { categoria: { clube_id: 2 }, mandante: { clube_representado_id: 2 }, visitante: { clube_representado_id: 3 } },
      { categoria: { clube_id: 4 }, mandante: { clube_representado_id: 4 }, visitante: { clube_representado_id: 2 } },
    ];
  };
  let user = 11;
  auth.getUsuarioId = async () => user;
  prisma.clube.findMany = async ({ include }) => {
    if (!user) {
      assert.equal(include.usuarios, false);
      return [{ id: 2, nome: 'Ocian', _count: { usuarios: 14 } }, { id: 3, nome: 'Santos', _count: { usuarios: 2 } }, { id: 5, nome: 'Sem jogos', _count: { usuarios: 0 } }];
    }
    assert.equal(include.usuarios.where.usuario_id, 11);
    assert.deepEqual(Object.keys(include.usuarios.select).sort(), ['acesso_todas_categorias', 'categorias', 'papel']);
    return [{ id: 2, nome: 'Ocian', _count: { usuarios: 14 }, usuarios: [{
      papel: 'TECNICO', acesso_todas_categorias: false,
      categorias: [{ categoria: { id: 10, nome: 'sub-10' } }, { categoria: { id: 7, nome: 'sub-7' } }],
    }] }];
  };
  t.after(() => { auth.getUsuarioId = originalAuth; prisma.clube.findMany = originalFind; prisma.partida.findMany = originalMatches; });
  const handler = router.stack.find(layer => layer.route?.path === '/clubes' && layer.route.methods.get).route.stack.at(-1).handle;
  let body;
  const response = { json(value) { body = value; return this; }, status() { return this; } };
  await handler({query: {}}, response);
  assert.deepEqual(body[0].categoriasAcesso, [{ id: 7, nome: 'sub-7' }, { id: 10, nome: 'sub-10' }]);
  assert.equal(body[0].acessoTodasCategorias, false);
  assert.equal(body[0].seguidores, 14);
  assert.equal(body[0].partidasAoVivo, 2, 'Conta participação como visitante sem duplicar organizador/mandante');
  user = null;
  await handler({query: {}}, response);
  assert.deepEqual(body[0].categoriasAcesso, []);
  assert.equal(body[0].meuPapel, null);
  assert.equal(body[1].partidasAoVivo, 1);
  assert.equal(body[2].partidasAoVivo, 0);
});
