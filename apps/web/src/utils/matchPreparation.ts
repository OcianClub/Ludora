import type { GestaoPartida } from '../services/sharedMatches';

export function preparationStorageKey(userId: number | undefined, clubId: number | undefined, matchId: string | undefined) {
  return `ludora:preparation:${userId}:${clubId}:${matchId}`;
}

export function resolvePreparationStep(data: GestaoPartida, stored: string | null): number {
  if (!data.podePreparar || !['AGENDADA', 'PREPARADA'].includes(data.partida.status)) return 0;
  if (!data.partida.data || !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.partida.horario || '')) return 0;
  const mine = data.equipes.find(team => team.id === data.minhaEquipeId);
  const lineup = mine?.escalacao || [];
  const valid = lineup.filter(player => player.titular).length === data.partida.titulares_necessarios
    && lineup.every(player => Number.isInteger(player.numCamisa) && player.numCamisa >= 1 && player.numCamisa <= 99);
  const step = stored === null ? (mine?.pronta ? 2 : lineup.length ? 1 : 0) : Number(stored);
  if (![0, 1, 2].includes(step)) return mine?.pronta && valid ? 2 : 0;
  return step === 2 && !valid ? 1 : step;
}

export function readPreparationStep(data: GestaoPartida, key: string) {
  try { return resolvePreparationStep(data, localStorage.getItem(key)); }
  catch { return resolvePreparationStep(data, null); }
}

export function rememberPreparationStep(key: string, step: number | null) {
  try {
    if (step === null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(step));
  } catch { /* A navegação continua quando o navegador bloqueia o armazenamento. */ }
}
