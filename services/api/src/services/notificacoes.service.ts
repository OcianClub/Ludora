import type { Server } from 'socket.io';

import { prisma } from '../lib/prisma';

type DadosNotificacao = Record<string, string | number | boolean | null>;

interface CriarNotificacoesDoClubeInput {
  io: Server;
  clubeId: number;
  partidaId?: number;
  tipo: 'PARTIDA_AGENDADA' | 'GOL_PARTIDA' | 'RESULTADO_PARTIDA';
  titulo: string;
  corpo: string;
  dados?: DadosNotificacao;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function dividirEmLotes<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let indice = 0; indice < itens.length; indice += tamanho) {
    lotes.push(itens.slice(indice, indice + tamanho));
  }
  return lotes;
}

async function enviarPushParaUsuarios(
  usuarioIds: number[],
  titulo: string,
  corpo: string,
  dados?: DadosNotificacao,
) {
  const dispositivos = await prisma.dispositivoPush.findMany({
    where: {
      usuario_id: { in: usuarioIds },
      usuario: { notificacoes_ativas: true },
    },
    select: { token: true },
  });

  const mensagens = dispositivos.map((dispositivo) => ({
    to: dispositivo.token,
    title: titulo,
    body: corpo,
    sound: 'default',
    priority: 'high',
    channelId: 'partidas',
    data: dados,
  }));

  for (const lote of dividirEmLotes(mensagens, 100)) {
    const resposta = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(lote),
    });

    if (!resposta.ok) {
      throw new Error(`Expo Push respondeu ${resposta.status}`);
    }
  }
}

/**
 * Registra o aviso no histórico de cada membro do clube, notifica clientes
 * conectados pelo Socket.IO e tenta enviar push para quem o deixou habilitado.
 * O push é deliberadamente assíncrono: uma indisponibilidade do Expo não pode
 * impedir que uma partida, gol ou resultado seja salvo.
 */
export async function criarNotificacoesDoClube({
  io,
  clubeId,
  partidaId,
  tipo,
  titulo,
  corpo,
  dados,
}: CriarNotificacoesDoClubeInput) {
  const membros = await prisma.usuarioClube.findMany({
    where: { clube_id: clubeId },
    select: { usuario_id: true },
  });

  if (membros.length === 0) return;

  const notificacoes = await prisma.$transaction(
    membros.map(({ usuario_id }) =>
      prisma.notificacao.create({
        data: {
          usuario_id,
          clube_id: clubeId,
          partida_id: partidaId,
          tipo,
          titulo,
          corpo,
          dados,
        },
      }),
    ),
  );

  notificacoes.forEach((notificacao) => {
    io.to(`usuario:${notificacao.usuario_id}`).emit(
      'notificacao_criada',
      notificacao,
    );
  });

  void enviarPushParaUsuarios(
    membros.map(({ usuario_id }) => usuario_id),
    titulo,
    corpo,
    dados,
  ).catch((erro) => {
    console.error('Não foi possível enviar push:', erro.message || erro);
  });
}

