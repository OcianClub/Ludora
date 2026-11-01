import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchJsonResponse, RequestError } from '../src/services/http.ts';
import { authRequest } from '../src/services/authHttp.ts';

test('resposta HTTP inválida recebe mensagem utilizável em vez de erro de parse HTML', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>proxy upstream secret</html>', { status: 502 }));
  const response = await fetchJsonResponse('https://example.test');
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: 'O serviço está indisponível no momento. Tente novamente em instantes.' });
});

test('erro 500 não repassa detalhes internos; conflito 409 mantém contrato da resolução', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'prisma credentials', stack: 'private', code: 'internal' }), { status: 500 }));
  assert.doesNotMatch(JSON.stringify(await (await fetchJsonResponse('https://example.test')).json()), /prisma|credentials|private|internal/);
  globalThis.fetch.mock.mockImplementation(async () => new Response(JSON.stringify({ error: 'Camisa já utilizada', codigo: 'CAMISA_DUPLICADA', jogador: { id: 12 } }), { status: 409 }));
  const conflict = await (await fetchJsonResponse('https://example.test')).json();
  assert.equal(conflict.codigo, 'CAMISA_DUPLICADA');
  assert.equal(conflict.jogador.id, 12);
});

test('GET, escrita e leitura do corpo possuem prazo e liberam a interface', async t => {
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  }));
  await assert.rejects(fetchJsonResponse('https://example.test', {}, 5), error => error instanceof RequestError && error.kind === 'timeout');
  await assert.rejects(fetchJsonResponse('https://example.test', { method: 'POST' }, 5), /confira se a alteração foi salva antes de repetir/);
  globalThis.fetch.mock.mockImplementation(async (_url, options) => ({
    text: () => new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })),
  }));
  await assert.rejects(fetchJsonResponse('https://example.test', {}, 5), error => error.kind === 'timeout');
});

test('cancelamento de tela permanece AbortError tanto na API quanto na autenticação', async t => {
  let called = 0;
  t.mock.method(globalThis, 'fetch', (_url, options) => {
    called++;
    return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
  });
  for (const request of [fetchJsonResponse, authRequest]) {
    const controller = new AbortController();
    const pending = request('https://example.test', { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    await assert.rejects(request('https://example.test', { signal: controller.signal }), { name: 'AbortError' });
  }
  assert.equal(called, 2);
});

test('falha de rede e JSON inválido são diferenciados sem exposição técnica', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch secret upstream'); });
  await assert.rejects(fetchJsonResponse('https://example.test'), error => error.kind === 'network' && !/secret|fetch/.test(error.message));
  globalThis.fetch.mock.mockImplementation(async () => new Response('invalid'));
  await assert.rejects(fetchJsonResponse('https://example.test'), error => error.kind === 'response');
  globalThis.fetch.mock.mockImplementation(async () => new Response('null'));
  assert.equal(await (await fetchJsonResponse('https://example.test')).json(), null);
});

test('abort causado pelo prazo do cache é tratado como timeout, não cancelamento de usuário', async t => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', (_url, options) => new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })));
  const pending = fetchJsonResponse('https://example.test', { signal: controller.signal });
  controller.abort(new DOMException('Demora na consulta', 'TimeoutError'));
  await assert.rejects(pending, error => error.kind === 'timeout');
});
