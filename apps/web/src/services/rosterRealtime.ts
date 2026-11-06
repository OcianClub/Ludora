import { io } from 'socket.io-client';
import { BASE_URL, invalidateApiReads } from './api';

export type RosterChange = { clube_id: number; jogadores: { id: number; numCamisa: number | null; categoria_id: number }[] };

export function receiveRosterChange(value: RosterChange, clubId: number, onChange: (change: RosterChange) => void) {
  if (value?.clube_id !== clubId || !Array.isArray(value.jogadores) || !value.jogadores.length || value.jogadores.some(j =>
    !j || !Number.isSafeInteger(j.id) || j.id < 1 || !Number.isSafeInteger(j.categoria_id) || j.categoria_id < 1 ||
    (j.numCamisa !== null && (!Number.isInteger(j.numCamisa) || j.numCamisa < 1 || j.numCamisa > 99)))) return;
  invalidateApiReads('/jogadores');
  invalidateApiReads('/partidas');
  onChange(value);
}

export function subscribeToRoster(clubId: number, token: string, onChange: (change: RosterChange) => void, onReconnect: () => void) {
  const socket = io(BASE_URL, { auth: { token, clubeId: clubId } });
  socket.on('elenco_atualizado', value => receiveRosterChange(value, clubId, onChange));
  socket.on('connect', () => { invalidateApiReads('/jogadores'); onReconnect(); });
  return () => { socket.removeAllListeners(); socket.disconnect(); };
}
