import { Router } from 'express';

import { exigirAutenticacao } from '../../middlewares/auth.middleware';
import { exigirMembroDoClube } from '../../middlewares/permissoes.middleware';
import { prisma } from '../../lib/prisma';
import { idPositivo } from '../../utils/id';
import { criarPreferenciasNotificacoesRoutes } from './preferencias.routes';

const LIMITE_PADRAO = 50;
const LIMITE_MAXIMO = 100;

export default function criarNotificacaoRoutes() {
  const router = Router();
  router.use(criarPreferenciasNotificacoesRoutes());

  router.get('/notificacoes', exigirMembroDoClube, async (req, res) => {
    const usuarioId = (req as any).usuarioId as number;
    const clubeId = (req as any).clubeId as number;
    const limiteInformado = Number(req.query.limite);
    const limite = Number.isSafeInteger(limiteInformado)
      ? Math.min(Math.max(limiteInformado, 1), LIMITE_MAXIMO)
      : LIMITE_PADRAO;

    try {
      const [notificacoes, totalNaoLidas] = await Promise.all([
        prisma.notificacao.findMany({
          where: { usuario_id: usuarioId, clube_id: clubeId },
          orderBy: { criada_em: 'desc' },
          take: limite,
        }),
        prisma.notificacao.count({
          where: { usuario_id: usuarioId, clube_id: clubeId, lida: false },
        }),
      ]);

      res.json({ notificacoes, totalNaoLidas });
    } catch {
      res.status(500).json({ error: 'Não foi possível buscar as notificações' });
    }
  });

  router.patch('/notificacoes/lidas', exigirMembroDoClube, async (req, res) => {
    const usuarioId = (req as any).usuarioId as number;
    const clubeId = (req as any).clubeId as number;

    try {
      const resultado = await prisma.notificacao.updateMany({
        where: { usuario_id: usuarioId, clube_id: clubeId, lida: false },
        data: { lida: true },
      });
      res.json({ atualizadas: resultado.count });
    } catch {
      res.status(500).json({ error: 'Não foi possível atualizar as notificações' });
    }
  });

  router.patch('/notificacoes/:id/lida', exigirMembroDoClube, async (req, res) => {
    const notificacaoId = idPositivo(req.params.id);
    if (!notificacaoId) return res.status(400).json({ error: 'Notificação inválida' });

    const usuarioId = (req as any).usuarioId as number;
    const clubeId = (req as any).clubeId as number;

    try {
      const resultado = await prisma.notificacao.updateMany({
        where: {
          id: notificacaoId,
          usuario_id: usuarioId,
          clube_id: clubeId,
        },
        data: { lida: true },
      });

      if (resultado.count === 0) {
        return res.status(404).json({ error: 'Notificação não encontrada' });
      }

      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Não foi possível atualizar a notificação' });
    }
  });

  router.delete('/notificacoes/lidas', exigirMembroDoClube, async (req, res) => {
    try {
      const resultado = await prisma.notificacao.deleteMany({
        where: {
          usuario_id: (req as any).usuarioId,
          clube_id: (req as any).clubeId,
          lida: true,
        },
      });
      res.json({ removidas: resultado.count });
    } catch {
      res.status(500).json({ error: 'Não foi possível limpar as notificações lidas' });
    }
  });

  router.delete('/notificacoes/dispositivos', exigirAutenticacao, async (req, res) => {
    const token = String(req.body?.token || '').trim();
    if (!/^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(token)) {
      return res.status(400).json({ error: 'Token de push inválido' });
    }
    try {
      await prisma.dispositivoPush.deleteMany({
        where: { usuario_id: (req as any).usuarioId, token },
      });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Não foi possível desvincular o dispositivo' });
    }
  });

  router.delete('/notificacoes/:id', exigirMembroDoClube, async (req, res) => {
    const id = idPositivo(req.params.id);
    if (!id) return res.status(400).json({ error: 'Notificação inválida' });

    try {
      await prisma.notificacao.deleteMany({
        where: {
          id,
          usuario_id: (req as any).usuarioId,
          clube_id: (req as any).clubeId,
        },
      });
      // Exclusão idempotente: repetir a ação não produz um erro na interface.
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Não foi possível excluir a notificação' });
    }
  });

  router.post('/notificacoes/dispositivos', exigirAutenticacao, async (req, res) => {
    const token = String(req.body?.token || '').trim();
    const plataforma = String(req.body?.plataforma || '').trim().toLowerCase();

    if (!/^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(token)) {
      return res.status(400).json({ error: 'Token de push inválido' });
    }
    if (plataforma && !['android', 'ios'].includes(plataforma)) {
      return res.status(400).json({ error: 'Plataforma inválida' });
    }

    try {
      const dispositivo = await prisma.dispositivoPush.upsert({
        where: { token },
        update: {
          usuario_id: (req as any).usuarioId,
          plataforma: plataforma || null,
        },
        create: {
          token,
          plataforma: plataforma || null,
          usuario_id: (req as any).usuarioId,
        },
      });

      res.status(201).json({ id: dispositivo.id });
    } catch {
      res.status(500).json({ error: 'Não foi possível registrar o dispositivo' });
    }
  });

  return router;
}
