import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Prisma } from '@prisma/client';
import {
  aplicarMudancaPlacar,
  ConflitoPartida,
  gravarEventoComPlacar,
  mudancaGolValida,
  placarValido,
  removerEventoComPlacar,
} from '../src/modules/partidas/placar.utils';

const zero = { gols_mandante: 0, gols_visitante: 0 };
const um = { gols_mandante: 1, gols_visitante: 0 };

test('placares e mudanças de gol respeitam limites e alteram somente um lado', () => {
  assert.equal(placarValido(zero), true);
  for (const invalido of [
    null,
    {},
    { ...zero, gols_mandante: -1 },
    { ...zero, gols_visitante: 100 },
    { ...zero, gols_mandante: 1.5 },
    { ...zero, gols_mandante: '1' },
  ]) {
    assert.equal(placarValido(invalido), false);
  }
  assert.equal(mudancaGolValida({ anterior: zero, novo: um }, 1), true);
  assert.equal(mudancaGolValida({ anterior: um, novo: zero }, -1), true);
  assert.equal(mudancaGolValida({ anterior: zero, novo: um }, -1), false);
  assert.equal(
    mudancaGolValida(
      { anterior: zero, novo: { gols_mandante: 1, gols_visitante: 1 } },
      1
    ),
    false
  );
  assert.equal(
    mudancaGolValida(
      { anterior: zero, novo: { ...zero, gols_mandante: 2 } },
      1
    ),
    false
  );
});

test('campos extras do cliente nunca alteram o ID, status ou categoria da partida', async () => {
  let consulta: any;
  const tx = {
    partida: {
      async updateMany(args: any) {
        consulta = args;
        return { count: 1 };
      },
    },
  } as unknown as Prisma.TransactionClient;
  await aplicarMudancaPlacar(tx, 7, {
    anterior: { ...zero, id: 999 } as typeof zero,
    novo: { ...um, status: 'FINALIZADA', categoria_id: 999 } as typeof um,
  });
  assert.deepEqual(consulta, { where: { id: 7, ...zero }, data: um });
});

function criarBancoSimulado() {
  let placar = { ...zero };
  let eventos: { id: number }[] = [];
  let falharEvento = false;
  const tx = {
    partida: {
      async updateMany({ where, data }: any) {
        if (
          where.gols_mandante !== placar.gols_mandante ||
          where.gols_visitante !== placar.gols_visitante
        )
          return { count: 0 };
        placar = { ...data };
        return { count: 1 };
      },
      async findUniqueOrThrow() {
        return { id: 7, ...placar };
      },
    },
    evento: {
      async create() {
        if (falharEvento) throw new Error('Falha simulada');
        const evento = { id: eventos.length + 1, jogador: null };
        eventos.push(evento);
        return evento;
      },
      async delete({ where }: any) {
        if (falharEvento || !eventos.some((evento) => evento.id === where.id))
          throw new Error('Falha simulada');
        eventos = eventos.filter((evento) => evento.id !== where.id);
      },
    },
  } as unknown as Prisma.TransactionClient;
  return {
    tx,
    estado: () => ({ placar, eventos }),
    falhar: (valor: boolean) => {
      falharEvento = valor;
    },
    async transacao<T>(
      operacao: (cliente: Prisma.TransactionClient) => Promise<T>
    ) {
      const anterior = { ...placar };
      const anteriores = [...eventos];
      try {
        return await operacao(tx);
      } catch (erro) {
        placar = anterior;
        eventos = anteriores;
        throw erro;
      }
    },
  };
}

test('gravação e remoção usam a mesma transação e retornam o placar confirmado', async () => {
  const banco = criarBancoSimulado();
  const resultado = await banco.transacao((tx) =>
    gravarEventoComPlacar(
      tx,
      { partida_id: 7, tipo: 'GOL', periodo: 1 },
      { anterior: zero, novo: um }
    )
  );
  assert.equal(resultado.evento.id, 1);
  assert.equal(resultado.partida?.gols_mandante, 1);
  assert.equal(banco.estado().eventos.length, 1);
  await banco.transacao((tx) =>
    removerEventoComPlacar(tx, 1, 7, { anterior: um, novo: zero })
  );
  assert.deepEqual(banco.estado(), { placar: zero, eventos: [] });
});

test('falha ao salvar ou remover evento desfaz a alteração do placar no adaptador transacional', async () => {
  const banco = criarBancoSimulado();
  banco.falhar(true);
  await assert.rejects(
    banco.transacao((tx) =>
      gravarEventoComPlacar(
        tx,
        { partida_id: 7, tipo: 'GOL', periodo: 1 },
        { anterior: zero, novo: um }
      )
    )
  );
  assert.deepEqual(banco.estado(), { placar: zero, eventos: [] });
  banco.falhar(false);
  await banco.transacao((tx) =>
    gravarEventoComPlacar(
      tx,
      { partida_id: 7, tipo: 'GOL', periodo: 1 },
      { anterior: zero, novo: um }
    )
  );
  banco.falhar(true);
  await assert.rejects(
    banco.transacao((tx) =>
      removerEventoComPlacar(tx, 1, 7, { anterior: um, novo: zero })
    )
  );
  assert.equal(banco.estado().placar.gols_mandante, 1);
  assert.equal(banco.estado().eventos.length, 1);
});

test('duas operações baseadas no mesmo placar não sobrescrevem uma à outra', async () => {
  const banco = criarBancoSimulado();
  const resultados = await Promise.allSettled([
    aplicarMudancaPlacar(banco.tx, 7, { anterior: zero, novo: um }),
    aplicarMudancaPlacar(banco.tx, 7, {
      anterior: zero,
      novo: { gols_mandante: 0, gols_visitante: 1 },
    }),
  ]);
  assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1);
  const rejeitado = resultados.find((r) => r.status === 'rejected');
  assert.ok(
    rejeitado?.status === 'rejected' &&
      rejeitado.reason instanceof ConflitoPartida
  );
});
