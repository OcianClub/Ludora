import type { Prisma, StatusPartida } from '@prisma/client';
import { escopoPartidas, perspectivaPartida } from './visibilidade';
import { intervaloDataPartidas } from './filtros-data.utils';

export async function consultarListaPartidas(
  banco: Pick<Prisma.TransactionClient, 'partida' | 'categoria'>,
  clubeId: number,
  filtros: Record<string, unknown>
) {
  const where: Prisma.PartidaWhereInput = escopoPartidas(clubeId);
  const intervalo = intervaloDataPartidas(filtros);
  if (intervalo) where.data = intervalo;
  if (filtros.categoria_id) {
    const cat = await banco.categoria.findFirst({
      where: { id: Number(filtros.categoria_id), clube_id: clubeId },
    });
    if (!cat) return [];
    where.AND = [{ categoria: { faixaIdade: cat.faixaIdade } }];
  }
  if (filtros.status) where.status = filtros.status as StatusPartida;
  if (filtros.competicao_id)
    where.competicao_id = Number(filtros.competicao_id);
  if (filtros.resumo === '1') {
    const time = {
      select: {
        id: true,
        nome: true,
        escudo: true,
        clube_representado_id: true,
        clubeRepresentado: { select: { nome: true, escudo: true } },
      },
    } as const;
    const partidas = await banco.partida.findMany({
      where,
      orderBy: { data: 'asc' },
      select: {
        participantes: { include: { categoria: true } },
        organizador_id: true,
        id: true,
        data: true,
        horario: true,
        local: true,
        status: true,
        emCasa: true,
        gols_mandante: true,
        gols_visitante: true,
        rodada: true,
        grupo: true,
        competicao_id: true,
        mandante: time,
        visitante: time,
        categoria: {
          select: { id: true, nome: true, tipo: true, clube_id: true },
        },
        competicao: { select: { id: true, nome: true, ano: true, tipo: true } },
      },
    });
    return partidas.map((partida) => {
      const resumo = perspectivaPartida(partida, clubeId);
      const identidade = (time: typeof resumo.mandante) => ({
        id: time.id,
        nome: time.nome,
        escudo: time.escudo,
      });
      return {
        ...resumo,
        mandante: identidade(resumo.mandante),
        visitante: identidade(resumo.visitante),
      };
    });
  }
  const partidas = await banco.partida.findMany({
    where,
    orderBy: { data: 'asc' },
    include: {
      participantes: { include: { categoria: true } },
      mandante: {
        include: {
          clubeRepresentado: { select: { nome: true, escudo: true } },
        },
      },
      visitante: {
        include: {
          clubeRepresentado: { select: { nome: true, escudo: true } },
        },
      },
      categoria: true,
      competicao: true,
      eventos: filtros.resumo !== '1',
    },
  });
  return partidas.map((p) => perspectivaPartida(p, clubeId));
}
