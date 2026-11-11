import { requestJson } from './api';

export const MATCH_POLL_CHANGED = 'ludora:match-poll-changed';
export const MATCH_POLL_REFRESH = 'ludora:match-poll-refresh';
export { POLL_CHOICES, validPoll } from '../../../../packages/shared-types/src/matchPoll';
export type { MatchPollData, PollChoice } from '../../../../packages/shared-types/src/matchPoll';
import { validPoll, type MatchPollData, type PollChoice } from '../../../../packages/shared-types/src/matchPoll';
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
