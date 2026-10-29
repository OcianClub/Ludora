const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../dist/src/lib/prisma.js');
const permissions = require('../dist/src/middlewares/permissoes.middleware.js');
const router = require('../dist/src/modules/cadastros/cadastro.routes.js').default;
const { resumirConfrontos } = require('../dist/src/modules/cadastros/time-context.js');

const initial = [
  { id: 1, nome: 'Ocian sub-7', categoria_id: 7, clube_representado_id: 2, escudo: null, arquivado: false },
  { id: 2, nome: 'Ocian sub-8', categoria_id: 8, clube_representado_id: 2, escudo: null, arquivado: false },
  { id: 3, nome: 'Aurora FC sub-7', categoria_id: 7, clube_representado_id: null, escudo: null, arquivado: false },
  { id: 4, nome: 'Aurora FC (sub-8)', categoria_id: 8, clube_representado_id: null, escudo: null, arquivado: false },
  { id: 5, nome: 'Santos sub-7', categoria_id: 7, clube_representado_id: 3, escudo: null, arquivado: false },
  { id: 6, nome: 'Aurora FC sub-7', categoria_id: 99, clube_representado_id: null, escudo: null, arquivado: false },
];

function database(t) {
  let rows = structuredClone(initial);
  let official = null;
  let allowed = [7, 8, 9];
  let failOfficial = false;
  t.mock.method(permissions, 'podeAcessarCategoria', async (_user, _club, category) => allowed.includes(category));
  const originalFind = prisma.categoria.findFirst;
  const originalTransaction = prisma.$transaction;
  let transactions = 0;
  prisma.categoria.findFirst = async ({ where }) => where.clube_id === 2 && [7, 8, 9].includes(where.id) ? { id: where.id, nome: `sub-${where.id}` } : null;
  prisma.$transaction = async (callback, options) => {
    transactions++;
    assert.equal(options.isolationLevel, 'Serializable');
    const before = structuredClone(rows);
    const crest = official;
    const tx = {
      time: {
        findMany: async ({ where, include }) => {
          assert.equal(where.categoria.clube_id, 2);
          return structuredClone(rows.filter(row => row.categoria_id !== 99).map(row => include?.categoria ? { ...row, categoria: { nome: `sub-${row.categoria_id}` } } : row));
        },
        updateMany: async ({ where, data }) => {
          const target = rows.filter(row => where.id.in.includes(row.id));
          target.forEach(row => Object.assign(row, data));
          return { count: target.length };
        },
        create: async ({ data }) => { const row = { id: 20, arquivado: false, ...data }; rows.push(row); return row; },
        update: async ({ where, data }) => {
          const row = rows.find(item => item.id === where.id);
          Object.assign(row, data);
          return row;
        },
      },
      clube: { update: async ({ data }) => { if (failOfficial) throw new Error('Injected failure'); official = data.escudo; } },
    };
    try { return await callback(tx); }
    catch (error) { rows = before; official = crest; throw error; }
  };
  t.after(() => { prisma.categoria.findFirst = originalFind; prisma.$transaction = originalTransaction; });
  return { transactions: () => transactions, rows: () => rows, official: () => official, allow: categories => { allowed = categories; }, failOfficial: () => { failOfficial = true; } };
}

async function call(method, path, id, body, role = 'ADMIN') {
  const route = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route;
  const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await route.stack.at(-1).handle({ params: { id: String(id) }, body, query: {}, clubeId: 2, usuarioId: 1, papelUsuario: role }, response);
  return response;
}

test('ações de gestão rejeitam times vinculados a outro clube e permitem times externos ou do próprio clube', async t => {
  const originalFind = prisma.time.findFirst;
  prisma.time.findFirst = async ({ where }) => initial.find(item => item.id === where.id) || null;
  t.after(() => { prisma.time.findFirst = originalFind; });
  for (const [method, path] of [['patch', '/times/:id/arquivo'], ['post', '/times/:id/categorias'], ['patch', '/times/:id'], ['delete', '/times/:id']]) {
    const route = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route;
    const guard = route.stack.at(-2).handle;
    for (const [id, expected] of [[5, 403], [3, 200], [1, 200]]) {
      let nextCalled = false;
      const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() { return this; } };
      await guard({ params: { id: String(id) }, clubeId: 2 }, response, () => { nextCalled = true; });
      assert.equal(response.statusCode, expected, `${method} ${path}, time ${id}`);
      assert.equal(nextCalled, expected === 200);
    }
  }
});

test('retrospecto usa a perspectiva do clube, agrega categorias, multiplica resultados repetidos e ignora terceiros', () => {
  const score = (home, away, h, a, n = 1) => ({ mandante_id: home, visitante_id: away, gols_mandante: h, gols_visitante: a, _count: { _all: n } });
  const summaries = resumirConfrontos(initial, [score(1, 3, 2, 0, 2), score(4, 2, 1, 1), score(3, 1, 3, 0), score(3, 5, 4, 0)], [
    { mandante_id: 1, visitante_id: 3, categoria_id: 7, _min: { data: new Date('2026-11-10') } },
    { mandante_id: 4, visitante_id: 2, categoria_id: 8, _min: { data: new Date('2026-11-01') } },
  ], 2);
  const aurora = summaries.find(item => item.key === 'aurora fc');
  assert.deepEqual([aurora.vitorias, aurora.empates, aurora.derrotas, aurora.golsPro, aurora.golsContra], [2, 1, 1, 5, 4]);
  assert.equal(aurora.proxima.categoria_id, 8);
  assert.deepEqual(aurora.categorias.map(item => [item.categoria_id, item.vitorias, item.empates, item.derrotas]), [[7, 2, 0, 1], [8, 0, 1, 0]]);
  const own = summaries.find(item => item.key === 'club:2');
  assert.deepEqual([own.vitorias, own.empates, own.derrotas, own.golsPro, own.golsContra], [2, 1, 1, 5, 4]);
  assert.deepEqual(own.categorias.map(item => [item.categoria_id, item.vitorias, item.empates, item.derrotas]), [[7, 2, 0, 1], [8, 0, 1, 0]]);
});

test('escudo atualiza todas as categorias do adversário em uma transação, sem alcançar outro clube', async t => {
  const db = database(t);
  const result = await call('patch', '/times/:id/escudo', 3, { escudo: 'https://example.test/crest.png' });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body.ids, [3, 4]);
  assert.equal(db.rows().filter(row => row.escudo).length, 2);
  assert.equal(db.rows().find(row => row.id === 6).escudo, null);
});

test('permissão parcial, origem de outro clube e escudo de clube terceiro são rejeitados sem escritas', async t => {
  const db = database(t);
  db.allow([7]);
  assert.equal((await call('patch', '/times/:id/escudo', 3, { escudo: '' })).statusCode, 403);
  assert.equal((await call('patch', '/times/:id/escudo', 6, { escudo: '' })).statusCode, 404);
  assert.equal((await call('patch', '/times/:id/escudo', 5, { escudo: '' })).statusCode, 403);
  assert.deepEqual(db.rows(), initial);
});

test('escudo oficial exige ADMIN e falha no clube desfaz também alterações nos times', async t => {
  const db = database(t);
  assert.equal((await call('patch', '/times/:id/escudo', 1, { escudo: 'https://example.test/a.png' }, 'TECNICO')).statusCode, 403);
  db.failOfficial();
  assert.equal((await call('patch', '/times/:id/escudo', 1, { escudo: 'https://example.test/a.png' })).statusCode, 409);
  assert.equal(db.official(), null);
  assert.deepEqual(db.rows(), initial);
});

test('URL inválida não executa transação', async t => {
  const db = database(t);
  assert.equal((await call('patch', '/times/:id/escudo', 3, { escudo: 'javascript:alert(1)' })).statusCode, 400);
  assert.equal(db.transactions(), 0);
});

test('arquivar/restaurar preserva registros e só altera categorias locais do adversário', async t => {
  const db = database(t);
  const archive = await call('patch', '/times/:id/arquivo', 3, { arquivado: true });
  assert.deepEqual(archive.body.ids, [3, 4]);
  assert.equal(db.rows().filter(row => row.arquivado).length, 2);
  assert.equal(db.rows().length, initial.length);
  const restore = await call('patch', '/times/:id/arquivo', 4, { arquivado: false });
  assert.equal(restore.statusCode, 200);
  assert.deepEqual(db.rows(), initial);
  assert.equal((await call('patch', '/times/:id/arquivo', 1, { arquivado: true })).statusCode, 403);
});

test('nova categoria herda vínculo oficial, evita duplicação e exige categoria do clube com acesso', async t => {
  const db = database(t);
  const added = await call('post', '/times/:id/categorias', 5, { categoria_id: 8 });
  assert.equal(added.statusCode, 201);
  assert.equal(added.body.clube_representado_id, 3);
  assert.equal((await call('post', '/times/:id/categorias', 5, { categoria_id: 8 })).statusCode, 409);
  assert.equal((await call('post', '/times/:id/categorias', 5, { categoria_id: 99 })).statusCode, 403);
  db.allow([7]);
  assert.equal((await call('post', '/times/:id/categorias', 5, { categoria_id: 9 })).statusCode, 403);
});

test('time arquivado não recebe novas categorias', async t => {
  database(t);
  await call('patch', '/times/:id/arquivo', 3, { arquivado: true });
  assert.equal((await call('post', '/times/:id/categorias', 3, { categoria_id: 9 })).statusCode, 409);
});

test('renomear altera todas as categorias mantendo IDs e rejeita nome duplicado ou clube terceiro', async t => {
  const db = database(t);
  const renamed = await call('patch', '/times/:id/nome', 3, { nome: 'Aurora Esporte' });
  assert.equal(renamed.statusCode, 200);
  assert.deepEqual(renamed.body.items.map(item => [item.id, item.nome]), [[3, 'Aurora Esporte sub-7'], [4, 'Aurora Esporte sub-8']]);
  assert.equal(db.rows().find(item => item.id === 6).nome, 'Aurora FC sub-7');
  assert.equal((await call('patch', '/times/:id/nome', 3, { nome: 'Santos' })).statusCode, 409);
  assert.equal((await call('patch', '/times/:id/nome', 5, { nome: 'Outro nome' })).statusCode, 403);
});
