import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { after, test } from 'node:test';
import { subscribeToMatch, subscribeClubMatches } from '../../../apps/web/src/services/matchRealtime.ts';

// Testa o cliente web com Socket.IO/JWT reais e persistência simulada.
// Não carrega o .env do serviço, não conecta ao Supabase e não altera dados.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-for-local-realtime-contract';
const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const session = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem() { return null; } } });
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem(key) {
    if (key === 'ludora_token') return 'sessao-do-teste';
    if (key === 'ludora_clube') return JSON.stringify({ id: 11, meuPapel: 'ADMIN' });
    return null;
  } },
});
after(() => {
  if (session) Object.defineProperty(globalThis, 'sessionStorage', session);
  else delete globalThis.sessionStorage;
  if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
  else delete globalThis.localStorage;
});
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
const { JWT_OPTIONS } = require('../dist/src/config/env.js');
const { prisma } = require('../dist/src/lib/prisma.js');
const { criarSocketServer } = require('../dist/src/realtime/socket.js');
const originalFindUnique = prisma.usuarioClube.findUnique;
const originalUsuario = prisma.usuario.findUnique;
const originalClube = prisma.clube.findUnique;
prisma.usuario.findUnique = async ({ where }) => where.id === 7 ? { versao_sessao: 0 } : null;
prisma.clube.findUnique = async ({ where }) => [11, 22].includes(where.id) ? { id: where.id } : null;
const lookups = [];
prisma.usuarioClube.findUnique = async ({ where }) => {
  const membership = where.usuario_id_clube_id;
  lookups.push(membership);
  return membership.usuario_id === 7 && membership.clube_id === 11 ? { id: 1 } : null;
};
after(async () => {
  prisma.usuarioClube.findUnique = originalFindUnique;
  prisma.usuario.findUnique = originalUsuario;
  prisma.clube.findUnique = originalClube;
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
  const polls = [];
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
    onPoll: value => polls.push(value),
    ...overrides,
  });
  t.after(async () => {
    unsubscribe();
    await new Promise(resolve => io.close(resolve));
  });
  return { io, states, scores, polls, connections, unsubscribe, get refreshes() { return refreshes; } };
}

test('envia o token e o clube aceitos pela autorização da API', async t => {
  const client = await setup(t);
  await waitFor(() => client.refreshes === 1, 'O cliente não conectou');
  assert.deepEqual(client.states, ['connecting', 'connected']);
  assert.equal(lookups.length, 0);
  assert.equal(client.connections[0].rooms.has('clube:11'), true);
  assert.equal(client.connections[0].rooms.has('usuario:7'), true);
});

test('agenda gerencial recebe aceite e mudança da partida, reconcilia na conexão e desconecta ao sair', async t => {
  const http = createServer();
  const io = criarSocketServer(); io.attach(http);
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  const sockets = []; io.on('connection', socket => sockets.push(socket));
  let refreshes = 0;
  const unsubscribe = subscribeClubMatches(11, token, () => { refreshes++; }, `http://127.0.0.1:${http.address().port}`);
  t.after(async () => { unsubscribe(); await new Promise(resolve => io.close(resolve)); });
  await waitFor(() => refreshes === 1, 'A agenda não reconciliou ao conectar');
  io.to('clube:22').emit('partida_atualizada', { id: 99 });
  await delay(40); assert.equal(refreshes, 1, 'outro clube não deve atualizar esta agenda');
  io.to('clube:11').emit('solicitacao_partida', { id: 'accepted-proposal' });
  io.to('clube:11').emit('partida_atualizada', { id: 41 });
  await waitFor(() => refreshes === 3, 'O aceite não atualizou a agenda');
  assert.equal(sockets[0].rooms.has('clube:11'), true);
  unsubscribe();
  io.to('clube:11').emit('partida_atualizada', { id: 42 });
  await delay(40); assert.equal(refreshes, 3, 'não atualizar uma tela desmontada');
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

test('palpites usam canal próprio, ignoram outra partida e não recarregam os dados do jogo', async t => {
  const client = await setup(t);
  await waitFor(() => client.refreshes === 1, 'O cliente não conectou');
  client.connections[0].emit('palpite_atualizado', { partida_id: 99, total: 3 });
  client.connections[0].emit('palpite_atualizado', { partida_id: 41, total: 4 });
  await waitFor(() => client.polls.length === 1, 'O voto não foi recebido');
  assert.deepEqual(client.polls, [{ partida_id: 41, total: 4 }]);
  assert.equal(client.refreshes, 1);
});

test('mostra falha quando a API rejeita um token inválido', async t => {
  const client = await setup(t, { token: 'invalid-test-token' });
  await waitFor(() => client.states.includes('error'), 'A rejeição não foi informada');
  assert.equal(client.connections.length, 0);
  assert.equal(client.refreshes, 0);
});

test('permite visitar clube público sem vínculo, somente na sala escolhida', async t => {
  const client = await setup(t, { clubId: 22 });
  await waitFor(() => client.refreshes === 1, 'O clube público não conectou');
  assert.equal(client.connections[0].rooms.has('clube:22'), true);
  assert.equal(client.connections[0].rooms.has('clube:11'), false);
});

test('não conecta em clube inexistente', async t => {
  const client = await setup(t, { clubId: 33 });
  await waitFor(() => client.states.includes('error'), 'O clube inexistente não foi rejeitado');
  assert.equal(client.connections.length, 0);
  assert.equal(client.refreshes, 0);
});

test('rejeita sessão revogada e usuário inexistente', async t => {
  for (const payload of [{ id: 7, versao_sessao: 1 }, { id: 99 }]) {
    const client = await setup(t, { token: jwt.sign(payload, process.env.JWT_SECRET, JWT_OPTIONS) });
    await waitFor(() => client.states.includes('error'), 'A sessão inválida foi aceita');
    assert.equal(client.connections.length, 0);
    assert.equal(client.refreshes, 0);
  }
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
