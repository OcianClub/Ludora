import type { Prisma, PrismaClient } from '@prisma/client';
import type { Server } from 'socket.io';
import { enviarPushParaUsuarios } from './notificacoes.service';

type PartidaAviso = {
  id: number;
  versao: number;
  mandante_id: number;
  gols_mandante: number;
  gols_visitante: number;
  mandante: { nome: string };
  visitante: { nome: string };
  participantes: { clube_id: number; time_id: number }[];
};

export async function enfileirarAvisoPartida(
  banco: Prisma.TransactionClient,
  partida: PartidaAviso,
  gol?: { id: number; timeId: number },
) {
  const equipes = gol ? partida.participantes.filter(e => e.time_id === gol.timeId) : partida.participantes;
  if (!equipes.length) return;
  await banco.avisoPartidaPendente.createMany({
    data: equipes.map(equipe => {
      const casa = equipe.time_id === partida.mandante_id;
      const time = casa ? partida.mandante : partida.visitante;
      const diferenca = casa ? partida.gols_mandante - partida.gols_visitante : partida.gols_visitante - partida.gols_mandante;
      return {
        chave: gol ? `gol:${gol.id}:${equipe.clube_id}` : `resultado:${partida.id}:${partida.versao}:${equipe.clube_id}`,
        partida_id: partida.id,
        clube_id: equipe.clube_id,
        tipo: gol ? 'GOL_PARTIDA' : 'RESULTADO_PARTIDA',
        titulo: gol ? `Gol do ${time.nome}!` : diferenca > 0 ? 'Vitória!' : diferenca < 0 ? 'Derrota' : 'Empate!',
        corpo: `${partida.mandante.nome} ${partida.gols_mandante} x ${partida.gols_visitante} ${partida.visitante.nome}`,
      };
    }),
    skipDuplicates: true,
  });
}

export async function distribuirAvisosPartida(
  banco: PrismaClient,
  io: Server,
  enviarPush: typeof enviarPushParaUsuarios = enviarPushParaUsuarios,
) {
  const avisos = await banco.avisoPartidaPendente.findMany({
    orderBy: [{ criada_em: 'asc' }, { chave: 'asc' }], take: 25,
  });
  for (const aviso of avisos) {
    if (aviso.tipo !== 'GOL_PARTIDA' && aviso.tipo !== 'RESULTADO_PARTIDA') continue;
    const dados = { partidaId: aviso.partida_id, clubeId: aviso.clube_id };
    try {
      const notificacoes = await banco.$transaction(async tx => {
        // A remoção e a gravação dos avisos são atômicas, inclusive com dois processos concorrentes.
        const { count } = await tx.avisoPartidaPendente.deleteMany({ where: { chave: aviso.chave } });
        if (!count) return [];
        const membros = await tx.usuarioClube.findMany({ where: { clube_id: aviso.clube_id }, select: { usuario_id: true } });
        if (!membros.length) return [];
        return tx.notificacao.createManyAndReturn({
          data: membros.map(({ usuario_id }) => ({
            usuario_id, clube_id: aviso.clube_id, partida_id: aviso.partida_id,
            tipo: aviso.tipo, titulo: aviso.titulo, corpo: aviso.corpo, dados, criada_em: aviso.criada_em,
          })),
        });
      });
      if (!notificacoes.length) continue;
      for (const notificacao of notificacoes) io.to(`usuario:${notificacao.usuario_id}`).emit('notificacao_criada', notificacao);
      void enviarPush(notificacoes.map(n => n.usuario_id), aviso.clube_id, aviso.tipo,
        aviso.titulo, aviso.corpo, dados, banco).catch(() => console.error('Não foi possível enviar push da partida.'));
    } catch {
      console.error('Falha ao distribuir aviso da partida. O próximo ciclo tentará novamente.');
    }
  }
}

export function iniciarAvisosPartida(banco: PrismaClient, io: Server) {
  let emAndamento = false;
  const timer = setInterval(() => {
    if (emAndamento) return;
    emAndamento = true;
    void distribuirAvisosPartida(banco, io).catch(() => console.error('Fila de avisos da partida indisponível.'))
      .finally(() => { emAndamento = false; });
  }, 1_000);
  timer.unref();
  return () => clearInterval(timer);
}
