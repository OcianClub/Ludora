import { apiFetch } from './api';
import { validPoll, type MatchPollData, type PollChoice } from '../../../../packages/shared-types/src/matchPoll';
export type { MatchPollData, PollChoice };
const ouvintes = new Set<(value: unknown) => void>();
export function receberPalpite(value: unknown) { for (const fn of ouvintes) fn(value); }
export function observarPalpite(fn: (value: unknown) => void) { ouvintes.add(fn); return () => { ouvintes.delete(fn); }; }
export async function consultarPalpite(id: number, autenticado: boolean, signal?: AbortSignal) {
  const res = await apiFetch(`${autenticado ? '' : '/publico'}/partidas/${id}/palpite`, { signal, revalidar: true });
  const value = await res.json();
  if (!res.ok || !validPoll(value, id)) throw new Error(value.error || 'Não foi possível consultar os palpites.');
  return value;
}
export async function votarPartida(id: number, escolha: PollChoice, signal?: AbortSignal) {
  const res = await apiFetch(`/partidas/${id}/palpite`, { method: 'PUT', body: JSON.stringify({ escolha }), signal });
  const value = await res.json();
  if (!res.ok || !validPoll(value, id)) throw new Error(value.error || 'Não foi possível confirmar seu palpite.');
  return value;
}
