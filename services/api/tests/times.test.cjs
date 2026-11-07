const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_OPTIONS } = require('../dist/src/config/env.js');
const { prisma } = require('../dist/src/lib/prisma.js');
const router = require('../dist/src/modules/cadastros/cadastro.routes.js').default;
const profile = require('../dist/src/modules/clubes/perfil-clube.routes.js').default;
const links = require('../dist/src/modules/clubes/vinculo-time.routes.js').default;
const { resumirConfrontos } = require('../dist/src/modules/cadastros/time-context.js');
const initial = [
  { id: 1, nome: 'Ocian sub-7', categoria_id: 7, clube_representado_id: 2 },
  { id: 2, nome: 'Ocian sub-8', categoria_id: 8, clube_representado_id: 2 },
  { id: 3, nome: 'Aurora FC sub-7', categoria_id: 7, clube_representado_id: null },
  { id: 4, nome: 'Aurora FC sub-8', categoria_id: 8, clube_representado_id: null },
  { id: 5, nome: 'Santos sub-7', categoria_id: 7, clube_representado_id: 3 },
  { id: 6, nome: 'Aurora FC sub-7', categoria_id: 99, clube_representado_id: null },
];
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


test('Times web: API somente leitura e confrontos limitados ao clube atual', async t => {
  let role = 'ADMIN', writes = [], queries = [];
  const club = { id: 2, nome: 'Ocian', escudo: null };
  function mock(target, key, implementation) { const old = target[key]; target[key] = implementation; t.after(() => { target[key] = old; }); }
  mock(prisma.usuario, 'findUnique', async () => ({ versao_sessao: 0 }));
  mock(prisma.usuarioClube, 'findUnique', async () => ({ papel: role, acesso_todas_categorias: true, categorias: [] }));
  mock(prisma.time, 'findMany', async ({ where }) => where.categoria?.clube_id === 2 ? initial.filter(j => j.categoria_id !== 99) : []);
  mock(prisma.time, 'findFirst', async ({ where }) => initial.find(j => j.id === where.id));
  mock(prisma.clube, 'findUnique', async () => club);
  mock(prisma.clube, 'update', async args => { writes.push(args); return { ...club, ...args.data }; });
  for (const method of ['create', 'update', 'updateMany', 'delete']) mock(prisma.time, method, async args => { writes.push(args); throw Error('Uma escrita não deveria ocorrer'); });
  const games = [
    { id: 10, mandante_id: 1, visitante_id: 5, gols_mandante: 2, gols_visitante: 0 },
    { id: 11, mandante_id: 5, visitante_id: 1, gols_mandante: 3, gols_visitante: 1 },
    { id: 12, mandante_id: 3, visitante_id: 5, gols_mandante: 8, gols_visitante: 0 }, // terceiros
    { id: 13, mandante_id: 1, visitante_id: 3, gols_mandante: 1, gols_visitante: 0 }, // outro adversário
  ];
  function filtered(where) {
    return games.filter(g => where.OR.some(pair => pair.mandante_id.in.includes(g.mandante_id) && pair.visitante_id.in.includes(g.visitante_id)));
  }
  mock(prisma.partida, 'findMany', async args => { queries.push(args); return args.where.status === 'FINALIZADA' ? filtered(args.where) : []; });
  mock(prisma.partida, 'groupBy', async args => { queries.push(args); return filtered(args.where).map(g => ({ ...g, _count: { _all: 1 } })); });
  const app = express();
  app.use(express.json());
  app.use(links, profile, router);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.on('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const token = jwt.sign({ id: 1, versao_sessao: 0 }, JWT_SECRET, JWT_OPTIONS);
  const send = (method, path, body) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'x-clube-id': '2' }, body: body === undefined ? undefined : JSON.stringify(body) });

  await t.test('admin, técnico e mesário não alteram próprio time, adversário Ludora ou externo', async () => {
    for (role of ['ADMIN', 'TECNICO', 'MESARIO']) {
      for (const id of [1, 3, 5]) {
        for (const [method, suffix, body] of [
          ['PATCH', '/nome', { nome: 'Alterado' }], ['PATCH', '/escudo', { escudo: 'https://example.test/a.png' }],
          ['PATCH', '/arquivo', { arquivado: true }], ['POST', '/categorias', { categoria_id: 8 }],
          ['PATCH', '', { nome: 'Alterado', categoria_id: 7 }], ['DELETE', '', {}],
        ]) {
          const res = await send(method, '/times/' + id + suffix, body);
          assert.equal(res.status, 403, role + ' ' + method + ' time ' + id + suffix);
          assert.match((await res.json()).error, /superadministradores/);
        }
      }
    }
    assert.equal(writes.length, 0);
    role = 'ADMIN';
    assert.equal((await send('PATCH', '/times/vinculo', { time_ids: [5], clube_id: 2, motivo: 'Tentativa de vincular' })).status, 403);
  });

  await t.test('nome e escudo também são bloqueados pelo endpoint alternativo de perfil', async () => {
    for (const body of [{ nome: 'Outro nome' }, { escudo: 'https://example.test/a.png' }, { nome: 'Ocian', escudo: '', endereco: null }]) {
      const res = await send('PATCH', '/clube/perfil', body);
      // Enviar os valores atuais é compatível com clientes antigos e só muda a sede.
      if (body.nome === 'Ocian') assert.equal(res.status, 200); else assert.equal(res.status, 403);
    }
    assert.equal(writes.length, 1);
    assert.equal(writes[0].data.nome, undefined); assert.equal(writes[0].data.escudo, undefined);
    assert.equal((await send('PATCH', '/clube/perfil', { nome: 'Ocian' })).status, 400);
  });

  await t.test('resumo e histórico consultam o mesmo confronto, sem partidas de terceiros', async () => {
    const res = await send('GET', '/times/5/contexto?categoria_id=7');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data.ultimas.map(g => g.id), [10, 11]);
    assert.deepEqual([data.resumo.vitorias, data.resumo.empates, data.resumo.derrotas], [1, 0, 1]);
    assert.equal(queries.length, 3);
    for (const query of queries) assert.deepEqual(query.where.OR, [
      { mandante_id: { in: [1] }, visitante_id: { in: [5] } }, { mandante_id: { in: [5] }, visitante_id: { in: [1] } },
    ]);
    assert.equal(queries[0].take, 5);
    assert.equal((await send('GET', '/times/5/contexto?categoria_id=99')).status, 403);
    assert.equal((await send('GET', '/times/999/contexto')).status, 404);
  });
});
