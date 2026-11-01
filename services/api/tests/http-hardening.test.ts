import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { protegerCacheHttp, tratarErroHttp } from '../src/middlewares/http-errors.middleware';
import { limitarRequisicoes } from '../src/middlewares/rate-limit.middleware';

test('HTTP: JSON inválido é 400, payload excedido é 413 e dados sensíveis não são armazenados', async t => {
  const app = express();
  app.use(protegerCacheHttp);
  app.use(express.json({ limit: '1kb' }));
  app.post('/auth/login', (_req, res) => res.json({ ok: true }));
  app.get('/categorias', (_req, res) => res.json([]));
  app.get('/erro', (_req, _res, next) => next(new Error('postgres://senha-interna')));
  app.use(tratarErroHttp);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const invalid = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"senha":' });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(await invalid.text(), /SyntaxError|senha|stack/);
  const large = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: 'a'.repeat(2048) }) });
  assert.equal(large.status, 413);
  assert.equal((await fetch(`${base}/categorias`)).headers.get('cache-control'), 'private, no-cache');
  const error = await fetch(`${base}/erro`);
  assert.equal(error.status, 500);
  assert.deepEqual(await error.json(), { error: 'Erro interno do servidor' });
});

test('limite por IP impede contornar login alternando e-mails e informa quando tentar novamente', () => {
  const buckets = new Map();
  const limit = limitarRequisicoes({ janelaMs: 60_000, limite: 2, prefixo: 'test', buckets });
  const call = (email: unknown, ip = '127.0.0.1') => {
    const headers: Record<string, string> = {};
    let status = 200;
    let next = false;
    const res = { setHeader: (key: string, value: string) => { headers[key] = value; }, status: (value: number) => { status = value; return res; }, json: () => res };
    limit({ ip, socket: {}, body: { email } } as any, res as any, () => { next = true; });
    return { status, headers, next };
  };
  assert.equal(call('teste@exemplo.com').next, true);
  assert.equal(call(' TESTE@EXEMPLO.COM ').next, true);
  assert.equal(call('teste@exemplo.com').status, 429);
  for (let i = 0; i < 7; i++) assert.equal(call(`outro${i}@exemplo.com`).next, true);
  const blocked = call('novo@exemplo.com');
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers['RateLimit-Remaining'], '0');
  assert.ok(Number(blocked.headers['Retry-After']) > 0);
  assert.equal(call('teste@exemplo.com', '127.0.0.2').status, 200);
  assert.equal(call({ inesperado: true }).status, 429);
});
