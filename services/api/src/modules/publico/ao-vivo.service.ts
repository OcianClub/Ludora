import type { Prisma, PrismaClient } from '@prisma/client';

const equipeSelect = { id: true, nome: true, escudo: true, clube_representado_id: true,
  clubeRepresentado: { select: { nome: true, escudo: true } } } as const;
export const aoVivoPublicoSelect = {
  id: true, gols_mandante: true, gols_visitante: true, data: true, horario: true,
  categoria: { select: { nome: true } },
  mandante: { select: equipeSelect }, visitante: { select: equipeSelect },
  participantes: { select: { clube_id: true } },
} satisfies Prisma.PartidaSelect;

export async function consultarAoVivo(banco: PrismaClient) {
  // Uma linha por partida oficial, sem juntar listas dos dois clubes.
  const partidas = await banco.partida.findMany({
    where: { status: 'AO_VIVO', OR: [
      { mandante: { clube_representado_id: { not: null } } },
      { visitante: { clube_representado_id: { not: null } } },
      { participantes: { some: {} } },
    ] },
    select: aoVivoPublicoSelect,
    orderBy: [{ data: 'desc' }, { horario: 'desc' }, { id: 'desc' }],
    take: 200,
  });
  return partidas.map(p => {
    const identidade = (time: typeof p.mandante) => ({ nome: time.clubeRepresentado?.nome || time.nome,
      escudo: time.clubeRepresentado?.escudo || time.escudo });
    return { id: p.id, data: p.data, horario: p.horario, categoria: p.categoria.nome,
      gols_mandante: p.gols_mandante, gols_visitante: p.gols_visitante,
      mandante: identidade(p.mandante), visitante: identidade(p.visitante),
      clube_ids: [...new Set([p.mandante.clube_representado_id, p.visitante.clube_representado_id,
        ...p.participantes.map(e => e.clube_id)].filter((id): id is number => id != null))] };
  });
}
