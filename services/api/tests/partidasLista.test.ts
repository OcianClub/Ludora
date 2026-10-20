import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Prisma } from '@prisma/client';
import { consultarListaPartidas } from '../src/modules/partidas/partidas-lista.service';

test('lista leve omite eventos, mantém filtros e escopo; resposta padrão preserva eventos', async () => {
  const consultas: any[] = [];
  const banco = {
    partida: {
      async findMany(args: any) {
        consultas.push(args);
        return [
          {
            id: 1,
            gols_mandante: 2,
            gols_visitante: 1,
            ...(args.include.eventos
              ? { eventos: [{ id: 9, tipo: 'GOL' }] }
              : {}),
          },
        ];
      },
    },
  } as unknown as Pick<Prisma.TransactionClient, 'partida'>;
  const leve = await consultarListaPartidas(banco, 2, {
    resumo: '1',
    categoria_id: '9',
    status: 'AO_VIVO',
    competicao_id: '8',
    mes: '10',
  });
  assert.deepEqual(leve, [{ id: 1, gols_mandante: 2, gols_visitante: 1 }]);
  assert.deepEqual(consultas[0].where, {
    categoria: { clube_id: 2 },
    categoria_id: 9,
    status: 'AO_VIVO',
    competicao_id: 8,
    data: {
      gte: new Date(Date.UTC(new Date().getFullYear(), 9, 1)),
      lt: new Date(Date.UTC(new Date().getFullYear(), 10, 1)),
    },
  });
  assert.equal(consultas[0].include.eventos, false);
  assert.deepEqual(consultas[0].orderBy, { data: 'asc' });
  const padrao = await consultarListaPartidas(banco, 3, {});
  assert.deepEqual((padrao[0] as any).eventos, [{ id: 9, tipo: 'GOL' }]);
  assert.equal(consultas[1].where.categoria.clube_id, 3);
  assert.equal(consultas[1].include.eventos, true);
  await consultarListaPartidas(banco, 3, { resumo: '0' });
  assert.equal(consultas[2].include.eventos, true);
});
