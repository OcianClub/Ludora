import type { Prisma, TipoEvento } from '@prisma/client';

export async function consultarPerfis(
  tx: Prisma.TransactionClient,
  where: Prisma.JogadorWhereInput
) {
  const jogadores = await tx.jogador.findMany({
    where,
    select: {
      id: true,
      nome: true,
      posicao: true,
      numCamisa: true,
      dtNasc: true,
      perfil_ml: true,
      scores_ml: true,
      nota_geral: true,
      categoria_id: true,
      categoria: { select: { nome: true, tipo: true } },
      _count: { select: { escalacoes: { where: { partida: { status: 'FINALIZADA' } } } } },
    },
    orderBy: [{ nome: 'asc' }, { id: 'asc' }],
  });
  if (!jogadores.length) return [];

  const contagens = await tx.evento.groupBy({
    by: ['jogador_id', 'tipo'],
    where: { jogador: { is: where }, gol_contra: false, partida: { status: 'FINALIZADA' } },
    _count: { _all: true },
  });
  const estatisticas = new Map<number, Partial<Record<TipoEvento, number>>>();
  for (const contagem of contagens) {
    if (contagem.jogador_id == null) continue;
    const stats = estatisticas.get(contagem.jogador_id) ?? {};
    stats[contagem.tipo] = contagem._count._all;
    estatisticas.set(contagem.jogador_id, stats);
  }

  const ano = new Date().getFullYear();
  return jogadores.map((jogador) => {
    const stats = estatisticas.get(jogador.id) ?? {};
    const analise = jogador.scores_ml as Record<string, any> | null;
    const atual = analise?.versao === 2;
    return {
      id_jogador: jogador.id,
      nome: jogador.nome,
      posicao: jogador.posicao,
      numCamisa: jogador.numCamisa,
      idade: ano - jogador.dtNasc.getFullYear(),
      perfil_ml: atual ? jogador.perfil_ml || 'Sem dados' : 'Sem dados',
      scores_ml: null,
      analise_scout: atual ? { versao: 2, calculado_em: analise.calculado_em, convocacoes: analise.convocacoes, grupo_tamanho: analise.grupo_tamanho } : null,
      nota_geral: 0,
      categoria: jogador.categoria.nome,
      categoria_tipo: jogador.categoria.tipo,
      categoria_id: jogador.categoria_id,
      time: 'Clube',
      jogos_disputados: jogador._count.escalacoes,
      gols: stats.GOL ?? 0,
      assistencias: stats.ASSISTENCIA ?? 0,
      defesas: stats.DEFESA ?? 0,
      cartoes_amarelos: stats.CARTAO_AMARELO ?? 0,
      cartoes_vermelhos: stats.CARTAO_VERMELHO ?? 0,
      cartoes_azuis: stats.CARTAO_AZUL ?? 0,
      faltas_cometidas: stats.FALTA ?? 0,
    };
  });
}
