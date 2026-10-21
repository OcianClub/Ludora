import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Prisma } from '@prisma/client';
import { consultarListaPartidas } from '../src/modules/partidas/partidas-lista.service';

test('lista leve omite eventos, mantém filtros e escopo; resposta padrão preserva eventos', async () => {
  const consultas: any[] = [];
  const banco = {
    categoria: {
      async findFirst() {
        return { faixaIdade: 7 };
      },
    },
    partida: {
      async findMany(args: any) {
        consultas.push(args);
        return [
          {
            id: 1,
            categoria: { clube_id: 2 },
            emCasa: true,
            mandante: {
              id: 1,
              nome: 'Clube',
              escudo: null,
              clube_representado_id: 2,
            },
            visitante: {
              id: 2,
              nome: 'Visitante',
              escudo: null,
              clube_representado_id: 3,
            },
            gols_mandante: 2,
            gols_visitante: 1,
            ...(args.include?.eventos
              ? { eventos: [{ id: 9, tipo: 'GOL' }] }
              : {}),
          },
        ];
      },
    },
  } as unknown as Pick<Prisma.TransactionClient, 'partida' | 'categoria'>;
  const leve = await consultarListaPartidas(banco, 2, {
    resumo: '1',
    categoria_id: '9',
    status: 'AO_VIVO',
    competicao_id: '8',
    mes: '10',
  });
  assert.equal(leve[0].somente_leitura, false);
  assert.equal(leve[0].emCasa, true);
  assert.equal('eventos' in leve[0], false);
  assert.deepEqual(consultas[0].where, {
    OR: [
      { categoria: { clube_id: 2 } },
      { mandante: { clube_representado_id: 2 } },
      { visitante: { clube_representado_id: 2 } },
    ],
    AND: [{ categoria: { faixaIdade: 7 } }],
    status: 'AO_VIVO',
    competicao_id: 8,
    data: {
      gte: new Date(Date.UTC(new Date().getFullYear(), 9, 1)),
      lt: new Date(Date.UTC(new Date().getFullYear(), 10, 1)),
    },
  });
  assert.equal(consultas[0].select.eventos, undefined);
  assert.equal(consultas[0].include, undefined);
  assert.equal(consultas[0].select.mandante.select.categoria_id, undefined);
  assert.deepEqual(leve[0].mandante, { id: 1, nome: 'Clube', escudo: null });
  assert.deepEqual(consultas[0].orderBy, { data: 'asc' });
  const padrao = await consultarListaPartidas(banco, 3, {});
  assert.deepEqual((padrao[0] as any).eventos, [{ id: 9, tipo: 'GOL' }]);
  assert.equal(consultas[1].where.OR[0].categoria.clube_id, 3);
  assert.equal(padrao[0].emCasa, false);
  assert.equal(padrao[0].somente_leitura, true);
  assert.equal(consultas[1].include.eventos, true);
  await consultarListaPartidas(banco, 3, { resumo: '0' });
  assert.equal(consultas[2].include.eventos, true);
});
