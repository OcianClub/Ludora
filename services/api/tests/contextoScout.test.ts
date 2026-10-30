import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Prisma } from '@prisma/client';
import { consultarContextoScout } from '../src/modules/jogadores/contexto-scout.service';

test('histórico limita a dez finalizadas, mantém clube/categorias e conta só eventos do atleta', async () => {
  const chamadas: any[] = [];
  const tx = {
    jogador: {
      async findFirst(args: any) {
        chamadas.push(args);
        return { id: 12 };
      },
    },
    partida: {
      async count(args: any) {
        chamadas.push(args);
        return 25;
      },
      async findMany(args: any) {
        chamadas.push(args);
        return [
          {
            id: 5,
            data: new Date('2026-10-19T00:00:00Z'),
            emCasa: true, participantes: [],
            mandante: { nome: 'Ludora' },
            visitante: { nome: 'Visitante' },
            eventos: [
              { tipo: 'GOL' },
              { tipo: 'GOL' },
              { tipo: 'DEFESA' },
              { tipo: 'CARTAO_AMARELO' },
            ],
          },
          {
            id: 4,
            data: new Date('2026-10-18T00:00:00Z'),
            emCasa: false, participantes: [],
            mandante: { nome: 'Mandante' },
            visitante: { nome: 'Ludora' },
            eventos: [],
          },
        ];
      },
    },
  } as unknown as Prisma.TransactionClient;
  const resultado = await consultarContextoScout(tx, 12, 3, [7]);
  assert.deepEqual(chamadas[0].where, {
    id: 12,
    ativo: true,
    categoria: { clube_id: 3 },
    categoria_id: { in: [7] },
  });
  assert.deepEqual(chamadas[1].where, chamadas[2].where);
  assert.equal(chamadas[2].where.status, 'FINALIZADA');
  assert.deepEqual(chamadas[2].where.AND[0].OR[0].categoria, { clube_id: 3 });
  assert.deepEqual(chamadas[2].where.AND[0].OR[0].categoria_id, { in: [7] });
  assert.deepEqual(chamadas[2].where.OR, [
    { jogadores_escalonados: { some: { jogador_id: 12 } } },
    { eventos: { some: { jogador_id: 12 } } },
  ]);
  assert.deepEqual(chamadas[2].where.AND[0].OR[1], { participantes: { some: { clube_id: 3, categoria_id: { in: [7] } } } });
  assert.equal(chamadas[2].take, 10);
  assert.deepEqual(chamadas[2].select.eventos, {
    where: { jogador_id: 12, gol_contra: false },
    select: { tipo: true },
  });
  assert.equal(chamadas[0].select.cpf, undefined);
  assert.equal(resultado?.total_partidas, 25);
  assert.deepEqual(resultado?.partidas[0], {
    id: 5,
    data: '2026-10-19',
    adversario: 'Visitante',
    gols: 2,
    assistencias: 0,
    defesas: 1,
  });
  assert.equal(resultado?.partidas[1].adversario, 'Mandante');
  assert.equal(resultado?.partidas[1].gols, 0);
});

test('atleta fora do escopo não dispara leitura de partidas; lista de categorias vazia nunca vira acesso total', async () => {
  let consulta: any;
  const tx = {
    jogador: {
      async findFirst(args: any) {
        consulta = args;
        return null;
      },
    },
    partida: {
      async count() {
        throw new Error('Não deveria consultar');
      },
    },
  } as unknown as Prisma.TransactionClient;
  assert.equal(await consultarContextoScout(tx, 10, 8, []), null);
  assert.deepEqual(consulta.where.categoria_id, { in: [] });
  assert.equal(await consultarContextoScout(tx, 10, 8, null), null);
  assert.equal(consulta.where.categoria_id, undefined);
});
