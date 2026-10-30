import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Prisma } from '@prisma/client';
import { consultarPerfis } from '../src/modules/jogadores/perfis.service';

test('perfis usam agregação e contagem com o mesmo escopo de clube e categoria', async () => {
  const consultas: any[] = [];
  const jogador = {
    id: 12,
    nome: 'Atleta Teste',
    posicao: 'Ala',
    numCamisa: 7,
    dtNasc: new Date('2012-03-04T00:00:00Z'),
    perfil_ml: null,
    scores_ml: null,
    nota_geral: null,
    categoria_id: 2,
    categoria: { nome: 'sub-14', tipo: 'BASE' },
    _count: { escalacoes: 5 },
  };
  const tx = {
    jogador: {
      async findMany(args: any) {
        consultas.push(args);
        return [jogador];
      },
    },
    evento: {
      async groupBy(args: any) {
        consultas.push(args);
        return [
          { jogador_id: 12, tipo: 'GOL', _count: { _all: 4 } },
          { jogador_id: 12, tipo: 'DEFESA', _count: { _all: 9 } },
          { jogador_id: 12, tipo: 'ASSISTENCIA', _count: { _all: 2 } },
          { jogador_id: 12, tipo: 'CARTAO_AMARELO', _count: { _all: 1 } },
        ];
      },
    },
  } as unknown as Prisma.TransactionClient;
  const where = {
    ativo: true,
    categoria: { clube_id: 3 },
    categoria_id: { in: [2] },
  };
  const resultado = await consultarPerfis(tx, where);
  assert.deepEqual(consultas[0].where, where);
  assert.deepEqual(consultas[1].where, { jogador: { is: where }, gol_contra: false, partida: { status: { in: ['AO_VIVO', 'FINALIZADA'] } } });
  assert.deepEqual(consultas[1].by, ['jogador_id', 'tipo']);
  assert.equal(consultas[0].select.eventos, undefined);
  assert.equal(consultas[0].select.escalacoes, undefined);
  assert.equal(consultas[0].select.cpf, undefined);
  assert.deepEqual(consultas[0].select._count, {
    select: { escalacoes: { where: { partida: { status: { in: ['AO_VIVO', 'FINALIZADA'] } } } } },
  });
  assert.deepEqual(resultado[0], {
    id_jogador: 12,
    nome: 'Atleta Teste',
    posicao: 'Ala',
    numCamisa: 7,
    idade: new Date().getFullYear() - 2012,
    perfil_ml: 'Sem dados',
    scores_ml: null,
    nota_geral: 0,
    categoria: 'sub-14',
    categoria_tipo: 'BASE',
    categoria_id: 2,
    time: 'Clube',
    jogos_disputados: 5,
    gols: 4,
    assistencias: 2,
    defesas: 9,
    cartoes_amarelos: 1,
    cartoes_vermelhos: 0,
    faltas_cometidas: 0,
  });
});

test('clube sem atletas não executa a agregação de eventos', async () => {
  let agregacoes = 0;
  const tx = {
    jogador: {
      async findMany() {
        return [];
      },
    },
    evento: {
      async groupBy() {
        agregacoes++;
        return [];
      },
    },
  } as unknown as Prisma.TransactionClient;
  assert.deepEqual(
    await consultarPerfis(tx, { categoria: { clube_id: 999 } }),
    []
  );
  assert.equal(agregacoes, 0);
});
