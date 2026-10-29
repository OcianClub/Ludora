import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'node:net';
import { prisma } from '../src/lib/prisma';
import { JWT_SECRET, JWT_OPTIONS } from '../src/config/env';
import routes from '../src/modules/convites/convite-publico.routes';

test('código sem e-mail exige login, expira e permite um único aceite', async t => {
  let status = 'PENDENTE', email = '', expires = Date.now() + 7200000, writes = 0;
  function replace(target: any, key: string, value: any) { const before = target[key]; target[key] = value; t.after(() => { target[key] = before; }); }
  replace(prisma.usuario, 'findUnique', async () => ({ id: 1, nome: 'Pessoa', email: 'pessoa@example.test', versao_sessao: 0 }));
  replace(prisma.usuario, 'count', async () => 1);
  replace(prisma.conviteClube, 'findUnique', async () => ({ id: 'invite', clube_id: 2, email, papel: 'OLHEIRO', acesso_todas_categorias: false, status, expira_em: new Date(expires), categorias: [], clube: { id: 2, nome: 'Ocian' }, criadoPor: { nome: 'Admin' } }));
  replace(prisma, '$transaction', async (fn: any) => fn({
    conviteClube: { updateMany: async () => { if (status !== 'PENDENTE') return { count: 0 }; status = 'ACEITO'; return { count: 1 }; } },
    usuarioClube: { findUnique: async () => null, create: async () => { writes++; return { id: 8, acesso_todas_categorias: false }; }, findUniqueOrThrow: async () => ({ id: 8, papel: 'OLHEIRO', acesso_todas_categorias: false, clube: { id: 2, nome: 'Ocian' }, categorias: [] }) },
  }));
  const app = express(); app.use(express.json(), routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/convites/codigo/ABCD-2345`;
  const token = jwt.sign({ id: 1, versao_sessao: 0 }, JWT_SECRET, JWT_OPTIONS);
  const accept = (auth = true) => fetch(`${base}/aceitar-existente`, { method: 'POST', headers: auth ? { Authorization: `Bearer ${token}` } : {} });
  try {
    const lookup: any = await (await fetch(base)).json();
    assert.equal(lookup.convite.email, ''); assert.equal(lookup.convite.possui_conta, true);
    assert.equal((await accept(false)).status, 401);
    assert.equal((await fetch(`${base}/aceitar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: 'Pessoa', senha: 'test1234' }) })).status, 409);
    email = 'outro@example.test'; assert.equal((await accept()).status, 403); email = '';
    expires = Date.now() - 1000; assert.equal((await accept()).status, 410); expires = Date.now() + 7200000;
    status = 'REVOGADO'; assert.equal((await accept()).status, 410); status = 'PENDENTE';
    const responses = await Promise.all([accept(), accept()]);
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
    assert.equal(writes, 1);
    assert.equal((await accept()).status, 409);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
