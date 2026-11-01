import jwt from 'jsonwebtoken';
import type { Server, Socket } from 'socket.io';

export function desconectarSessoes(io: Server, usuarioId: number) {
  const sala = `usuario:${usuarioId}`;
  io.in(sala).disconnectSockets(true);
  io.of('/admin').in(sala).disconnectSockets(true);
}

export function agendarExpiracaoTokenVerificado(socket: Socket, token: string) {
  const payload = jwt.decode(token);
  if (!payload || typeof payload === 'string' || typeof payload.exp !== 'number') return;

  const restante = payload.exp * 1000 - Date.now();
  if (restante <= 0) {
    socket.disconnect(true);
    return;
  }

  const timer = setTimeout(() => socket.disconnect(true), Math.min(restante, 2_147_483_647));
  timer.unref();
  socket.once('disconnect', () => clearTimeout(timer));
}
