const assert = require('node:assert/strict');
const { test } = require('node:test');
const { once } = require('node:events');
const http = require('node:http');
process.env.NODE_ENV = 'test';
const { consultarAoVivo } = require('../dist/src/modules/publico/ao-vivo.service');
const { criarSocketServer } = require('../dist/src/realtime/socket');
const { notificarPartidaPublica } = require('../dist/src/realtime/publico');
const { io: connect } = require('../../../apps/web/node_modules/socket.io-client');

test('descoberta consulta partidas oficiais uma vez e projeta apenas dados públicos', async () => {
  let query;
  const team = (id, nome, clubId) => ({ id, nome, escudo: null, clube_representado_id: clubId,
    clubeRepresentado: clubId ? { nome: 'Clube Ludora', escudo: 'escudo.png' } : null });
  const rows = [{ id: 10, gols_mandante: 2, gols_visitante: 1, data: new Date(), horario: '19:30',
    categoria: { nome: 'sub-7' }, mandante: team(1, 'Nome antigo', 2), visitante: team(2, 'Adversário externo', null),
    participantes: [{ clube_id: 2 }] },
  { id: 11, gols_mandante: 0, gols_visitante: 0, data: new Date(), horario: '20:00', categoria: { nome: 'sub-8' },
    mandante: team(3, 'Time A', 2), visitante: team(4, 'Time B', 3), participantes: [{ clube_id: 2 }, { clube_id: 3 }] }];
  const result = await consultarAoVivo({ partida: { findMany: async args => { query = args; return rows; } } });
  assert.equal(query.where.status, 'AO_VIVO');
  assert.deepEqual(query.where.OR, [{ mandante: { clube_representado_id: { not: null } } },
    { visitante: { clube_representado_id: { not: null } } }, { participantes: { some: {} } }]);
  assert.ok(query.select && !query.include, 'não carrega jogadores, eventos ou dados privados');
  assert.equal(result.length, 2, 'jogo entre dois clubes não é duplicado');
  assert.deepEqual(result[0].clube_ids, [2]);
  assert.deepEqual(result[1].clube_ids, [2, 3]);
  assert.equal(result[0].mandante.nome, 'Clube Ludora');
  assert.equal(result[0].visitante.nome, 'Adversário externo');
  assert.deepEqual(Object.keys(result[0]).sort(), ['id', 'data', 'horario', 'categoria', 'gols_mandante', 'gols_visitante', 'mandante', 'visitante', 'clube_ids'].sort());
});

test('carrossel recebe invalidações sem entrar em salas de gestão ou receber detalhes privados', async t => {
  const io = criarSocketServer(async () => null, { clube: { findUnique: async () => null } });
  const server = http.createServer(); io.attach(server); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => io.close(resolve)));
  const guest = connect(`http://127.0.0.1:${server.address().port}/publico`, { auth: { descoberta: true }, transports: ['websocket'], reconnection: false });
  t.after(() => guest.close()); await once(guest, 'connect');
  const rooms = io.of('/publico').sockets.get(guest.id).rooms;
  assert.equal(rooms.has('publico:ao-vivo'), true);
  assert.equal(rooms.has('clube:2'), false);
  const received = []; guest.onAny((...args) => received.push(args));
  io.to('clube:2').emit('evento_criado', { privado: true });
  notificarPartidaPublica(io, { id: 8, categoria: { clube_id: 2 } }); // Só equipes externas.
  const changed = once(guest, 'ao_vivo_alterado');
  notificarPartidaPublica(io, { id: 9, categoria: { clube_id: 2 }, mandante: { clube_representado_id: 2 } });
  assert.deepEqual((await changed)[0], { partida_id: 9 });
  assert.deepEqual(received, [['ao_vivo_alterado', { partida_id: 9 }]]);
});
