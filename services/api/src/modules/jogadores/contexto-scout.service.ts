import type { Prisma } from '@prisma/client';

export type FiltroScout = {
  competicaoId?: number;
  partidaId?: number;
  ano?: number;
};

export function escopoPartidasScout(
  clubeId: number,
  categorias: number[] | null
): Prisma.PartidaWhereInput {
  return {
    OR: [
      {
        categoria: { clube_id: clubeId },
        ...(categorias ? { categoria_id: { in: categorias } } : {}),
      },
      {
        participantes: {
          some: {
            clube_id: clubeId,
            ...(categorias ? { categoria_id: { in: categorias } } : {}),
          },
        },
      },
    ],
  };
}

export async function consultarContextoScout(
  tx: Prisma.TransactionClient,
  jogadorId: number,
  clubeId: number,
  categoriasPermitidas: number[] | null,
  filtro: FiltroScout = {}
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
    select: { id: true, scores_ml: true, categoria_id: true, posicao: true },
  });
  if (!jogador) return null;

  const vinculo: Prisma.PartidaWhereInput = {
    OR: [
      { jogadores_escalonados: { some: { jogador_id: jogadorId } } },
      { eventos: { some: { jogador_id: jogadorId } } },
    ],
  };
  const base: Prisma.PartidaWhereInput = {
    AND: [escopoPartidasScout(clubeId, categoriasPermitidas), vinculo],
  };
  const where: Prisma.PartidaWhereInput = {
    ...base,
    status: filtro.partidaId ? { in: ['AO_VIVO', 'FINALIZADA'] } : 'FINALIZADA',
    ...(filtro.competicaoId ? { competicao_id: filtro.competicaoId } : {}),
    ...(filtro.partidaId ? { id: filtro.partidaId } : {}),
    ...(filtro.ano
      ? {
          data: {
            gte: new Date(`${filtro.ano}-01-01T00:00:00Z`),
            lt: new Date(`${filtro.ano + 1}-01-01T00:00:00Z`),
          },
        }
      : {}),
  };
  const totalPartidas = await tx.partida.count({ where });
  if ((filtro.partidaId || filtro.competicaoId) && totalPartidas === 0)
    return null;
  const partidas = await tx.partida.findMany({
    where,
    take: 10,
    orderBy: [{ data: 'desc' }, { horario: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      data: true,
      horario: true,
      status: true,
      emCasa: true,
      mandante_id: true,
      gols_mandante: true,
      gols_visitante: true,
      competicao: { select: { id: true, nome: true, ano: true } },
      participantes: {
        where: { clube_id: clubeId },
        select: { time_id: true },
      },
      mandante: { select: { nome: true } },
      visitante: { select: { nome: true } },
      jogadores_escalonados: {
        where: { jogador_id: jogadorId },
        select: { titular_inicial: true, numCamisa: true },
      },
      eventos: {
        where: { jogador_id: jogadorId },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          tipo: true,
          periodo: true,
          minuto: true,
          gol_contra: true,
        },
      },
    },
  });
  const eventos = await tx.evento.groupBy({
    by: ['tipo', 'gol_contra', 'periodo'],
    where: { jogador_id: jogadorId, partida: { is: where } },
    _count: { _all: true },
  });
  const escalacoes = await tx.escalacaoPartida.groupBy({
    by: ['titular_inicial'],
    where: { jogador_id: jogadorId, partida: { is: where } },
    _count: { _all: true },
  });
  const convocacoes = escalacoes.reduce((n, e) => n + e._count._all, 0);
  const titularidades =
    escalacoes.find((e) => e.titular_inicial === true)?._count._all ?? 0;
  const titularidadesDesconhecidas =
    escalacoes.find((e) => e.titular_inicial === null)?._count._all ?? 0;
  const opcoesPartidas = await tx.partida.findMany({
    where: { ...base, status: { in: ['AO_VIVO', 'FINALIZADA'] } },
    take: 100,
    orderBy: [{ data: 'desc' }, { horario: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      data: true,
      status: true,
      mandante: { select: { nome: true } },
      visitante: { select: { nome: true } },
    },
  });
  const competicoes = await tx.partida.findMany({
    where: { ...base, status: 'FINALIZADA', competicao_id: { not: null } },
    distinct: ['competicao_id'],
    select: { competicao: { select: { id: true, nome: true, ano: true } } },
    orderBy: { data: 'desc' },
    take: 100,
  });
  const datasRegistradas = await tx.partida.groupBy({
    by: ['data'],
    where: { ...base, status: 'FINALIZADA' },
    orderBy: { data: 'desc' },
  });
  const contar = (tipo: string, contra = false) =>
    eventos
      .filter((e) => e.tipo === tipo && e.gol_contra === contra)
      .reduce((n, e) => n + e._count._all, 0);
  const ml = jogador.scores_ml as Record<string, any> | null;
  const posicao = jogador.posicao.trim().toLowerCase();
  const semelhantes =
    !filtro.competicaoId &&
    !filtro.partidaId &&
    !filtro.ano &&
    ml?.versao === 2 &&
    Array.isArray(ml.semelhantes)
      ? await tx.jogador.findMany({
          where: {
            id: {
              in: ml.semelhantes
                .map((s: any) => s.jogador_id)
                .filter(Number.isSafeInteger),
            },
            ativo: true,
            categoria_id: jogador.categoria_id,
            posicao: {
              in: ['ala', 'alas'].includes(posicao)
                ? ['Ala', 'Alas']
                : [jogador.posicao],
              mode: 'insensitive',
            },
          },
          select: { id: true, nome: true, numCamisa: true },
        })
      : [];
  const ordemSemelhantes = new Map<number, number>(
    (ml?.semelhantes || []).map((s: any, index: number) => [
      s.jogador_id,
      index,
    ])
  );
  semelhantes.sort(
    (a, b) =>
      (ordemSemelhantes.get(a.id) ?? 0) - (ordemSemelhantes.get(b.id) ?? 0)
  );
  return {
    versao: 2,
    jogador_id: jogadorId,
    total_partidas: totalPartidas,
    recorte: {
      tipo: filtro.partidaId
        ? 'partida'
        : filtro.competicaoId
          ? 'competicao'
          : 'geral',
      competicao_id: filtro.competicaoId ?? null,
      partida_id: filtro.partidaId ?? null,
      ano: filtro.ano ?? null,
      provisorio: partidas.some((p) => p.status === 'AO_VIVO'),
    },
    totais: {
      convocacoes,
      titularidades,
      titularidades_desconhecidas: titularidadesDesconhecidas,
      gols: contar('GOL'),
      assistencias: contar('ASSISTENCIA'),
      defesas: contar('DEFESA'),
      faltas: contar('FALTA'),
      amarelos: contar('CARTAO_AMARELO'),
      vermelhos: contar('CARTAO_VERMELHO'),
      azuis: contar('CARTAO_AZUL'),
      gols_contra: contar('GOL', true),
    },
    por_tempo: [...new Set(eventos.map((e) => e.periodo))]
      .sort((a, b) => a - b)
      .map((periodo) => ({
        periodo,
        gols: eventos
          .filter(
            (e) => e.periodo === periodo && e.tipo === 'GOL' && !e.gol_contra
          )
          .reduce((n, e) => n + e._count._all, 0),
        assistencias: eventos
          .filter((e) => e.periodo === periodo && e.tipo === 'ASSISTENCIA')
          .reduce((n, e) => n + e._count._all, 0),
        defesas: eventos
          .filter((e) => e.periodo === periodo && e.tipo === 'DEFESA')
          .reduce((n, e) => n + e._count._all, 0),
      })),
    opcoes: {
      temporadas: [...new Set(datasRegistradas.map((p) => p.data.getUTCFullYear()))],
      competicoes: competicoes.flatMap((c) =>
        c.competicao ? [c.competicao] : []
      ),
      partidas: opcoesPartidas.map((p) => ({
        id: p.id,
        data: p.data.toISOString().slice(0, 10),
        nome: `${p.mandante.nome} × ${p.visitante.nome}`,
        status: p.status,
      })),
    },
    semelhantes,
    modelo: semelhantes.length
      ? {
          versao: 2,
          calculado_em: ml?.calculado_em,
          grupo_tamanho: ml?.grupo_tamanho,
        }
      : null,
    partidas: partidas.map((p) => ({
      id: p.id,
      data: p.data.toISOString().slice(0, 10),
      horario: p.horario,
      status: p.status,
      adversario: (
        p.participantes[0]
          ? p.participantes[0].time_id === p.mandante_id
          : p.emCasa
      )
        ? p.visitante.nome
        : p.mandante.nome,
      mandante: p.mandante.nome,
      visitante: p.visitante.nome,
      gols_mandante: p.gols_mandante,
      gols_visitante: p.gols_visitante,
      competicao: p.competicao,
      convocado: p.jogadores_escalonados.length > 0,
      titular_inicial: p.jogadores_escalonados[0]?.titular_inicial ?? null,
      gols: p.eventos.filter((e) => e.tipo === 'GOL' && !e.gol_contra).length,
      assistencias: p.eventos.filter((e) => e.tipo === 'ASSISTENCIA').length,
      defesas: p.eventos.filter((e) => e.tipo === 'DEFESA').length,
      eventos: p.eventos,
    })),
  };
}
