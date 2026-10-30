import type { Prisma } from '@prisma/client';

export async function consultarContextoScout(
  tx: Prisma.TransactionClient,
  jogadorId: number,
  clubeId: number,
  categoriasPermitidas: number[] | null
) {
  const jogador = await tx.jogador.findFirst({
    where: {
      id: jogadorId,
      ativo: true,
      categoria: { clube_id: clubeId },
      ...(categoriasPermitidas
        ? { categoria_id: { in: categoriasPermitidas } }
        : {}),
    },
    select: { id: true },
  });
  if (!jogador) return null;

  const where: Prisma.PartidaWhereInput = {
    status: 'FINALIZADA',
    AND: [{ OR: [{ categoria: { clube_id: clubeId }, ...(categoriasPermitidas ? { categoria_id: { in: categoriasPermitidas } } : {}) }, { participantes: { some: { clube_id: clubeId, ...(categoriasPermitidas ? { categoria_id: { in: categoriasPermitidas } } : {}) } } }] }],
    OR: [
      { jogadores_escalonados: { some: { jogador_id: jogadorId } } },
      { eventos: { some: { jogador_id: jogadorId } } },
    ],
  };
  const totalPartidas = await tx.partida.count({ where });
  const partidas = await tx.partida.findMany({
    where,
    take: 10,
    orderBy: [{ data: 'desc' }, { horario: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      data: true,
      emCasa: true,
      mandante_id: true,
      participantes: { where: { clube_id: clubeId }, select: { time_id: true } },
      mandante: { select: { nome: true } },
      visitante: { select: { nome: true } },
      eventos: {
        where: { jogador_id: jogadorId, gol_contra: false },
        select: { tipo: true },
      },
    },
  });

  return {
    jogador_id: jogadorId,
    total_partidas: totalPartidas,
    partidas: partidas.map((partida) => ({
      id: partida.id,
      data: partida.data.toISOString().slice(0, 10),
      adversario: (partida.participantes[0] ? partida.participantes[0].time_id === partida.mandante_id : partida.emCasa)
        ? partida.visitante.nome
        : partida.mandante.nome,
      gols: partida.eventos.filter((evento) => evento.tipo === 'GOL').length,
      assistencias: partida.eventos.filter(
        (evento) => evento.tipo === 'ASSISTENCIA'
      ).length,
      defesas: partida.eventos.filter((evento) => evento.tipo === 'DEFESA')
        .length,
    })),
  };
}
