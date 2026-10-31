import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedRead, invalidateReadCache, peekRead, readLifetime } from '../src/services/readCache.ts';

const json = value => new Response(JSON.stringify(value));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test.beforeEach(() => invalidateReadCache());

test('consultas simultâneas compartilham rede e cada consumidor pode ler o JSON', async () => {
  const network = deferred();
  let calls = 0;
  const load = () => { calls++; return network.promise; };
  const first = cachedRead('club:1/categories', load, 1000);
  const second = cachedRead('club:1/categories', load, 1000);
  network.resolve(json([{ id: 1 }]));
  assert.deepEqual(await (await first).json(), [{ id: 1 }]);
  assert.deepEqual(await (await second).json(), [{ id: 1 }]);
  assert.deepEqual(await (await cachedRead('club:1/categories', load, 1000)).json(), [{ id: 1 }]);
  assert.equal(calls, 1);
});

test('expiração consulta a rede, mas permite usar a última tela durante a atualização', async t => {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  await cachedRead('home', async () => json(['old']), 10);
  now += 11;
  assert.equal(peekRead('home'), undefined);
  assert.deepEqual(peekRead('home', true), ['old']);
  assert.deepEqual(await (await cachedRead('home', async () => json(['new']), 10)).json(), ['new']);
});

test('sessões e clubes distintos não compartilham consultas', async () => {
  for (const key of ['session1:club1', 'session1:club2', 'session2:club1']) {
    await cachedRead(key, async () => json(key), 1000);
    assert.equal(peekRead(key), key);
  }
  invalidateReadCache('session1:');
  assert.equal(peekRead('session1:club1'), undefined);
  assert.equal(peekRead('session1:club2'), undefined);
  assert.equal(peekRead('session2:club1'), 'session2:club1');
});

test('uma escrita invalida inclusive consultas antigas ainda em andamento', async () => {
  const network = deferred();
  const old = cachedRead('home', () => network.promise, 1000);
  invalidateReadCache();
  await cachedRead('home', async () => json('after mutation'), 1000);
  network.resolve(json('before mutation'));
  assert.equal(await (await old).json(), 'before mutation');
  assert.equal(peekRead('home'), 'after mutation');
});

test('cancelar um consumidor não cancela a consulta de outro', async () => {
  const network = deferred();
  const controller = new AbortController();
  let fetchSignal;
  const load = signal => { fetchSignal = signal; return network.promise; };
  const first = cachedRead('shared', load, 1000, controller.signal);
  const second = cachedRead('shared', load, 1000);
  const aborted = assert.rejects(first, { name: 'AbortError' });
  controller.abort();
  await aborted;
  assert.equal(fetchSignal.aborted, false);
  network.resolve(json('ok'));
  assert.equal(await (await second).json(), 'ok');
});

test('último consumidor cancelado encerra a rede e libera uma próxima tentativa', async () => {
  const controller = new AbortController();
  let fetchSignal;
  const pending = cachedRead('cancelled', signal => {
    fetchSignal = signal;
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('abort', 'AbortError'))));
  }, 1000, controller.signal);
  const aborted = assert.rejects(pending, { name: 'AbortError' });
  controller.abort();
  await aborted;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fetchSignal.aborted, true);
  assert.equal(await (await cachedRead('cancelled', async () => json('retry'), 1000)).json(), 'retry');
});

test('remontagem imediata do StrictMode reaproveita a consulta em andamento', async () => {
  const network = deferred();
  const controller = new AbortController();
  let calls = 0, fetchSignal;
  const load = signal => { calls++; fetchSignal = signal; return network.promise; };
  const first = cachedRead('strict', load, 1000, controller.signal);
  const aborted = assert.rejects(first, { name: 'AbortError' });
  controller.abort();
  const second = cachedRead('strict', load, 1000);
  await aborted;
  assert.equal(fetchSignal.aborted, false);
  network.resolve(json('ok'));
  assert.equal(await (await second).json(), 'ok');
  assert.equal(calls, 1);
});

test('falhas HTTP, HTML e respostas no-store não ficam no cache', async () => {
  const loaders = [
    () => new Response('{}', { status: 503 }),
    () => new Response('<html>not JSON</html>'),
    () => new Response('{}', { headers: { 'Cache-Control': 'no-store' } }),
  ];
  for (const [index, value] of loaders.entries()) {
    let calls = 0;
    const load = async () => { calls++; return value(); };
    await cachedRead(String(index), load, 1000);
    await cachedRead(String(index), load, 1000);
    assert.equal(calls, 2);
    assert.equal(peekRead(String(index)), undefined);
  }
});

test('cache limitado descarta entradas antigas e preserva a mais recente', async () => {
  for (let i = 0; i < 70; i++) await cachedRead(String(i), async () => json(i), 1000);
  assert.equal(peekRead('0'), undefined);
  assert.equal(peekRead('69'), 69);
});

test('detalhes ao vivo e notificações não recebem TTL de dados estáticos', () => {
  assert.equal(readLifetime('/partidas/17'), 0);
  assert.equal(readLifetime('/partidas/17/eventos'), 0);
  assert.equal(readLifetime('/notificacoes'), 0);
  assert.equal(readLifetime('/categorias'), 60000);
  assert.equal(readLifetime('/partidas?status=AO_VIVO'), 5000);
});


test('falha temporária preserva última leitura, mas perda de permissão remove os dados', async t => {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  await cachedRead('home', async () => json('old'), 10);
  now += 11;
  await cachedRead('home', async () => new Response('{}', { status: 503 }), 10);
  assert.equal(peekRead('home', true), 'old');
  await cachedRead('home', async () => new Response('{}', { status: 403 }), 10);
  assert.equal(peekRead('home', true), undefined);
});
