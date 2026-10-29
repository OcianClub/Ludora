import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'node:net';
import { prisma } from '../src/lib/prisma';
import { JWT_SECRET, JWT_OPTIONS } from '../src/config/env';
import { gerarHashCodigoConvite } from '../src/modules/convites/convite.utils';
import routes from '../src/modules/convites/convite-admin.routes';

test('convite por código mantém vínculo ao e-mail e exige administração', async t => {
  let role = 'ADMIN';
  const writes: any[] = [];
  function replace(target: any, key: string, value: any) { const before = target[key]; target[key] = value; t.after(() => { target[key] = before; }); }
  replace(prisma.usuario, 'findUnique', async () => ({ versao_sessao: 0 }));
  replace(prisma.usuarioClube, 'findUnique', async () => ({ papel: role }));
  replace(prisma.categoria, 'count', async () => 1);
  replace(prisma.conviteClube, 'findFirst', async () => null);
  replace(prisma.conviteClube, 'create', async (args: any) => {
    writes.push(args.data);
    return { id: 'invite-1', email: args.data.email, papel: args.data.papel, status: 'PENDENTE', acesso_todas_categorias: false, expira_em: args.data.expira_em, clube: { id: 2, nome: 'Ocian' }, criadoPor: { nome: 'Admin' }, categorias: [] };
  });
  const app = express(); app.use(express.json(), routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const token = jwt.sign({ id: 1, versao_sessao: 0 }, JWT_SECRET, JWT_OPTIONS);
  const post = (body: unknown) => fetch(`${base}/convites`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-clube-id': '2', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  try {
    const body = { email: 'Pessoa@exemplo.com', papel: 'TECNICO', categoria_ids: [9], entrega: 'codigo' };
    role = 'TECNICO'; assert.equal((await post(body)).status, 403); assert.equal(writes.length, 0);
    role = 'ADMIN'; assert.equal((await post({ ...body, entrega: 'invalida' })).status, 400);
    assert.equal((await post({ ...body, email: '', entrega: 'email' })).status, 400);
    assert.equal((await post({ ...body, categoria_ids: [] })).status, 400);
    const response = await post(body); assert.equal(response.status, 201);
    const result: any = await response.json();
    assert.match(result.codigo, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.equal(result.email_enviado, false);
    assert.equal(result.token, undefined);
    assert.equal(writes[0].email, 'pessoa@exemplo.com');
    assert.equal(writes[0].codigo_hash, gerarHashCodigoConvite(result.codigo));
    assert.deepEqual(writes[0].categorias.create, [{ categoria_id: 9 }]);
    assert.equal((await post({ ...body, papel: 'TORCEDOR' })).status, 400);
    assert.equal((await post({ ...body, papel: 'ADMIN', categoria_ids: [] })).status, 201);
    assert.equal(writes[1].papel, 'ADMIN');
    assert.equal(writes[1].acesso_todas_categorias, true);
    assert.equal(writes[1].categorias, undefined);
    assert.equal((await post({ ...body, papel: 'OLHEIRO', categoria_ids: [9], acesso_todas_categorias: true })).status, 201);
    assert.equal(writes[2].papel, 'OLHEIRO');
    assert.equal(writes[2].acesso_todas_categorias, false);
    assert.deepEqual(writes[2].categorias.create, []);
    assert.equal((await post({ ...body, email: '' })).status, 201);
    assert.equal(writes[3].email, '');
    const originalSender = process.env.EMAIL_FROM;
    delete process.env.EMAIL_FROM;
    t.after(() => { if (originalSender === undefined) delete process.env.EMAIL_FROM; else process.env.EMAIL_FROM = originalSender; });
    t.mock.method(console, 'error', () => {});
    const emailed = await post({ ...body, entrega: 'email' });
    assert.equal(emailed.status, 201);
    const emailedResult: any = await emailed.json();
    assert.match(emailedResult.codigo, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.equal(writes[4].codigo_hash, gerarHashCodigoConvite(emailedResult.codigo));
    assert.equal(emailedResult.email_enviado, false);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
