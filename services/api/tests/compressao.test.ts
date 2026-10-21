import assert from 'node:assert/strict';
import { test } from 'node:test';
import { request } from 'node:http';
import { gunzipSync } from 'node:zlib';
import express from 'express';
import { comprimirConsultas } from '../src/middlewares/compressao.middleware';

test('compressão reduz JSON sem alterar dados e respeita clientes, erros e escritas', async () => {
  const dados = Array.from({ length: 100 }, (_, id) => ({
    id,
    nome: 'Clube Ludora',
    status: 'FINALIZADA',
  }));
  const app = express();
  app.use(comprimirConsultas);
  app.get('/partidas', (_req, res) => res.json(dados));
  app.get('/negado', (_req, res) =>
    res.status(403).json({ error: 'Sem acesso', detalhes: dados })
  );
  app.post('/auth/login', (_req, res) =>
    res.json({ token: 'exemplo', detalhes: dados })
  );
  const servidor = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => servidor.once('listening', resolve));
  const endereco = servidor.address();
  assert.ok(endereco && typeof endereco === 'object');
  const consultar = (path: string, method = 'GET', encoding = 'gzip') =>
    new Promise<{ headers: Record<string, unknown>; corpo: Buffer }>(
      (resolve, reject) => {
        const req = request(
          {
            hostname: '127.0.0.1',
            port: endereco.port,
            path,
            method,
            headers: { 'Accept-Encoding': encoding },
          },
          (res) => {
            const partes: Buffer[] = [];
            res.on('data', (parte: Buffer) => partes.push(parte));
            res.on('end', () =>
              resolve({ headers: res.headers, corpo: Buffer.concat(partes) })
            );
            res.on('error', reject);
          }
        );
        req.on('error', reject);
        req.end();
      }
    );
  try {
    const compactada = await consultar('/partidas');
    assert.equal(compactada.headers['content-encoding'], 'gzip');
    assert.deepEqual(
      JSON.parse(gunzipSync(compactada.corpo).toString()),
      dados
    );
    const normal = await consultar('/partidas', 'GET', 'identity');
    assert.equal(normal.headers['content-encoding'], undefined);
    assert.deepEqual(JSON.parse(normal.corpo.toString()), dados);
    assert.ok(compactada.corpo.length < normal.corpo.length / 2);
    assert.equal(
      (await consultar('/negado')).headers['content-encoding'],
      undefined
    );
    assert.equal(
      (await consultar('/auth/login', 'POST')).headers['content-encoding'],
      undefined
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      servidor.close((erro) => (erro ? reject(erro) : resolve()))
    );
  }
});
