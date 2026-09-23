import { io } from 'socket.io-client';
import type { Partida } from './api';

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
}

// Os nomes dos eventos e o campo clubeId seguem o contrato da API existente.
export function subscribeToMatch(options: MatchRealtimeOptions): () => void {
  const { baseUrl, token, clubId, matchId, onScore, onRefresh, onStateChange } = options;
  const socket = io(baseUrl, {
    auth: { token, clubeId: clubId },
    autoConnect: false,
  });

  socket.on('connect', () => {
    onStateChange('connected');
    onRefresh();
  });
  socket.on('disconnect', () => onStateChange('disconnected'));
  socket.on('connect_error', () => onStateChange('error'));

  socket.on('placar_atualizado', (match: ScoreUpdate) => {
    if (match.id === matchId) onScore(match);
  });
  socket.on('evento_partida', (event: { partida_id: number }) => {
    if (event.partida_id === matchId) onRefresh();
  });

  onStateChange('connecting');
  socket.connect();

  return () => {
    socket.removeAllListeners();
    socket.disconnect();
  };
}
