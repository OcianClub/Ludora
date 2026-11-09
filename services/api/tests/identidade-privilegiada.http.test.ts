import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import express from 'express';
import jwt from 'jsonwebtoken';

import { JWT_OPTIONS, JWT_SECRET } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import authRoutes from '../src/modules/auth/auth.routes';
import conviteRoutes from '../src/modules/convites/convite-publico.routes';

test('identidades privilegiadas não podem ser adotadas sem confirmação de e-mail', async t => {
  const previousAllowlist = process.env.SUPERADMIN_EMAILS;
  process.env.SUPERADMIN_EMAILS = '  EQUIPE@LUDORA.TEST  ';
  t.after(() => {
    if (previousAllowlist === undefined) delete process.env.SUPERADMIN_EMAILS;
    else process.env.SUPERADMIN_EMAILS = previousAllowlist;
  });

  let currentEmail = 'pessoa@example.test';
  let invitationEmail = 'equipe@ludora.test';
  let updates = 0;
  let transactions = 0;
  function replace(target: any, key: string, value: any) {
    const previous = target[key];
    target[key] = value;
    t.after(() => { target[key] = previous; });
  }
  replace(prisma.clube, 'count', async () => 0);
  replace(prisma.manutencao, 'findFirst', async () => null);
  replace(prisma.usuario, 'findUnique', async ({ where }: any) =>
    where.id ? { id: 1, email: currentEmail, versao_sessao: 0 } : null
  );
  replace(prisma.usuario, 'update', async ({ data }: any) => {
    updates++;
    return { id: 1, ...data, criadoEm: new Date() };
  });
  replace(prisma.conviteClube, 'findUnique', async () => ({
    id: 'convite', email: invitationEmail, clube_id: 2, papel: 'TECNICO',
    status: 'PENDENTE', expira_em: new Date(Date.now() + 60_000), categorias: [],
  }));
  replace(prisma, '$transaction', async () => { transactions++; throw new Error('Não deve gravar'); });

  const app = express();
  app.use(express.json(), authRoutes, conviteRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const token = jwt.sign({ id: 1, versao_sessao: 0 }, JWT_SECRET, JWT_OPTIONS);
  const patch = (email: string, senha?: string) => fetch(`${base}/usuarios/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ nome: 'Pessoa', email, ...(senha ? { senha } : {}) }),
  });
  const accept = (senha: string) => fetch(`${base}/convites/codigo/ABCD-2345/aceitar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: 'Pessoa', senha }),
  });

  await t.test('mudança de e-mail não concede acesso à plataforma, inclusive com caixa/espaços', async () => {
    assert.equal((await patch(' EQUIPE@LUDORA.TEST ')).status, 403);
    assert.equal(updates, 0);
  });
  await t.test('super admin existente pode manter seu próprio e-mail; demais perfis continuam editáveis', async () => {
    assert.equal((await patch('pessoa@example.test')).status, 200);
    currentEmail = 'equipe@ludora.test';
    assert.equal((await patch('equipe@ludora.test')).status, 200);
    currentEmail = 'pessoa@example.test';
    assert.equal(updates, 2);
  });
  await t.test('convite vinculado não cria identidade privilegiada sem comprovar a caixa de e-mail', async () => {
    const response = await accept('senha1234');
    assert.equal(response.status, 409);
    assert.equal((await response.json()).codigo, 'CONTA_EXISTENTE');
    assert.equal(transactions, 0);
  });
  await t.test('senhas multibyte acima de 72 bytes não sofrem truncamento silencioso do bcrypt', async () => {
    invitationEmail = 'pessoa@example.test';
    const password = 'á'.repeat(37);
    assert.equal((await patch('pessoa@example.test', password)).status, 400);
    assert.equal((await accept(password)).status, 400);
    assert.equal(transactions, 0);
    assert.equal(updates, 2);
  });
});
