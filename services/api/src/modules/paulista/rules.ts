import type { JogoPaulista, SnapshotPaulista } from '../../../../../packages/shared-types/src/paulista';
import { normalizar } from './provider';
export const nomeTime = (nome: string) => normalizar(nome).replace(/\bSUB\s*\d+\b/g, '').trim();
export function sugestoes(nome: string, nomes: { id: number; nome: string }[]) {
  const comuns = new Set(['CLUBE', 'PRAIA', 'FUTSAL', 'FUTEBOL', 'ASSOCIACAO', 'DESPORTIVA', 'ESPORTIVA', 'ESPORTIVO', 'CULTURAL', 'UNIAO', 'SAO', 'SANTO', 'SANTA', 'TESTE', 'ADC', 'GDR', 'SER', 'DOS', 'DAS']);
  const tokens = (value: string) => [...new Set(normalizar(value).split(' ').filter(w => w.length >= 3 && !comuns.has(w) && !/^\d+$/.test(w)))];
  const words = tokens(nome);
  return nomes.filter(n => {
    const candidate = tokens(n.nome), coincidencias = words.filter(w => candidate.includes(w)).length;
    return coincidencias > 0 && coincidencias >= Math.ceil(Math.min(words.length, candidate.length) * 0.75);
  }).map(n => ({ ...n, estado: 'SUGESTAO_NAO_CONFIRMADA' }));
}
export function verificarContinuidade(antes: SnapshotPaulista | null, novo: SnapshotPaulista) {
  if (!antes) return;
  if (antes.id !== novo.id || antes.ano !== novo.ano || antes.divisao !== novo.divisao || antes.categoria !== novo.categoria) throw new Error('Identidade do evento mudou.');
  const ids = new Set(novo.jogos.map(j => j.id));
  if (antes.jogos.some(j => !ids.has(j.id))) throw new Error('Jogos sumiram ou mudaram de identidade; preservar versão anterior e revisar a fonte.');
}
export function diferencas(a: JogoPaulista, b: JogoPaulista) {
  return (['data', 'horario', 'local', 'golsMandante', 'golsVisitante', 'ocorrencia', 'sumulaId'] as const).flatMap(campo => a[campo] === b[campo] ? [] : [{ campo, antes: a[campo], depois: b[campo] }]);
}
export function rankingCalculado(snapshot: SnapshotPaulista) {
  const groups = new Map<string, Map<number, { equipeId: number; pontos: number; jogos: number; golsPro: number; golsContra: number; saldo: number }>>();
  for (const j of snapshot.jogos) {
    if (!/CLASSIFICA/i.test(j.fase)) continue;
    const table = groups.get(j.faseId) || new Map(); groups.set(j.faseId, table);
    for (const equipeId of [j.mandanteId, j.visitanteId]) if (!table.has(equipeId)) table.set(equipeId, { equipeId, pontos: 0, jogos: 0, golsPro: 0, golsContra: 0, saldo: 0 });
    if (j.ocorrencia || j.golsMandante === null || j.golsVisitante === null) continue;
    for (const [id, pro, contra] of [[j.mandanteId, j.golsMandante, j.golsVisitante], [j.visitanteId, j.golsVisitante, j.golsMandante]]) {
      const row = table.get(id)!; row.jogos++; row.golsPro += pro; row.golsContra += contra; row.saldo = row.golsPro - row.golsContra; row.pontos += pro > contra ? 3 : pro === contra ? 1 : 0;
    }
  }
  return [...groups].map(([faseId, rows]) => ({ faseId, origem: 'CALCULADO_LUDORA', ordemOficial: false, times: [...rows.values()].sort((a, b) => b.pontos - a.pontos || b.saldo - a.saldo || a.equipeId - b.equipeId) }));
}
