import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { after, test } from 'node:test';
import { subscribeToMatch } from '../../../apps/web/src/services/matchRealtime.ts';

// Testa o cliente web contra o servidor Socket.IO real, com vínculo fictício.
// Não carrega o .env do serviço, não conecta ao Supabase e não altera dados.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-for-local-realtime-contract';
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
const { JWT_OPTIONS } = require('../dist/src/config/env.js');
const { prisma } = require('../dist/src/lib/prisma.js');
const { criarSocketServer } = require('../dist/src/realtime/socket.js');
const originalFindUnique = prisma.usuarioClube.findUnique;
const lookups = [];
prisma.usuarioClube.findUnique = async ({ where }) => {
  const membership = where.usuario_id_clube_id;
  lookups.push(membership);
  return membership.usuario_id === 7 && membership.clube_id === 11 ? { id: 1 } : null;
};
after(async () => {
  prisma.usuarioClube.findUnique = originalFindUnique;
  await prisma.$disconnect();
});

const token = jwt.sign({ id: 7 }, process.env.JWT_SECRET, JWT_OPTIONS);

async function waitFor(predicate, message) {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() >= deadline) assert.fail(message);
    await delay(10);
  }
}

async function setup(t, overrides = {}) {
  const http = createServer();
  const io = criarSocketServer();
  io.attach(http);
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  const states = [];
  const scores = [];
  const connections = [];
  let refreshes = 0;
  io.on('connection', socket => connections.push(socket));
  const unsubscribe = subscribeToMatch({
    baseUrl: `http://127.0.0.1:${http.address().port}`,
    token,
    clubId: 11,
    matchId: 41,
    onScore: score => scores.push(score),
    onRefresh: () => { refreshes += 1; },
    onStateChange: state => states.push(state),
    ...overrides,
  });
  t.after(async () => {
    unsubscribe();
    await new Promise(resolve => io.close(resolve));
  });
  return { io, states, scores, connections, unsubscribe, get refreshes() { return refreshes; } };
}

test('envia o token e o clube aceitos pela autorização da API', async t => {
  const client = await setup(t);
  await waitFor(() => client.refreshes === 1, 'O cliente não conectou');
  assert.deepEqual(client.states, ['connecting', 'connected']);
  assert.deepEqual(lookups.at(-1), { usuario_id: 7, clube_id: 11 });
  assert.equal(client.connections[0].rooms.has('clube:11'), true);
});

test('usa os eventos da API e ignora partidas diferentes', async t => {
  const client = await setup(t);
  await waitFor(() => client.refreshes === 1, 'O cliente não conectou');
  const serverSocket = client.connections[0];
  serverSocket.emit('placar_atualizado', { id: 99, gols_mandante: 8, gols_visitante: 2 });
  serverSocket.emit('evento_partida', { partida_id: 99, tipo: 'GOL' });
  serverSocket.emit('placar_atualizado', { id: 41, gols_mandante: 2, gols_visitante: 1 });
  // Aviso parcial: o cliente deve buscar a lista completa, não adicioná-lo como Evento.
  serverSocket.emit('evento_partida', { partida_id: 41, tipo: 'GOL', jogador: 'Test Player', minuto: 3 });
  await waitFor(() => client.scores.length === 1 && client.refreshes === 2, 'Os avisos não foram processados');
  assert.deepEqual(client.scores, [{ id: 41, gols_mandante: 2, gols_visitante: 1 }]);
});

test('mostra falha quando a API rejeita um token inválido', async t => {
  const client = await setup(t, { token: 'invalid-test-token' });
  await waitFor(() => client.states.includes('error'), 'A rejeição não foi informada');
  assert.equal(client.connections.length, 0);
  assert.equal(client.refreshes, 0);
});

test('não conecta em outro clube sem vínculo', async t => {
  const client = await setup(t, { clubId: 22 });
  await waitFor(() => client.states.includes('error'), 'O clube sem vínculo não foi rejeitado');
  assert.equal(client.connections.length, 0);
  assert.equal(client.refreshes, 0);
});

test('consulta os dados novamente após perder e recuperar a conexão', async t => {
  const client = await setup(t);
  await waitFor(() => client.refreshes === 1, 'O cliente não conectou');
  client.connections[0].conn.close();
  await waitFor(() => client.refreshes === 2, 'O cliente não sincronizou após reconectar');
  assert.equal(client.connections.length, 2);
  assert.equal(client.states.includes('disconnected'), true);
  assert.equal(client.states.at(-1), 'connected');
});

test('encerra a conexão e os avisos ao sair da tela', async t => {
  const client = await setup(t);
  await waitFor(() => client.refreshes === 1, 'O cliente não conectou');
  client.unsubscribe();
  await waitFor(() => client.io.sockets.sockets.size === 0, 'A conexão não foi encerrada');
  assert.deepEqual(client.states, ['connecting', 'connected']);
  assert.equal(client.refreshes, 1);
});
