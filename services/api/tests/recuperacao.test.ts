import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { Server } from 'socket.io';
import type { PrismaClient } from '@prisma/client';
import {
  codigoRecuperacaoValido,
  gerarCodigoRecuperacao,
  hashCodigoRecuperacao,
  hashesRecuperacaoIguais,
} from '../src/modules/auth/recuperacao.utils';

test('códigos são normalizados e o hash é vinculado à conta', () => {
  for (let indice = 0; indice < 30; indice++) {
    assert.equal(codigoRecuperacaoValido(gerarCodigoRecuperacao()), true);
  }
  const hash = hashCodigoRecuperacao(1, 'ABCD-2345', 'segredo-teste');
  assert.equal(hash, hashCodigoRecuperacao(1, 'abcd 2345', 'segredo-teste'));
  assert.notEqual(hash, hashCodigoRecuperacao(2, 'ABCD2345', 'segredo-teste'));
  assert.equal(hashesRecuperacaoIguais(hash, hash), true);
  assert.equal(hashesRecuperacaoIguais(hash, 'invalido'), false);
  assert.equal(codigoRecuperacaoValido('00000000'), false);
});

test('rotas protegem expiração, tentativas, consumo concorrente e sessões antigas', async (t) => {
  process.env.JWT_SECRET ||= 'segredo-exclusivo-dos-testes-de-recuperacao';
  process.env.RESEND_API_KEY ||= 'teste-sem-envio';
  process.env.EMAIL_FROM ||= 'teste@exemplo.com';
  const { JWT_SECRET, JWT_OPTIONS } = await import('../src/config/env.js');
  const { getUsuarioIdPeloToken } = await import('../src/auth/jwt.js');
  const { criarRecuperacaoRoutes } = await import(
    '../src/modules/auth/recuperacao.routes.js'
  );
  const banco = {
    usuario: { findUnique() {}, update() {} },
    recuperacaoSenha: { createMany() {}, updateMany() {}, findFirst() {} },
    $transaction() {},
  } as unknown as PrismaClient;

  let registro: any = null;
  let versao = 0;
  let senhaSalva = '';
  const codigos: string[] = [];
  let desconexoes = 0;

  t.mock.method(banco.usuario, 'findUnique', async (args: any) => {
    if (args.where.email === 'ausente@exemplo.com') return null;
    return { id: 1, versao_sessao: versao };
  });
  t.mock.method(banco.recuperacaoSenha, 'createMany', async ({ data }: any) => {
    if (registro) return { count: 0 };
    registro = { id: 'recuperacao-teste', ...data };
    return { count: 1 };
  });
  t.mock.method(
    banco.recuperacaoSenha,
    'updateMany',
    async ({ where, data }: any) => {
      if (
        !registro ||
        (where.codigo_hash && where.codigo_hash !== registro.codigo_hash) ||
        (where.usado_em === null && registro.usado_em !== null) ||
        (where.criado_em && registro.criado_em > where.criado_em.lte) ||
        (where.expira_em && registro.expira_em <= where.expira_em.gt) ||
        (where.tentativas && registro.tentativas >= where.tentativas.lt)
      ) {
        return { count: 0 };
      }
      if (data.tentativas?.increment)
        registro.tentativas += data.tentativas.increment;
      else Object.assign(registro, data);
      return { count: 1 };
    }
  );
  t.mock.method(banco.recuperacaoSenha, 'findFirst', async () => {
    if (
      !registro ||
      registro.usado_em ||
      registro.expira_em <= new Date() ||
      registro.tentativas >= 5
    )
      return null;
    return { ...registro };
  });
  t.mock.method(banco.usuario, 'update', async ({ data }: any) => {
    senhaSalva = data.senha;
    versao += data.versao_sessao.increment;
    return { id: 1 };
  });
  t.mock.method(banco, '$transaction', async (operacao: any) =>
    operacao(banco)
  );

  const io = {
    in: () => ({
      disconnectSockets: () => {
        desconexoes += 1;
      },
    }),
  } as unknown as Server;
  const app = express();
  app.use(express.json());
  app.use(
    criarRecuperacaoRoutes(
      io,
      async (_email, codigo) => {
        codigos.push(codigo);
      },
      banco
    )
  );
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const endereco = server.address();
  assert.ok(endereco && typeof endereco !== 'string');
  const post = (rota: string, body: object) =>
    fetch(`http://127.0.0.1:${endereco.port}${rota}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const email = 'pessoa@exemplo.com';
  const ausente = await post('/auth/recuperar-senha', {
    email: 'ausente@exemplo.com',
  });
  const existente = await post('/auth/recuperar-senha', { email });
  assert.equal(ausente.status, 202);
  assert.equal(existente.status, 202);
  assert.deepEqual(await ausente.json(), await existente.json());
  assert.equal(codigos.length, 1);
  assert.notEqual(registro.codigo_hash, codigos[0]);
  await post('/auth/recuperar-senha', { email });
  assert.equal(codigos.length, 1);

  const dados = { email, codigo: codigos[0], senha: 'Senha-nova-123' };
  const incorreto = await post('/auth/redefinir-senha', {
    ...dados,
    codigo: 'ZZZZZZZZ',
  });
  assert.equal(incorreto.status, 400);
  assert.equal(registro.tentativas, 1);
  registro.expira_em = new Date(Date.now() - 1);
  assert.equal((await post('/auth/redefinir-senha', dados)).status, 400);
  assert.equal(senhaSalva, '');
  registro.expira_em = new Date(Date.now() + 60_000);

  const tokenAntigo = jwt.sign({ id: 1 }, JWT_SECRET, JWT_OPTIONS);
  assert.equal(await getUsuarioIdPeloToken(tokenAntigo, banco), 1);
  const resultados = await Promise.all([
    post('/auth/redefinir-senha', dados),
    post('/auth/redefinir-senha', dados),
  ]);
  assert.deepEqual(resultados.map((r) => r.status).sort(), [200, 400]);
  assert.equal(versao, 1);
  assert.equal(desconexoes, 1);
  assert.equal(await bcrypt.compare(dados.senha, senhaSalva), true);
  assert.equal((await post('/auth/redefinir-senha', dados)).status, 400);
  assert.equal(await getUsuarioIdPeloToken(tokenAntigo, banco), null);
  const tokenNovo = jwt.sign(
    { id: 1, versao_sessao: 1 },
    JWT_SECRET,
    JWT_OPTIONS
  );
  assert.equal(await getUsuarioIdPeloToken(tokenNovo, banco), 1);

  registro.usado_em = null;
  registro.tentativas = 4;
  assert.equal(
    (await post('/auth/redefinir-senha', { ...dados, codigo: 'ZZZZZZZZ' }))
      .status,
    400
  );
  assert.equal(registro.tentativas, 5);
  assert.equal((await post('/auth/redefinir-senha', dados)).status, 400);
});
