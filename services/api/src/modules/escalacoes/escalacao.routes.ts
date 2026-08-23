import { Router } from 'express';

import { prisma } from '../../lib/prisma';
import {
  exigirGestorDoClube,
  exigirPartidaDoClube,
} from '../../middlewares/permissoes.middleware';

const router = Router();

// ==========================================
// ROTAS DE ESCALAÇÃO
// ==========================================

router.get('/partidas/:id/escalacao', async (req, res) => {
  const partidaId = Number(req.params.id);
  try {
    const escalacao = await prisma.escalacaoPartida.findMany({
      where: { partida_id: partidaId },
      include: {
        jogador: { select: { nome: true, posicao: true, numCamisa: true } },
      },
      orderBy: [{ titular: 'desc' }, { numCamisa: 'asc' }],
    });
    res.json(escalacao);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar escalação' });
  }
});

router.put<{ id: string }>(
  '/partidas/:id/escalacao',
  exigirGestorDoClube,
  exigirPartidaDoClube((req) => Number(req.params.id)),
  async (req, res) => {
    const partidaId = Number(req.params.id);
    const { jogadores } = req.body as {
      jogadores: { jogador_id: number; numCamisa: number; titular: boolean }[];
    };
    if (!Array.isArray(jogadores)) {
      return res.status(400).json({ error: 'jogadores deve ser um array' });
    }
    if (jogadores.length > 50) return res.status(400).json({ error: 'Escalação muito grande' });
    try {
      const partida = await prisma.partida.findUnique({
        where: { id: partidaId },
        select: { categoria_id: true },
      });
      if (!partida) return res.status(404).json({ error: 'Partida não encontrada' });
      const normalizados = jogadores.map((j) => ({
        jogador_id: Number(j.jogador_id),
        numCamisa: Number(j.numCamisa),
        titular: Boolean(j.titular),
      }));
      const ids = [...new Set(normalizados.map((j) => j.jogador_id))];
      const entradaValida = ids.length === normalizados.length && normalizados.every((j) =>
        Number.isSafeInteger(j.jogador_id) && j.jogador_id > 0 &&
        Number.isSafeInteger(j.numCamisa) && j.numCamisa >= 0 && j.numCamisa <= 99,
      );
      if (!entradaValida) return res.status(400).json({ error: 'Dados da escalação inválidos' });
      const jogadoresValidos = await prisma.jogador.count({
        where: { id: { in: ids }, categoria_id: partida.categoria_id },
      });
      if (jogadoresValidos !== ids.length) {
        return res.status(403).json({ error: 'Um ou mais jogadores não pertencem à categoria da partida' });
      }
      await prisma.$transaction([
        prisma.escalacaoPartida.deleteMany({ where: { partida_id: partidaId } }),
        prisma.escalacaoPartida.createMany({
          data: normalizados.map(j => ({
          partida_id: partidaId,
            ...j,
          })),
        }),
      ]);
      const nova = await prisma.escalacaoPartida.findMany({
        where: { partida_id: partidaId },
        include: { jogador: { select: { nome: true, posicao: true, numCamisa: true } } },
        orderBy: [{ titular: 'desc' }, { numCamisa: 'asc' }],
      });
      res.json(nova);
    } catch (error: any) {
      console.error('Erro ao salvar escalação:', error.message);
      res.status(500).json({ error: error.message || 'Erro ao salvar escalação' });
    }
  }
);


export default router;
