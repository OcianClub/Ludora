import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import axios from 'axios';
import { criarEscudosPaulistaRoutes } from '../src/modules/paulista/escudos.routes';
test('escudos: origem fixa, consultas agrupadas, cache de falhas e limites de resposta', async t => {
  let calls = 0;
  const original = axios.get;
  (axios as any).get = async (url: string, options: any) => {
    calls++; assert.match(url, /^https:\/\/admfutsal\.com\.br\/assets\/images\/foto\/escudo\/\d+\.png$/);
    assert.equal(options.maxRedirects, 0); assert.equal(options.maxContentLength, 128 * 1024);
    await new Promise(r => setTimeout(r, 30));
    if (url.includes('9999.png')) throw Error('Unavailable');
    return { data: Buffer.from([137,80,78,71]), headers: { 'content-type': 'image/png' } };
  };
  t.after(() => { axios.get = original; });
  const app = express(); app.use(criarEscudosPaulistaRoutes());
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r)); t.after(() => server.close());
  const base = `http://127.0.0.1:${(server.address() as any).port}/publico/escudos/paulista/`;
  const results = await Promise.all([fetch(base+'1234.png'),fetch(base+'1234.png')]);
  assert.equal(calls, 1); for (const r of results) { assert.equal(r.status, 200); assert.equal(r.headers.get('cross-origin-resource-policy'), 'cross-origin'); assert.match(r.headers.get('content-type')!, /image\/png/); }
  await fetch(base+'1234.png'); assert.equal(calls, 1);
  for (let i=0;i<2;i++) { const r=await fetch(base+'9999.png'); assert.equal(r.status, 200); assert.match(r.headers.get('content-type')!, /image\/svg/); }
  assert.equal(calls, 2); assert.equal((await fetch(base+'example.com.png')).status, 404); assert.equal(calls, 2);
});
