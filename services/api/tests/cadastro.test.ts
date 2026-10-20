import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import * as bcrypt from 'bcrypt';
import type { PrismaClient } from '@prisma/client';
import { hashCodigoCadastro } from '../src/modules/auth/cadastro.utils';
import { hashCodigoRecuperacao } from '../src/modules/auth/recuperacao.utils';

test('o código de cadastro não pode ser usado em outro desafio ou recuperação', () => {
  const hash = hashCodigoCadastro('desafio-a', 'ABCD-2345', 'segredo');
  assert.equal(hash, hashCodigoCadastro('desafio-a', 'abcd2345', 'segredo'));
  assert.notEqual(hash, hashCodigoCadastro('desafio-b', 'ABCD2345', 'segredo'));
  assert.notEqual(hash, hashCodigoRecuperacao(1, 'ABCD2345', 'segredo'));
});

test('cadastro exige e-mail confirmado e protege reenvio, tentativas e consumo único', async (t) => {
  process.env.JWT_SECRET ||= 'segredo-exclusivo-dos-testes-de-cadastro';
  process.env.RESEND_API_KEY ||= 'teste-sem-envio';
  process.env.EMAIL_FROM ||= 'teste@exemplo.com';
  const { criarCadastroRoutes } = await import(
    '../src/modules/auth/cadastro.routes.js'
  );
  let registro: any = null;
  let usuario: any = null;
  let senhaSalva = '';
  let falharEnvio = false;
  const enviados: string[] = [];
  const corresponde = (where: any) =>
    registro &&
    (!where.email || where.email === registro.email) &&
    (!where.desafio || where.desafio === registro.desafio) &&
    (!where.codigo_hash || where.codigo_hash === registro.codigo_hash) &&
    (!where.criado_em || registro.criado_em <= where.criado_em.lte) &&
    (!where.expira_em || registro.expira_em > where.expira_em.gt) &&
    (!where.tentativas || registro.tentativas < where.tentativas.lt);
  const banco = {
    usuario: {
      async findUnique({ where }: any) {
        return usuario?.email === where.email ? usuario : null;
      },
      async create({ data }: any) {
        senhaSalva = data.senha;
        usuario = { id: 1, ...data };
        return { id: 1 };
      },
    },
    confirmacaoCadastro: {
      async updateMany({ where, data }: any) {
        if (!corresponde(where)) return { count: 0 };
        if (data.tentativas?.increment)
          registro.tentativas += data.tentativas.increment;
        else Object.assign(registro, data);
        return { count: 1 };
      },
      async createMany({ data }: any) {
        if (registro) return { count: 0 };
        registro = { ...data };
        return { count: 1 };
      },
      async findFirst({ where }: any) {
        return corresponde(where) ? { ...registro } : null;
      },
      async deleteMany({ where }: any) {
        if (!corresponde(where)) return { count: 0 };
        registro = null;
        return { count: 1 };
      },
    },
    async $transaction(operacao: any) {
      return operacao(banco);
    },
  } as unknown as PrismaClient;
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(
    criarCadastroRoutes(async (_email, codigo) => {
      if (falharEnvio) throw new Error('Falha simulada');
      enviados.push(codigo);
    }, banco)
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
  const post = (rota: string, dados: object, ip = '127.0.0.20') =>
    fetch(`http://127.0.0.1:${endereco.port}${rota}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify(dados),
    });
  const solicitar = (email = 'nova@exemplo.com') =>
    post('/auth/cadastro/solicitar-codigo', { email });
  const conta = {
    nome: 'Pessoa Teste',
    email: 'nova@exemplo.com',
    senha: 'Senha-segura-123',
  };
  assert.equal((await post('/auth/registrar', conta)).status, 400);
  assert.equal(usuario, null);
  const pedido = await solicitar();
  assert.equal(pedido.status, 202);
  const desafio = (await pedido.json()).cadastro_id;
  assert.equal(enviados.length, 1);
  assert.notEqual(registro.codigo_hash, enviados[0]);
  assert.equal(usuario, null);
  assert.equal((await solicitar()).status, 429);
  assert.equal(enviados.length, 1);
  const confirmar = (alteracoes = {}) =>
    post('/auth/registrar', {
      ...conta,
      codigo: enviados.at(-1),
      cadastro_id: desafio,
      ...alteracoes,
    });
  registro.expira_em = new Date(Date.now() - 1);
  assert.equal((await confirmar()).status, 400);
  registro.expira_em = new Date(Date.now() + 60_000);
  assert.equal((await confirmar({ email: 'outra@exemplo.com' })).status, 400);
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    assert.equal((await confirmar({ codigo: 'ZZZZZZZZ' })).status, 400);
  }
  assert.equal(registro.tentativas, 5);
  assert.equal((await confirmar()).status, 400);
  assert.equal(usuario, null);
  registro.criado_em = new Date(Date.now() - 61_000);
  const renovado = await solicitar();
  const novoDesafio = (await renovado.json()).cadastro_id;
  assert.notEqual(novoDesafio, desafio);
  assert.equal((await confirmar()).status, 400);
  const resultados = await Promise.all([
    confirmar({ cadastro_id: novoDesafio }),
    confirmar({ cadastro_id: novoDesafio }),
  ]);
  assert.deepEqual(resultados.map((r) => r.status).sort(), [201, 400]);
  assert.ok(usuario);
  assert.equal(await bcrypt.compare(conta.senha, senhaSalva), true);
  assert.equal((await confirmar({ cadastro_id: novoDesafio })).status, 400);
  assert.equal((await solicitar()).status, 409);

  usuario = null;
  falharEnvio = true;
  assert.equal((await solicitar()).status, 503);
  assert.equal(registro, null);
  falharEnvio = false;
  assert.equal((await solicitar()).status, 202);

  for (let indice = 0; indice < 20; indice++) {
    assert.equal(
      (
        await post(
          '/auth/cadastro/solicitar-codigo',
          { email: 'invalido' },
          '127.0.0.21'
        )
      ).status,
      400
    );
  }
  assert.equal(
    (
      await post(
        '/auth/cadastro/solicitar-codigo',
        { email: 'invalido' },
        '127.0.0.21'
      )
    ).status,
    429
  );
});
