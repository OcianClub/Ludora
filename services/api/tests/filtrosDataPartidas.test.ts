import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Prisma } from '@prisma/client';
import {
  intervaloDataPartidas,
  FiltroDataInvalido,
} from '../src/modules/partidas/filtros-data.utils';
import { consultarListaPartidas } from '../src/modules/partidas/partidas-lista.service';

test('mês e ano geram intervalo UTC, incluindo dezembro e fevereiro bissexto', () => {
  assert.deepEqual(intervaloDataPartidas({ mes: '12', ano: '2025' }), {
    gte: new Date('2025-12-01T00:00:00.000Z'),
    lt: new Date('2026-01-01T00:00:00.000Z'),
  });
  const fevereiro = intervaloDataPartidas({ mes: 2, ano: 2024 })!;
  assert.equal(
    (fevereiro.lt.getTime() - fevereiro.gte.getTime()) / 86_400_000,
    29
  );
});

test('ano inteiro não mistura temporadas e mês sem ano preserva a compatibilidade', () => {
  assert.deepEqual(intervaloDataPartidas({ ano: '2023' }), {
    gte: new Date('2023-01-01T00:00:00.000Z'),
    lt: new Date('2024-01-01T00:00:00.000Z'),
  });
  assert.deepEqual(intervaloDataPartidas({ mes: '10' }, 2027), {
    gte: new Date('2027-10-01T00:00:00.000Z'),
    lt: new Date('2027-11-01T00:00:00.000Z'),
  });
  assert.equal(intervaloDataPartidas({}), undefined);
});

test('datas inválidas e parâmetros repetidos são recusados antes de consultar o banco', async () => {
  let consultas = 0;
  const banco = {
    partida: {
      findMany: async () => {
        consultas++;
        return [];
      },
    },
    categoria: {
      findFirst: async () => {
        consultas++;
        return null;
      },
    },
  } as unknown as Pick<Prisma.TransactionClient, 'partida' | 'categoria'>;
  for (const filtro of [
    { mes: '0' },
    { mes: '13' },
    { mes: ['1', '2'] },
    { mes: '' },
    { ano: 'abc' },
    { ano: '2026.5' },
    { ano: '2e3' },
    { ano: '1899' },
    { ano: '9999' },
    { ano: true },
    { ano: ['2025', '2026'] },
  ]) {
    await assert.rejects(
      consultarListaPartidas(banco, 7, filtro),
      FiltroDataInvalido
    );
  }
  assert.equal(consultas, 0);
});

test('filtragem por ano e status mantém escopo público e não carrega eventos na lista resumida', async () => {
  let consulta: any;
  const banco = {
    partida: {
      findMany: async (args: any) => {
        consulta = args;
        return [];
      },
    },
    categoria: {},
  } as unknown as Pick<Prisma.TransactionClient, 'partida' | 'categoria'>;
  await consultarListaPartidas(banco, 7, {
    ano: '2025',
    mes: '8',
    status: 'FINALIZADA',
    resumo: '1',
  });
  assert.deepEqual(consulta.where.data, {
    gte: new Date('2025-08-01T00:00:00.000Z'),
    lt: new Date('2025-09-01T00:00:00.000Z'),
  });
  assert.equal(consulta.where.status, 'FINALIZADA');
  assert.deepEqual(consulta.where.OR, [
    { categoria: { clube_id: 7 } },
    { mandante: { clube_representado_id: 7 } },
    { visitante: { clube_representado_id: 7 } },
  ]);
  assert.equal(consulta.select.eventos, undefined);
});
