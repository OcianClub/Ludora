import type { JogoPaulista, SnapshotPaulista } from '../../../../packages/shared-types/src/paulista';
import type { Partida } from '../services/api';
import { teamName } from './teamIdentity';

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
export function nomeOficial(nome: string) {
  const limpo = teamName(nome);
  if (limpo !== limpo.toLocaleUpperCase('pt-BR')) return limpo;
  return limpo.split(' ').map((word, i) => ['ADC', 'AA', 'FC', 'SP'].includes(word) || /^[A-Z](?:\.[A-Z])+\.?$/.test(word) ? word : i && /^(DE|DA|DO|DOS|DAS|E)$/.test(word) ? word.toLowerCase() : word.charAt(0) + word.slice(1).toLocaleLowerCase('pt-BR')).join(' ');
}
export function chavePublicada(nome: string): 'OURO' | 'PRATA' | 'BRONZE' | null {
  const chaves = normalizar(nome).match(/\b(OURO|PRATA|BRONZE)\b/g) || [];
  return new Set(chaves).size === 1 ? chaves[0] as 'OURO' | 'PRATA' | 'BRONZE' : null;
}
export function etapaPublicada(nome: string) {
  const s = normalizar(nome);
  return /OITAVAS/.test(s) ? 0 : /QUARTAS/.test(s) ? 1 : /SEMIFINA/.test(s) ? 2 : /\bFINA(L|IS)\b/.test(s) ? 3 : -1;
}
export const ordemData = (a: JogoPaulista, b: JogoPaulista) => `${a.data || '9999'} ${a.horario || '99:99'}`.localeCompare(`${b.data || '9999'} ${b.horario || '99:99'}`) || a.id.localeCompare(b.id);
export const temResultado = (j: JogoPaulista) => !j.ocorrencia && j.golsMandante !== null && j.golsVisitante !== null;
export function estadoJogo(j: JogoPaulista) {
  if (j.ocorrencia === 'WO') return 'W.O. publicado';
  if (j.ocorrencia === 'ADIADA') return 'Adiada · aguarde nova confirmação';
  if (temResultado(j)) return 'Resultado oficial';
  return !j.data || !j.horario ? 'Data ou horário a confirmar' : 'Resultado ainda não publicado';
}
export function resumoClube(s: SnapshotPaulista, ids: Set<number>, hoje: string) {
  const jogos = s.jogos.filter(j => ids.has(j.mandanteId) || ids.has(j.visitanteId)).sort(ordemData);
  const classificacao = s.classificacao.find(r => ids.has(r.equipeId) && /CLASSIFICA/i.test(r.fase));
  const proxima = jogos.find(j => j.data && j.data >= hoje && !j.ocorrencia && !temResultado(j));
  const ultimo = [...jogos].reverse().find(j => temResultado(j) || j.ocorrencia === 'WO');
  const chaves = [...new Set([
    ...jogos.map(j => chavePublicada(j.fase)),
    ...s.classificacao.filter(r => ids.has(r.equipeId)).map(r => chavePublicada(`${r.fase} ${r.grupo}`)),
  ].filter((v): v is 'OURO' | 'PRATA' | 'BRONZE' => !!v))];
  return { jogos, classificacao, proxima, ultimo, chaves, pendentes: jogos.filter(j => j.ocorrencia !== 'WO' && !temResultado(j) && j.id !== proxima?.id) };
}

// Agrupa colunas para apresentação. Cada jogo conserva id e faseId.
export function caminhoPublicado(s: SnapshotPaulista, chave: string) {
  const jogos = s.jogos.filter(j => chavePublicada(j.fase) === chave).sort(ordemData);
  const etapas = [...new Set(jogos.map(j => etapaPublicada(j.fase)))].sort((a, b) => a - b);
  const colunas = etapas.map(etapa => ({ etapa, titulo: ['Oitavas de final', 'Quartas de final', 'Semifinais', 'Final'][etapa] || 'Confrontos publicados', jogos: jogos.filter(j => etapaPublicada(j.fase) === etapa) }));
  const conexoes: { de: string; para: string; equipeId: number }[] = [];
  for (const origem of jogos) {
    const etapa = etapaPublicada(origem.fase);
    if (etapa < 0 || !temResultado(origem) || origem.golsMandante === origem.golsVisitante) continue;
    const par = jogos.filter(j => etapaPublicada(j.fase) === etapa && [j.mandanteId, j.visitanteId].every(id => [origem.mandanteId, origem.visitanteId].includes(id)));
    if (par.length !== 1) continue; // Não adivinhar agregado de ida/volta.
    const seguintes = jogos.filter(j => etapaPublicada(j.fase) === etapa + 1 && origem.data && j.data && j.data >= origem.data);
    const candidatos = [origem.mandanteId, origem.visitanteId].map(id => ({ id, destino: seguintes.filter(j => j.mandanteId === id || j.visitanteId === id) }));
    if (candidatos.some(c => c.destino.length > 1)) continue;
    const presentes = candidatos.filter(c => c.destino.length === 1).map(c => ({ id: c.id, jogo: c.destino[0] }));
    const vencedor = origem.golsMandante! > origem.golsVisitante! ? origem.mandanteId : origem.visitanteId;
    if (presentes[0]?.id !== vencedor || jogos.filter(j => etapaPublicada(j.fase) === etapa && [j.mandanteId, j.visitanteId].includes(vencedor)).length !== 1) continue;
    // Presença única na etapa publicada comprova a continuidade, não o ranking.
    if (presentes.length === 1) conexoes.push({ de: origem.id, para: presentes[0].jogo.id, equipeId: presentes[0].id });
  }
  return { colunas, conexoes };
}

export function situacaoPublicacao(j: JogoPaulista, local?: Partida['status']): Partida['status'] {
  return temResultado(j) ? 'FINALIZADA' : local || 'AGENDADA';
}
export function partidaOficial(s: SnapshotPaulista, j: JogoPaulista, minhas: Set<number>, localId?: number | null, localStatus?: Partida['status']): Partida {
  const time = (id: number) => { const t = s.equipes.find(t => t.id === id); return { id, nome: nomeOficial(t?.nome || 'Equipe a confirmar'), escudo: t?.escudo || undefined }; };
  return { id: localId || 0, mandante_id: j.mandanteId, visitante_id: j.visitanteId, mandante: time(j.mandanteId), visitante: time(j.visitanteId),
    data: j.data || '', horario: j.horario || undefined, local: j.local || undefined,
    gols_mandante: j.golsMandante ?? 0, gols_visitante: j.golsVisitante ?? 0,
    status: situacaoPublicacao(j, localStatus), categoria_id: s.id, categoria: { id: s.id, nome: s.categoria, tipo: Number(s.categoria.match(/\d+/)?.[0]) <= 10 ? 'INICIACAO' : 'BASE', clube_id: 0 },
    emCasa: minhas.has(j.mandanteId), semPerspectiva: !minhas.has(j.mandanteId) && !minhas.has(j.visitanteId), paulista_evento_id: s.id, oficialPaulista: j,
  };
}

export function estadoCampanha(s: SnapshotPaulista, minhas: Set<number>) {
  const resumo = resumoClube(s, minhas, '9999-12-31');
  if (!resumo.chaves.length) return 'Classificação · chave ainda não publicada';
  const ultimo = resumo.ultimo;
  if (ultimo) {
    const chave = chavePublicada(ultimo.fase);
    const caminho = chave ? caminhoPublicado(s, chave) : null;
    const avancou = caminho?.conexoes.find(c => c.de === ultimo.id);
    if (avancou && !minhas.has(avancou.equipeId)) return `Eliminado · ${nomeOficial(ultimo.fase)}`;
    if (etapaPublicada(ultimo.fase) === 3 && temResultado(ultimo)) return 'Resultado da final publicado';
  }
  return `Eliminatórias · ${resumo.chaves.map(nomeOficial).join(' / ')}`;
}
