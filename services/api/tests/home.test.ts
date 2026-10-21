import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { Prisma } from '@prisma/client';
import {
  consultarHome,
  dataHomeValida,
} from '../src/modules/partidas/home.service';
import { criarHomeRoutes } from '../src/modules/partidas/home.routes';

test('Home valida data real e escopo antes de consultar o banco', async () => {
  for (const valor of [
    undefined,
    [],
    '2026-02-30',
    '2026-13-01',
    '2026-1-01',
    '2026-10-20; DROP TABLE',
  ]) {
    assert.equal(dataHomeValida(valor), false);
  }
  assert.equal(dataHomeValida('2024-02-29'), true);
  assert.equal(dataHomeValida('2026-10-20'), true);
  let chamadas = 0;
  const banco = {
    $queryRaw: async () => {
      chamadas++;
      return [];
    },
  } as unknown as Pick<Prisma.TransactionClient, '$queryRaw'>;
  await assert.rejects(consultarHome(banco, 0, '2026-10-20'), /inválido/);
  await assert.rejects(consultarHome(banco, 1, '2026-02-30'), /inválido/);
  assert.equal(chamadas, 0);
});

test('Home faz uma única consulta parametrizada, limita por categoria e considera clubes representados', async () => {
  const consultas: Prisma.Sql[] = [];
  const esperado = [{ id: 7, somente_leitura: true, clube_origem_id: 2 }];
  const banco = {
    $queryRaw: async (sql: Prisma.Sql) => {
      consultas.push(sql);
      return esperado;
    },
  } as unknown as Pick<Prisma.TransactionClient, '$queryRaw'>;
  assert.deepEqual(await consultarHome(banco, 4321, '2026-10-20'), esperado);
  assert.equal(consultas.length, 1);
  const sql = consultas[0];
  assert.ok(sql.values.includes(4321));
  assert.equal(
    sql.values.some(
      (valor) =>
        valor instanceof Date && valor.toISOString().startsWith('2026-10-20')
    ),
    true
  );
  assert.doesNotMatch(sql.text, /4321|2026-10-20/);
  assert.match(sql.text, /PARTITION BY categoria, grupo/);
  assert.match(sql.text, /historico' AND posicao <= 5/);
  assert.match(sql.text, /ao_vivo' AND posicao = 1/);
  assert.match(sql.text, /agenda' AND posicao <= 3/);
  assert.match(sql.text, /m\.clube_representado_id/);
  assert.match(sql.text, /v\.clube_representado_id/);
  assert.match(sql.text, /somente_leitura/);
  assert.doesNotMatch(sql.text, /"Evento"|"Jogador"|senha|cpf|email/);
});

test('rota da Home mantém autenticação, validação e erros sem interceptar detalhes por ID', async () => {
  const chamadas: unknown[][] = [];
  const app = express();
  app.use(
    criarHomeRoutes(
      (req, res, next) => {
        if (req.headers.authorization !== 'Bearer teste') {
          res.sendStatus(401);
          return;
        }
        (req as typeof req & { clubeId: number }).clubeId = 3;
        next();
      },
      async (clubeId, hoje) => {
        chamadas.push([clubeId, hoje]);
        if (hoje === '2026-10-21')
          throw new Error('Informação interna do banco');
        return [{ id: 7, somente_leitura: true }];
      }
    )
  );
  app.get('/partidas/:id', (req, res) => {
    res.json({ id: req.params.id });
  });
  const servidor = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => servidor.once('listening', resolve));
  const endereco = servidor.address();
  assert.ok(endereco && typeof endereco === 'object');
  const base = `http://127.0.0.1:${endereco.port}`;
  const headers = { Authorization: 'Bearer teste' };
  try {
    assert.equal(
      (await fetch(`${base}/partidas/home?hoje=2026-10-20`)).status,
      401
    );
    assert.equal(
      (await fetch(`${base}/partidas/home?hoje=2026-02-30`, { headers }))
        .status,
      400
    );
    assert.equal(chamadas.length, 0);
    const resposta = await fetch(`${base}/partidas/home?hoje=2026-10-20`, {
      headers,
    });
    assert.equal(resposta.status, 200);
    assert.deepEqual(await resposta.json(), [{ id: 7, somente_leitura: true }]);
    assert.deepEqual(chamadas, [[3, '2026-10-20']]);
    const falha = await fetch(`${base}/partidas/home?hoje=2026-10-21`, {
      headers,
    });
    assert.equal(falha.status, 500);
    assert.deepEqual(await falha.json(), {
      error: 'Erro ao buscar resumo do clube',
    });
    assert.deepEqual(await (await fetch(`${base}/partidas/7`)).json(), {
      id: '7',
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      servidor.close((erro) => (erro ? reject(erro) : resolve()))
    );
  }
});
