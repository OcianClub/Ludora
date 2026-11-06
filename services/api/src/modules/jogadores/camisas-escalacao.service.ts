import type { Prisma } from '@prisma/client';

type CamisaAlterada = { id: number; numCamisa: number | null };

// Só preparações acompanham o cadastro. Jogos iniciados preservam a camisa da súmula.
export async function sincronizarCamisasPreparacao(
  tx: Prisma.TransactionClient,
  camisas: CamisaAlterada[],
  contexto: { clubeId: number; usuarioId: number },
) {
  if (!camisas.length) return [];
  const numeros = new Map(camisas.map(j => [j.id, j.numCamisa]));
  const rows = await tx.escalacaoPartida.findMany({
    where: { jogador_id: { in: [...numeros.keys()] }, partida: { status: { in: ['AGENDADA', 'PREPARADA'] } } },
  });
  const alteradas = rows.filter(row => numeros.get(row.jogador_id) !== row.numCamisa);
  if (!alteradas.length) return [];

  // Remover primeiro permite trocar dois números sem violar a unicidade da equipe.
  await tx.escalacaoPartida.deleteMany({ where: { id: { in: alteradas.map(row => row.id) } } });
  const manter = alteradas.filter(row => numeros.get(row.jogador_id) != null).map(({ id: _id, ...row }) => ({
    ...row, numCamisa: numeros.get(row.jogador_id)!,
  }));
  if (manter.length) await tx.escalacaoPartida.createMany({ data: manter });

  const partidas = [...new Set(alteradas.map(row => row.partida_id))];
  const atualizadas = [];
  for (const partidaId of partidas) {
    const equipeRows = alteradas.filter(row => row.partida_id === partidaId);
    const times = [...new Set(equipeRows.map(row => row.time_id))];
    await tx.participantePartida.updateMany({
      where: { partida_id: partidaId, clube_id: contexto.clubeId, time_id: { in: times } },
      data: { pronta: false, publicada_em: null, versao: { increment: 1 } },
    });
    await tx.partida.updateMany({
      where: { id: partidaId, status: { in: ['AGENDADA', 'PREPARADA'] } },
      data: { status: 'AGENDADA', versao: { increment: 1 } },
    });
    const removidos = equipeRows.filter(row => numeros.get(row.jogador_id) == null).map(row => row.jogador_id);
    await tx.auditoriaPartida.create({ data: {
      partida_id: partidaId, clube_id: contexto.clubeId, usuario_id: contexto.usuarioId,
      acao: 'NUMERACAO_ATUALIZADA', dados: { jogadores: camisas.map(j => j.id), removidos },
    } });
    atualizadas.push({ partida_id: partidaId, removidos });
  }
  return atualizadas;
}
