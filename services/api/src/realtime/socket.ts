import { Server } from 'socket.io';

import { getUsuarioIdPeloToken } from '../auth/jwt';
import { corsOptions } from '../config/env';
import { prisma } from '../lib/prisma';
import { idPositivo } from '../utils/id';
import { registrarNamespaceAdmin } from '../modules/admin/superadmin';
import { agendarExpiracaoTokenVerificado } from './sessoes';
import { registrarNamespacePublico } from './publico';

export function criarSocketServer(
  autenticarToken = getUsuarioIdPeloToken,
  banco = prisma
) {
  const io = new Server({ cors: corsOptions });

  io.use(async (socket, next) => {
    const authHeader = String(socket.handshake.headers.authorization || '');
    const tokenInformado = String(
      socket.handshake.auth?.token || authHeader.replace(/^Bearer\s+/i, '')
    );
    const clubeId = idPositivo(
      socket.handshake.auth?.clubeId || socket.handshake.headers['x-clube-id']
    );
    const usuarioId = await autenticarToken(tokenInformado);

    if (!usuarioId || !clubeId) return next(new Error('Não autorizado'));

    try {
      const clube = await banco.clube.findUnique({
        where: { id: clubeId },
        select: { id: true },
      });

      if (!clube) return next(new Error('Não autorizado'));

      socket.data.clubeId = clubeId;
      socket.data.usuarioId = usuarioId;
      socket.data.token = tokenInformado;
      next();
    } catch {
      next(new Error('Não autorizado'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`clube:${socket.data.clubeId}`);
    socket.join(`usuario:${socket.data.usuarioId}`);
    agendarExpiracaoTokenVerificado(socket, socket.data.token);
    delete socket.data.token;
  });

  const suporte = io.of('/suporte');
  suporte.use(async (socket, next) => {
    try {
      const token = String(socket.handshake.auth?.token || '');
      const usuarioId = await autenticarToken(token);
      if (!usuarioId) return next(new Error('Não autorizado'));
      socket.data.usuarioId = usuarioId;
      socket.data.token = token;
      next();
    } catch {
      next(new Error('Não autorizado'));
    }
  });
  suporte.on('connection', socket => {
    void socket.join('usuario:' + socket.data.usuarioId);
    agendarExpiracaoTokenVerificado(socket, socket.data.token);
    delete socket.data.token;
  });

  registrarNamespacePublico(io, banco);
  registrarNamespaceAdmin(io);
  return io;
}
