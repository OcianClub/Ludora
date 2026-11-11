import type { JogoPaulista, SnapshotPaulista, PainelPaulista } from '../paulista';
// Keep the Web contract: imported local statuses are strings supplied by the API.
type SituacaoPartida = string;
import { teamName } from './teamIdentity';
import { chavePublicada, etapaPublicada, caminhoPublicado, agendaProvisoria, type ChavePaulista } from './paulistaBracket';
export { chavePublicada, etapaPublicada, caminhoPublicado } from './paulistaBracket';

/** Never present a previous club/category response under the newly selected filter. */
export function painelDaSelecao(painel: PainelPaulista, evento: { id: number; ano: number; categoria: string; divisao: string }, clubeId: number | undefined) {
  const s = painel.snapshot;
  return painel.evento.id === evento.id && s.id === evento.id && s.ano === evento.ano
    && s.categoria === evento.categoria && s.divisao === evento.divisao
    && painel.vinculos.some(v => v.clubeId === clubeId && s.equipes.some(e => e.id === v.equipeId));
}

export function nomeOficial(nome: string) {
  const limpo = teamName(nome);
  if (limpo !== limpo.toLocaleUpperCase('pt-BR')) return limpo;
  return limpo.split(' ').map((word, i) => ['ADC', 'AA', 'FC', 'SP'].includes(word) || /^[A-Z](?:\.[A-Z])+\.?$/.test(word) ? word : i && /^(DE|DA|DO|DOS|DAS|E)$/.test(word) ? word.toLowerCase() : word.charAt(0) + word.slice(1).toLocaleLowerCase('pt-BR')).join(' ');
}
export const ordemData = (a: JogoPaulista, b: JogoPaulista) => `${a.data || '9999'} ${a.horario || '99:99'}`.localeCompare(`${b.data || '9999'} ${b.horario || '99:99'}`) || a.id.localeCompare(b.id);
export const temResultado = (j: JogoPaulista) => !j.ocorrencia && j.golsMandante !== null && j.golsVisitante !== null;
export function estadoJogo(j: JogoPaulista) {
  if (agendaProvisoria(j)) return 'Data e horário aguardam confirmação';
  if (j.ocorrencia === 'WO') return 'W.O. publicado';
  if (j.ocorrencia === 'ADIADA') return 'Adiada · aguarde nova confirmação';
  if (temResultado(j)) return 'Resultado oficial';
  return !j.data || !j.horario ? 'Data ou horário a confirmar' : 'Resultado ainda não publicado';
}
export function resumoClube(s: SnapshotPaulista, ids: Set<number>, hoje: string) {
  const jogos = s.jogos.filter(j => ids.has(j.mandanteId) || ids.has(j.visitanteId)).sort(ordemData);
  const classificacao = s.classificacao.find(r => ids.has(r.equipeId) && /CLASSIFICA/i.test(r.fase));
  const proxima = jogos.find(j => j.data && j.data >= hoje && !j.ocorrencia && !temResultado(j) && !agendaProvisoria(j));
  const ultimo = [...jogos].reverse().find(j => temResultado(j) || j.ocorrencia === 'WO');
  const chaves = [...new Set([
    ...jogos.map(j => chavePublicada(j.fase)),
    ...s.classificacao.filter(r => ids.has(r.equipeId)).map(r => chavePublicada(`${r.fase} ${r.grupo}`)),
  ].filter((v): v is ChavePaulista => !!v))];
  return { jogos, classificacao, proxima, ultimo, chaves, pendentes: jogos.filter(j => j.ocorrencia !== 'WO' && !temResultado(j) && j.id !== proxima?.id) };
}

export function situacaoPublicacao(j: JogoPaulista, local?: SituacaoPartida): SituacaoPartida {
  return temResultado(j) ? 'FINALIZADA' : local || 'AGENDADA';
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
