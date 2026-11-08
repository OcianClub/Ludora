import type { Prisma, StatusPartida } from '@prisma/client';
import { escopoPartidas, escopoCategoriaPartidas, perspectivaPartida } from './visibilidade';
import { FiltroDataInvalido, intervaloDataPartidas } from './filtros-data.utils';

export async function consultarListaPartidas(
  banco: Pick<Prisma.TransactionClient, 'partida' | 'categoria'>,
  clubeId: number,
  filtros: Record<string, unknown>
) {
  const where: Prisma.PartidaWhereInput = escopoPartidas(clubeId);
  const idFiltro = (valor: unknown) => {
    const n = Number(valor);
    if (!['number', 'string'].includes(typeof valor) || !/^\d+$/.test(String(valor)) || !Number.isSafeInteger(n) || n < 1 || n > 2147483647)
      throw new FiltroDataInvalido('Informe um identificador de filtro válido.');
    return n;
  };
  const intervalo = intervaloDataPartidas(filtros);
  if (intervalo) where.data = intervalo;
  if (filtros.categoria_id !== undefined) {
    const cat = await banco.categoria.findFirst({
      where: { id: idFiltro(filtros.categoria_id), clube_id: clubeId },
    });
    if (!cat) return [];
    where.AND = [escopoCategoriaPartidas(clubeId, cat)];
  }
  if (filtros.status !== undefined) {
    if (typeof filtros.status !== 'string' || !['AGENDADA', 'PREPARADA', 'AO_VIVO', 'FINALIZADA', 'CANCELADA'].includes(filtros.status))
      throw new FiltroDataInvalido('Escolha uma situação válida.');
    where.status = filtros.status as StatusPartida;
  }
  if (filtros.competicao_id !== undefined)
    where.competicao_id = idFiltro(filtros.competicao_id);
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
      orderBy: [{ data: 'asc' }, { horario: 'asc' }, { id: 'asc' }],
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
    orderBy: [{ data: 'asc' }, { horario: 'asc' }, { id: 'asc' }],
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
