import type {
  ContextoScout,
  PartidaScout,
  TotaisContextoScout,
} from "./contextoScout";
export function temporadasScout(opcoes: ContextoScout["opcoes"]) {
  return [
    ...new Set(
      opcoes?.temporadas ??
        (opcoes?.partidas || [])
          .filter((p) => p.status === "FINALIZADA")
          .map((p) => Number(p.data.slice(0, 4))),
    ),
  ]
    .filter(Number.isInteger)
    .sort((a, b) => b - a);
}
export function radarScout(t: TotaisContextoScout) {
  const eixos = [
    { label: "Gols", valor: t.gols },
    { label: "Assist.", valor: t.assistencias },
    { label: "Defesas", valor: t.defesas },
    { label: "Faltas", valor: t.faltas },
    { label: "Cartões", valor: t.amarelos + t.vermelhos + t.azuis },
  ];
  return { eixos, maximo: Math.max(1, ...eixos.map((e) => e.valor)) };
}
export function jogosGraficoScout(partidas: PartidaScout[]) {
  return [...partidas]
    .sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id)
    .map((p) => ({ ...p, total: p.gols + p.assistencias + p.defesas }));
}
