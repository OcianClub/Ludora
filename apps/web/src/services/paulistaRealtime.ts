import { io } from 'socket.io-client';

/** Mesmo evento já emitido pela API após a sincronização oficial. */
export function subscribePaulistaUpdates(baseUrl: string, token: string, clubeId: number, eventoId: string, refresh: () => void, connect = io) {
  const socket = connect(baseUrl, { auth: { token, clubeId } });
  let connected = false;
  socket.on('connect', () => { if (connected) refresh(); connected = true; });
  socket.on('paulista_atualizado', (payload: { eventoId?: unknown } | null) => {
    if (payload?.eventoId != null && String(payload.eventoId) === eventoId) refresh();
  });
  return () => { socket.removeAllListeners(); socket.disconnect(); };
}
