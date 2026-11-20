import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { configureApiConnection, createApiConnection, getApiConnectionState, reportApiConnection } = require('../src/services/apiConnection.ts');
const { authRequest } = require('../src/services/authHttp.ts');

const healthy = () => new Response(JSON.stringify({ status: 'ok' }));
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

test('primeiro acesso compartilha a conexão, aguarda o despertar e não cria polling', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let finish;
  let calls = 0;
  t.mock.method(globalThis, 'fetch', (url, options) => {
    calls++;
    assert.equal(url, 'https://api.onrender.com/health');
    assert.equal(options.credentials, 'omit');
    return new Promise(resolve => { finish = resolve; });
  });
  const connection = createApiConnection('https://api.onrender.com/');
  const first = connection.wait();
  const second = connection.wait();
  await flush();
  t.mock.timers.tick(25_000);
  assert.equal(connection.getState(), 'slow', '20 segundos não encerram o despertar');
  finish(healthy());
  await Promise.all([first, second]);
  assert.equal(connection.getState(), 'ready');
  await connection.wait();
  t.mock.timers.tick(5 * 60_000);
  assert.equal(calls, 1);
});

test('cancelar uma tela não cancela a conexão das demais', async t => {
  let finish;
  t.mock.method(globalThis, 'fetch', () => new Promise(resolve => { finish = resolve; }));
  const connection = createApiConnection('https://api.onrender.com');
  const controller = new AbortController();
  const first = connection.wait(controller.signal);
  const second = connection.wait();
  await flush();
  controller.abort();
  await assert.rejects(first, { name: 'AbortError' });
  finish(healthy());
  await second;
  assert.equal(connection.getState(), 'ready');
});

test('sessão de tela já cancelada não inicia acesso ao servidor', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => healthy());
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(createApiConnection('https://api.onrender.com').wait(controller.signal), { name: 'AbortError' });
  assert.equal(fetch.mock.callCount(), 0);
});

test('indisponibilidade tem prazo e uma nova tentativa pode recuperar', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fetch = t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  }));
  const connection = createApiConnection('https://api.onrender.com', 90_000);
  const result = assert.rejects(connection.wait(), error => error.kind === 'timeout');
  await flush();
  t.mock.timers.tick(90_000);
  await result;
  assert.equal(connection.getState(), 'error');
  fetch.mock.mockImplementation(async () => healthy());
  await connection.wait();
  assert.equal(connection.getState(), 'ready');
});

test('HTML do proxy e status inválido não são confundidos com API pronta', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('<html>iniciando</html>', { headers: { 'Content-Type': 'text/html' } }));
  const connection = createApiConnection('https://api.onrender.com');
  const pending = assert.rejects(connection.wait(), error => error.kind === 'network');
  await flush();
  assert.equal(connection.getState(), 'connecting');
  fetch.mock.mockImplementation(async () => new Response('{"status":"offline"}'));
  t.mock.timers.tick(3_000);
  await pending;
  assert.equal(connection.getState(), 'error');
});

test('após inatividade a próxima ação confere conexão; não existe intervalo em segundo plano', async t => {
  let now = 1_000;
  t.mock.method(Date, 'now', () => now);
  const fetch = t.mock.method(globalThis, 'fetch', async () => healthy());
  const connection = createApiConnection('https://api.onrender.com');
  await connection.wait();
  now += 16 * 60_000;
  await flush();
  assert.equal(fetch.mock.callCount(), 1);
  await connection.wait();
  assert.equal(fetch.mock.callCount(), 2);
});

test('login aguarda conexão antes de enviar credenciais e não repete POST', async t => {
  let wake;
  const calls = [];
  t.mock.method(globalThis, 'fetch', (url, options) => {
    calls.push({ url, method: options.method || 'GET' });
    if (url.endsWith('/health')) return new Promise(resolve => { wake = resolve; });
    return Promise.resolve(new Response('{"token":"teste"}'));
  });
  configureApiConnection('https://login.onrender.com');
  const result = authRequest('https://login.onrender.com/auth/login', { method: 'POST' });
  await flush();
  assert.deepEqual(calls.map(call => call.method), ['GET']);
  wake(healthy());
  assert.deepEqual(await result, { token: 'teste' });
  assert.deepEqual(calls.map(call => call.method), ['GET', 'POST']);
});

test('health indisponível permanentemente não bloqueia o login', async t => {
  let probes = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.endsWith('/health')) {
      probes++;
      return new Response('Not Found', { status: 404 });
    }
    return new Response('{"token":"teste"}');
  });
  configureApiConnection('https://probe.onrender.com');
  const url = 'https://probe.onrender.com/auth/login';
  assert.deepEqual(await authRequest(url, { method: 'POST' }), { token: 'teste' });
  assert.deepEqual(await authRequest(url, { method: 'POST' }), { token: 'teste' });
  assert.equal(probes, 1);
});

test('sucesso da consulta real recupera erro do health sem reenviar a operação', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('Not Found', { status: 404 }));
  configureApiConnection('https://actual.onrender.com');
  await flush();
  assert.equal(getApiConnectionState(), 'error');
  reportApiConnection('https://other.onrender.com/usuarios');
  assert.equal(getApiConnectionState(), 'error');
  reportApiConnection('https://actual.onrender.com/usuarios');
  assert.equal(getApiConnectionState(), 'ready');
});

test('login espera o proxy do Render e recupera uma falha temporária da API', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const requests = [];
  t.mock.method(globalThis, 'fetch', async url => {
    requests.push(url);
    const count = requests.filter(call => call === url).length;
    if (url.endsWith('/health')) {
      if (count === 1) throw new TypeError('Failed to fetch');
      return count === 2 ? new Response('Starting', { status: 503 }) : healthy();
    }
    return count === 1 ? new Response('Starting', { status: 503 }) : new Response('{"token":"teste"}');
  });
  configureApiConnection('https://recover.onrender.com');
  const result = authRequest('https://recover.onrender.com/auth/login', { method: 'POST' });
  await flush();
  t.mock.timers.tick(3_000);
  await flush();
  assert.equal(getApiConnectionState(), 'connecting');
  t.mock.timers.tick(3_000);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests.map(url => new URL(url).pathname), ['/health', '/health', '/health', '/auth/login']);
  t.mock.timers.tick(600);
  assert.deepEqual(await result, { token: 'teste' });
});

test('consulta de sessão repete erro transitório em local, sem repetir operação de escrita ou 401', async t => {
  const urls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    urls.push(url);
    if (url.endsWith('/auth/login')) return new Response('{"error":"Credenciais inválidas"}', { status: 401 });
    if (url.endsWith('/usuarios/me') && urls.filter(call => call === url).length === 2) return new Response('{"id":1}');
    return new Response('Starting', { status: 503 });
  });
  configureApiConnection('http://localhost:3000');
  await assert.rejects(authRequest('http://localhost:3000/auth/login', { method: 'POST' }), { status: 401 });
  await assert.rejects(authRequest('http://localhost:3000/auth/registrar', { method: 'POST' }), { status: 503 });
  assert.deepEqual(await authRequest('http://localhost:3000/usuarios/me'), { id: 1 });
  assert.deepEqual(urls.map(url => new URL(url).pathname), ['/auth/login', '/auth/registrar', '/usuarios/me', '/usuarios/me']);
});

test('confirmação real não volta a lenta nem falha quando a sondagem antiga termina', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let fail;
  t.mock.method(globalThis, 'fetch', () => new Promise((_, reject) => { fail = reject; }));
  const connection = createApiConnection('https://actual.onrender.com');
  const waiting = connection.wait();
  await flush();
  connection.markReady();
  t.mock.timers.tick(5000);
  assert.equal(connection.getState(), 'ready');
  fail(new TypeError('health indisponível'));
  await waiting;
  assert.equal(connection.getState(), 'ready');
});

test('backend local não herda aviso ou sondagem de Render configurado anteriormente', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => healthy());
  configureApiConnection('https://actual.onrender.com');
  await flush();
  configureApiConnection('http://localhost:3000');
  assert.equal(getApiConnectionState(), 'idle');
  assert.equal(fetch.mock.callCount(), 1);
});
