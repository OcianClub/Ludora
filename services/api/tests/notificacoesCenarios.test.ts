import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PrismaClient } from '@prisma/client';
import type { Server } from 'socket.io';

test('falha de push não apaga o histórico nem impede o aviso interno', async (t) => {
  const { criarNotificacoesDoClube } = await import(
    '../src/services/notificacoes.service.js'
  );
  const salvas: unknown[] = [];
  const eventos: { sala: string; evento: string }[] = [];
  const erros: unknown[][] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => {
    erros.push(args);
  });
  const banco = {
    usuarioClube: {
      findMany: async () => [{ usuario_id: 1 }, { usuario_id: 2 }],
    },
    notificacao: {
      create: async ({ data }: { data: unknown }) => {
        salvas.push(data);
        return data;
      },
    },
    $transaction: async (operacoes: Promise<unknown>[]) =>
      Promise.all(operacoes),
  } as unknown as PrismaClient;
  const io = {
    to: (sala: string) => ({
      emit: (evento: string) => {
        eventos.push({ sala, evento });
      },
    }),
  } as unknown as Server;
  await criarNotificacoesDoClube(
    {
      io,
      clubeId: 7,
      partidaId: 11,
      tipo: 'RESULTADO_PARTIDA',
      titulo: 'Resultado',
      corpo: '2 a 1',
    },
    banco,
    async () => {
      throw new Error('Expo indisponível');
    }
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(salvas.length, 2);
  assert.deepEqual(eventos, [
    { sala: 'usuario:1', evento: 'notificacao_criada' },
    { sala: 'usuario:2', evento: 'notificacao_criada' },
  ]);
  assert.equal(erros.length, 1);
});

test('clube sem membros não cria histórico, não emite eventos e não envia push', async () => {
  const { criarNotificacoesDoClube } = await import(
    '../src/services/notificacoes.service.js'
  );
  const banco = {
    usuarioClube: { findMany: async () => [] },
  } as unknown as PrismaClient;
  await criarNotificacoesDoClube(
    {
      io: {} as Server,
      clubeId: 7,
      tipo: 'GOL_PARTIDA',
      titulo: 'Gol',
      corpo: '1 a 0',
    },
    banco,
    async () => {
      assert.fail('Não deve enviar push sem destinatários');
    }
  );
});

test('envio divide 205 dispositivos em lotes de até 100 e reporta indisponibilidade HTTP', async () => {
  const { enviarPushParaUsuarios } = await import(
    '../src/services/notificacoes.service.js'
  );
  const banco = {
    dispositivoPush: {
      findMany: async () =>
        Array.from({ length: 205 }, (_, id) => ({
          token: `ExpoPushToken[teste-${id}]`,
        })),
    },
  } as unknown as PrismaClient;
  const lotes: {
    channelId: string;
    data: { clubeId: number };
    to: string;
  }[][] = [];
  const enviar = (async (_url, opcoes) => {
    lotes.push(JSON.parse(opcoes?.body as string));
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
  await enviarPushParaUsuarios(
    [1],
    7,
    'PARTIDA_AGENDADA',
    'Partida',
    'Hoje',
    { clubeId: 7 },
    banco,
    enviar
  );
  assert.deepEqual(
    lotes.map((lote) => lote.length),
    [100, 100, 5]
  );
  assert.equal(new Set(lotes.flat().map((mensagem) => mensagem.to)).size, 205);
  assert.ok(
    lotes
      .flat()
      .every(
        (mensagem) =>
          mensagem.channelId === 'partidas' && mensagem.data.clubeId === 7
      )
  );
  await assert.rejects(
    enviarPushParaUsuarios(
      [1],
      7,
      'GOL_PARTIDA',
      'Gol',
      '1 a 0',
      undefined,
      banco,
      (async () => new Response('{}', { status: 503 })) as typeof fetch
    ),
    /Expo Push respondeu 503/
  );
});
