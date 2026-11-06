import type { Server } from 'socket.io';
import { prisma } from '../../lib/prisma';

type Alteracao = { id: number; numCamisa: number | null; categoria_id: number };

// Disparado somente depois do commit. Não publica CPF, nomes ou rascunhos.
export async function notificarCamisas(io: Server | undefined, clubeId: number, salvo: {
  camisas_atualizadas: Alteracao[]; escalacoes_atualizadas: { partida_id: number }[];
}, banco = prisma) {
  if (!io || !salvo.camisas_atualizadas.length) return;
  io.to(`clube:${clubeId}`).emit('elenco_atualizado', { clube_id: clubeId, jogadores: salvo.camisas_atualizadas });
  const partidas = salvo.escalacoes_atualizadas.map(p => p.partida_id);
  if (!partidas.length) return;
  const participantes = await banco.participantePartida.findMany({
    where: { partida_id: { in: partidas } }, select: { partida_id: true, clube_id: true },
  });
  for (const partidaId of partidas) {
    const clubes = new Set([clubeId, ...participantes.filter(p => p.partida_id === partidaId).map(p => p.clube_id)]);
    for (const id of clubes) io.to(`clube:${id}`).emit('partida_atualizada', { id: partidaId });
  }
}
