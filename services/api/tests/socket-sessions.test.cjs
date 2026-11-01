const assert = require('node:assert/strict');
const { once } = require('node:events');
const { test } = require('node:test');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'teste-local-de-sessoes-sem-acesso-ao-banco';
const express = require('express');
const jwt = require('jsonwebtoken');
const { io: connect } = require('../../../apps/web/node_modules/socket.io-client');
const { JWT_SECRET, JWT_OPTIONS } = require('../dist/src/config/env');
const { prisma } = require('../dist/src/lib/prisma');
const { criarSocketServer } = require('../dist/src/realtime/socket');
const { criarAdminRoutes } = require('../dist/src/modules/admin/admin.routes');

test('revogação encerra conexões existentes de usuário e painel; expiração encerra o socket', async t => {
  const previousAllowlist = process.env.SUPERADMIN_EMAILS;
  process.env.SUPERADMIN_EMAILS = 'admin1@teste.local,admin2@teste.local';
  t.after(() => {
    if (previousAllowlist === undefined) delete process.env.SUPERADMIN_EMAILS;
    else process.env.SUPERADMIN_EMAILS = previousAllowlist;
  });
  const versions = { 1: 0, 2: 0 };
  function replace(target, key, value) {
    const previous = target[key];
    target[key] = value;
    t.after(() => { target[key] = previous; });
  }
  replace(prisma.usuario, 'findUnique', async ({ where }) =>
    versions[where.id] === undefined ? null : {
      id: where.id, email: `admin${where.id}@teste.local`, nome: 'Admin', versao_sessao: versions[where.id],
    }
  );
  replace(prisma.usuario, 'update', async ({ where }) => { versions[where.id]++; return { id: where.id }; });
  replace(prisma.clube, 'findUnique', async () => ({ id: 3 }));
  const io = criarSocketServer();
  const app = express();
  app.use(express.json(), criarAdminRoutes(io));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  io.attach(server);
  t.after(() => new Promise(resolve => io.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = (id, options = JWT_OPTIONS) => jwt.sign({ id, versao_sessao: versions[id] }, JWT_SECRET, options);
  async function client(id, namespace = '', value = token(id)) {
    const socket = connect(base + namespace, {
      auth: { token: value, clubeId: 3 }, transports: ['websocket'], forceNew: true, reconnection: false,
    });
    t.after(() => socket.close());
    await once(socket, 'connect');
    return socket;
  }

  const current = await client(1);
  const target = await client(2);
  const admin = await client(2, '/admin');
  const targetDisconnected = once(target, 'disconnect');
  const adminDisconnected = once(admin, 'disconnect');
  const response = await fetch(`${base}/admin/usuarios/2/revogar-sessoes`, {
    method: 'POST', headers: { Authorization: `Bearer ${token(1)}` },
  });
  assert.equal(response.status, 200);
  await Promise.all([targetDisconnected, adminDisconnected]);
  assert.equal(target.connected, false);
  assert.equal(admin.connected, false);
  assert.equal(current.connected, true, 'revogação não encerra outros usuários');
  assert.equal(versions[2], 1);

  const short = token(1, { ...JWT_OPTIONS, expiresIn: 2 });
  const expiring = await client(1, '', short);
  const expired = await once(expiring, 'disconnect');
  assert.equal(expired[0], 'io server disconnect');
  assert.equal(expiring.connected, false);
  assert.equal(current.connected, true);
});
