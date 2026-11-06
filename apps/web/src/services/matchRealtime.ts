import { io } from 'socket.io-client';
import type { Partida } from './api';
import { invalidateReadCache } from './readCache';
import { navigationMode } from './publicAccess';
import { BASE_URL, invalidateApiReads } from './api';
import { receiveRosterChange, type RosterChange } from './rosterRealtime';

export const PUBLIC_MATCHES_CHANGED = 'ludora:public-matches-changed';
export function subscribePublicClub(clubId: number) {
  const socket = io(`${BASE_URL}/publico`, { auth: { clubeId: clubId } });
  socket.on('partidas_alteradas', () => {
    invalidateApiReads('/partidas'); invalidateApiReads('/clubes');
    window.dispatchEvent(new Event(PUBLIC_MATCHES_CHANGED));
  });
  return () => { socket.removeAllListeners(); socket.disconnect(); };
}

export type RealtimeState = 'connecting' | 'connected' | 'disconnected' | 'error';
type ScoreUpdate = Pick<Partida, 'id' | 'gols_mandante' | 'gols_visitante'>;

interface MatchRealtimeOptions {
  baseUrl: string;
  token: string;
  clubId: number;
  matchId: number;
  onScore: (match: ScoreUpdate) => void;
  onRefresh: () => void;
  onStateChange: (state: RealtimeState) => void;
  onRoster?: (change: RosterChange) => void;
}

// Os nomes dos eventos e o campo clubeId seguem o contrato da API existente.
export function subscribeToMatch(options: MatchRealtimeOptions): () => void {
  const { baseUrl, token, clubId, matchId, onScore, onRefresh, onStateChange } = options;
  const isPublic = navigationMode() === 'publico';
  const invalidateMatches = () => invalidateReadCache(`${baseUrl.replace(/\/$/, '')}:${token}:${clubId}:${navigationMode()}\n/partidas`);
  const socket = io(isPublic ? `${baseUrl}/publico` : baseUrl, {
    auth: { token, clubeId: clubId },
    autoConnect: false,
  });
  let connectedBefore = false;
  if (!isPublic) socket.on('elenco_atualizado', value => receiveRosterChange(value, clubId, change => {
    options.onRoster?.(change); onRefresh();
  }));

  socket.on('connect', () => {
    onStateChange('connected');
    if (!isPublic) invalidateApiReads('/jogadores');
    if (!isPublic || connectedBefore) onRefresh();
    connectedBefore = true;
  });
  socket.on('disconnect', () => onStateChange('disconnected'));
  socket.on('connect_error', () => onStateChange('error'));
  socket.on('partidas_alteradas', (match: { partida_id: number }) => {
    invalidateMatches(); if (match.partida_id === matchId) onRefresh();
  });

  socket.on('placar_atualizado', (match: ScoreUpdate) => {
    invalidateMatches();
    if (match.id === matchId) onScore(match);
  });
  socket.on('evento_partida', (event: { partida_id: number }) => {
    invalidateMatches();
    if (event.partida_id === matchId) onRefresh();
  });
  socket.on('partida_atualizada', (match: {id:number}) => {
    invalidateMatches();
    if (match.id === matchId) onRefresh();
  });

  onStateChange('connecting');
  socket.connect();

  return () => {
    socket.removeAllListeners();
    socket.disconnect();
  };
}
