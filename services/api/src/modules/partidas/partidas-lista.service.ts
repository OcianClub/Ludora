import type { Prisma, StatusPartida } from '@prisma/client';

export function consultarListaPartidas(
  banco: Pick<Prisma.TransactionClient, 'partida'>,
  clubeId: number,
  filtros: Record<string, unknown>
) {
  const where: Prisma.PartidaWhereInput = { categoria: { clube_id: clubeId } };
  if (filtros.categoria_id) where.categoria_id = Number(filtros.categoria_id);
  if (filtros.status) where.status = filtros.status as StatusPartida;
  if (filtros.competicao_id)
    where.competicao_id = Number(filtros.competicao_id);
  if (filtros.mes) {
    const ano = new Date().getFullYear();
    const mes = Number(filtros.mes);
    where.data = {
      gte: new Date(Date.UTC(ano, mes - 1, 1)),
      lt: new Date(Date.UTC(ano, mes, 1)),
    };
  }
  return banco.partida.findMany({
    where,
    orderBy: { data: 'asc' },
    include: {
      mandante: true,
      visitante: true,
      categoria: true,
      competicao: true,
      eventos: filtros.resumo !== '1',
    },
  });
}
