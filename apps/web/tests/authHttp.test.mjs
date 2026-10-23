import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthError, authRequest } from '../src/services/authHttp.ts';

test('envia a requisição e interpreta JSON sem expor dados de autenticação', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.method, 'POST');
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(JSON.stringify({ mensagem: 'ok' }), { status: 202 });
  });
  assert.deepEqual(await authRequest('https://example.test', { method: 'POST' }), { mensagem: 'ok' });
});

test('expõe erros úteis, código de conflito e espera de rate limit', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'Convite utilizado', codigo: 'CONTA_EXISTENTE' }), { status: 409 }));
  await assert.rejects(authRequest('https://example.test'), error => error instanceof AuthError && error.status === 409 && error.code === 'CONTA_EXISTENTE');
  globalThis.fetch.mock.mockImplementation(async () => new Response('{}', { status: 429, headers: { 'Retry-After': '60' } }));
  await assert.rejects(authRequest('https://example.test'), error => error.retryAfter === 60 && /Muitas tentativas/.test(error.message));
});

test('trata resposta inválida e indisponibilidade sem mostrar erro interno do servidor', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>erro interno</html>', { status: 502 }));
  await assert.rejects(authRequest('https://example.test'), /indisponível/);
  globalThis.fetch.mock.mockImplementation(async () => new Response('not-json'));
  await assert.rejects(authRequest('https://example.test'), /confirmar a resposta/);
});

test('timeout libera o formulário e avisa sobre confirmação incerta de uma escrita', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => new Promise((_, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }));
  await assert.rejects(authRequest('https://example.test', {}, 5), /Verifique sua internet/);
  await assert.rejects(authRequest('https://example.test', { method: 'POST' }, 5, true), /tente entrar antes de repetir/);
});
