import { requestJson } from './api';

export const MATCH_POLL_CHANGED = 'ludora:match-poll-changed';
export const MATCH_POLL_REFRESH = 'ludora:match-poll-refresh';
export const POLL_CHOICES = ['MANDANTE', 'EMPATE', 'VISITANTE'] as const;
export type PollChoice = typeof POLL_CHOICES[number];
export interface MatchPollData {
  partida_id: number; revisao: number; status: string; aberta: boolean; total: number;
  votos: Record<PollChoice, number>; percentuais: Record<PollChoice, number>; meuVoto: PollChoice | null;
}
export function validPoll(value: unknown, id: number): value is MatchPollData {
  if (!value || typeof value !== 'object') return false;
  const p = value as MatchPollData;
  return p.partida_id === id && Number.isSafeInteger(p.revisao) && p.revisao >= 0 && typeof p.aberta === 'boolean' &&
    typeof p.status === 'string' && Number.isSafeInteger(p.total) && p.total >= 0 &&
    POLL_CHOICES.every(key => Number.isSafeInteger(p.votos?.[key]) && p.votos[key] >= 0 && Number.isInteger(p.percentuais?.[key]) && p.percentuais[key] >= 0 && p.percentuais[key] <= 100) &&
    POLL_CHOICES.reduce((sum, key) => sum + p.votos[key], 0) === p.total;
}
export async function readMatchPoll(id: number, authenticated: boolean, signal: AbortSignal) {
  const result = await requestJson<MatchPollData>(`${authenticated ? '' : '/publico'}/partidas/${id}/palpite`, { signal, cache: 'no-store' });
  if (!validPoll(result, id)) throw new Error('A votação está indisponível.');
  return result;
}
export async function voteMatchPoll(id: number, escolha: PollChoice, signal: AbortSignal) {
  const result = await requestJson<MatchPollData>(`/partidas/${id}/palpite`, { method: 'PUT', body: JSON.stringify({ escolha }), signal });
  if (!validPoll(result, id)) throw new Error('Não foi possível confirmar o voto.');
  return result;
}
