import { nomeBaseTime } from './time-identity';

type TeamIdentity = { id: number; nome: string; categoria_id: number | null; clube_representado_id: number | null };
type FinalGroup = { mandante_id: number; visitante_id: number; gols_mandante: number; gols_visitante: number; _count: { _all: number } };
type NextGroup = { mandante_id: number; visitante_id: number; categoria_id: number; _min: { data: Date | null } };
const emptySummary = () => ({ vitorias: 0, empates: 0, derrotas: 0, golsPro: 0, golsContra: 0,
  proxima: null as { data: Date; categoria_id: number } | null });

export const chaveTime = (time: TeamIdentity) => time.clube_representado_id
  ? `club:${time.clube_representado_id}` : nomeBaseTime(time.nome);

export function resumirConfrontos(times: TeamIdentity[], resultados: FinalGroup[], proximas: NextGroup[], clubeId: number) {
  const byId = new Map(times.map(time => [time.id, time]));
  const groups = new Map<string, ReturnType<typeof emptySummary> & { key: string; categorias: (ReturnType<typeof emptySummary> & { categoria_id: number })[] }>();
  for (const time of times) {
    const key = chaveTime(time);
    if (!groups.has(key)) {
      groups.set(key, { key, ...emptySummary(), categorias: [] });
    }
  }
  const opponent = (home: number, away: number) => {
    const a = byId.get(home);
    const b = byId.get(away);
    if (!a || !b || (a.clube_representado_id === clubeId) === (b.clube_representado_id === clubeId)) return null;
    const emCasa = a.clube_representado_id === clubeId;
    return { group: groups.get(chaveTime(emCasa ? b : a)), emCasa, categoriaId: (emCasa ? a : b).categoria_id };
  };
  const categorySummary = (group: NonNullable<ReturnType<typeof opponent>>['group'], categoryId: number | null) => {
    if (!group || !categoryId) return null;
    let category = group.categorias.find(item => item.categoria_id === categoryId);
    if (!category) {
      category = { categoria_id: categoryId, ...emptySummary() };
      group.categorias.push(category);
    }
    return category;
  };
  for (const row of resultados) {
    const match = opponent(row.mandante_id, row.visitante_id);
    if (!match?.group) continue;
    const pro = match.emCasa ? row.gols_mandante : row.gols_visitante;
    const contra = match.emCasa ? row.gols_visitante : row.gols_mandante;
    const count = row._count._all;
    const own = groups.get(`club:${clubeId}`);
    const category = categorySummary(match.group, match.categoriaId);
    const ownCategory = categorySummary(own, match.categoriaId);
    for (const summary of [match.group, category, own, ownCategory]) {
      if (!summary) continue;
      summary[pro > contra ? 'vitorias' : pro < contra ? 'derrotas' : 'empates'] += count;
      summary.golsPro += pro * count;
      summary.golsContra += contra * count;
    }
  }
  for (const row of proximas) {
    const match = opponent(row.mandante_id, row.visitante_id);
    const group = match?.group;
    const data = row._min.data;
    const categoryId = match?.categoriaId || row.categoria_id;
    const category = categorySummary(group, categoryId);
    const own = match ? groups.get(`club:${clubeId}`) : undefined;
    const ownCategory = categorySummary(own, categoryId);
    for (const summary of [group, category, own, ownCategory]) {
      if (summary && data && (!summary.proxima || data < summary.proxima.data)) summary.proxima = { data, categoria_id: categoryId };
    }
  }
  return [...groups.values()];
}
