import type { Server } from 'socket.io';
import type { PrismaClient } from '@prisma/client';
import { idPositivo } from '../utils/id';

export function registrarNamespacePublico(io: Server, banco: PrismaClient) {
  const publico = io.of('/publico');
  publico.use(async (socket, next) => {
    const clubeId = idPositivo(socket.handshake.auth?.clubeId);
    if (!clubeId) return next(new Error('Clube inválido'));
    try {
      if (!await banco.clube.findUnique({ where: { id: clubeId }, select: { id: true } })) return next(new Error('Clube não encontrado'));
      socket.data.clubeId = clubeId; next();
    } catch { next(new Error('Consulta indisponível')); }
  });
  publico.on('connection', socket => {
    // Namespace e salas distintos dos canais privados de usuário e de gestão.
    void socket.join(`publico:clube:${socket.data.clubeId}`);
  });
}
export function notificarPartidaPublica(io: Server, partida: {
  id: number; categoria: { clube_id: number }; participantes?: { clube_id: number }[];
  mandante?: { clube_representado_id?: number | null }; visitante?: { clube_representado_id?: number | null };
}) {
  const clubes = new Set([partida.categoria.clube_id, partida.mandante?.clube_representado_id,
    partida.visitante?.clube_representado_id, ...(partida.participantes || []).map(team => team.clube_id)]);
  for (const clube of clubes) if (clube) io.of('/publico').to(`publico:clube:${clube}`).emit('partidas_alteradas', { partida_id: partida.id });
}
