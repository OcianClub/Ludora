import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { JWT_OPTIONS, JWT_SECRET } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { criarAdminRoutes } from '../src/modules/admin/admin.routes';
import authRoutes from '../src/modules/auth/auth.routes';

test('SUPERADMIN persistido é global, não pode ser adquirido por perfil ou claim do token', async t => {
  const previousAllowlist = process.env.SUPERADMIN_EMAILS;
  process.env.SUPERADMIN_EMAILS = '';
  t.after(() => {
    if (previousAllowlist === undefined) delete process.env.SUPERADMIN_EMAILS;
    else process.env.SUPERADMIN_EMAILS = previousAllowlist;
  });
  const accounts: Record<number, any> = {
    1: { id: 1, nome: 'Dev', email: 'dev@example.test', papel_plataforma: 'SUPERADMIN', versao_sessao: 0, clubes: [] },
    2: { id: 2, nome: 'Gestor', email: 'gestor@example.test', papel_plataforma: 'USUARIO', versao_sessao: 0, clubes: [{ papel: 'ADMIN' }] },
  };
  const beforeFind = prisma.usuario.findUnique;
  const beforeUpdate = prisma.usuario.update;
  t.after(() => {
    prisma.usuario.findUnique = beforeFind;
    prisma.usuario.update = beforeUpdate;
  });
  prisma.usuario.findUnique = (async ({ where }: any) => accounts[where.id] || null) as any;
  let update: any;
  prisma.usuario.update = (async ({ where, data }: any) => {
    update = data;
    return { ...accounts[where.id], ...data };
  }) as any;
  const app = express();
  app.use(express.json(), authRoutes, criarAdminRoutes(new Server()));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers = (id: number) => ({
    Authorization: `Bearer ${jwt.sign({ id, versao_sessao: 0, papel_plataforma: 'SUPERADMIN' }, JWT_SECRET, JWT_OPTIONS)}`,
    'Content-Type': 'application/json',
  });

  await t.test('usuário SUPERADMIN sem vínculo de clube ou allowlist acessa o desktop', async () => {
    const response = await fetch(`${base}/admin/me`, { headers: headers(1) });
    assert.equal(response.status, 200);
    const body: any = await response.json();
    assert.equal(body.superadmin, true);
    assert.equal(body.usuario.papel_plataforma, 'SUPERADMIN');
  });
  await t.test('ADMIN de clube e token com claim SUPERADMIN não concedem papel global', async () => {
    assert.equal((await fetch(`${base}/admin/me`, { headers: headers(2) })).status, 403);
  });
  await t.test('PATCH do próprio perfil não altera papel mesmo com campos forjados', async () => {
    const response = await fetch(`${base}/usuarios/me`, {
      method: 'PATCH', headers: headers(2),
      body: JSON.stringify({ nome: 'Gestor', email: 'gestor@example.test', papel_plataforma: 'SUPERADMIN', superadmin: true, papel: 'SUPERADMIN' }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(update, { nome: 'Gestor', email: 'gestor@example.test' });
    assert.equal((await fetch(`${base}/admin/me`, { headers: headers(2) })).status, 403);
  });
  await t.test('perfil expõe o papel efetivo sem conceder cargos em clubes', async () => {
    const response = await fetch(`${base}/usuarios/me`, { headers: headers(1) });
    assert.equal(response.status, 200);
    const body: any = await response.json();
    assert.equal(body.papel_plataforma, 'SUPERADMIN');
    assert.deepEqual(body.clubes, []);
  });
  await t.test('retirada do papel no banco bloqueia a próxima requisição com o mesmo token', async () => {
    accounts[1].papel_plataforma = 'USUARIO';
    assert.equal((await fetch(`${base}/admin/me`, { headers: headers(1) })).status, 403);
  });
});
