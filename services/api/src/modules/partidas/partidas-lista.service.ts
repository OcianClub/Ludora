import type { Prisma, StatusPartida } from '@prisma/client';
import { escopoPartidas, perspectivaPartida } from './visibilidade';

export async function consultarListaPartidas(
  banco: Pick<Prisma.TransactionClient, 'partida' | 'categoria'>,
  clubeId: number,
  filtros: Record<string, unknown>
) {
  const where: Prisma.PartidaWhereInput = escopoPartidas(clubeId);
  if (filtros.categoria_id) {
    const cat = await banco.categoria.findFirst({where:{id:Number(filtros.categoria_id),clube_id:clubeId}});
    if (!cat) return [];
    where.AND = [{categoria:{faixaIdade:cat.faixaIdade}}];
  }
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
  const partidas = await banco.partida.findMany({
    where,
    orderBy: { data: 'asc' },
    include: {
      mandante: {include:{clubeRepresentado:{select:{nome:true,escudo:true}}}},
      visitante: {include:{clubeRepresentado:{select:{nome:true,escudo:true}}}},
      categoria: true,
      competicao: true,
      eventos: filtros.resumo !== '1',
    },
  });
  return partidas.map(p => perspectivaPartida(p,clubeId));
}
