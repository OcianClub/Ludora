import { Router, type RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { exigirAutenticacao } from '../../middlewares/auth.middleware';
import { idPositivo } from '../../utils/id';
import { validarPreferenciasPush } from './preferencias.utils';

const selecao = {
  clube_id: true,
  clube: { select: { nome: true } },
  push_gols: true,
  push_agendamentos: true,
  push_resultados: true,
} as const;

export function criarPreferenciasNotificacoesRoutes(
  banco: PrismaClient = prisma,
  autenticar: RequestHandler = exigirAutenticacao
) {
  const router = Router();

  router.get('/notificacoes/preferencias', autenticar, async (req, res) => {
    const preferencias = await banco.usuarioClube.findMany({
      where: { usuario_id: (req as any).usuarioId },
      select: selecao,
      orderBy: { clube: { nome: 'asc' } },
    });
    res.json({ preferencias });
  });

  router.patch(
    '/notificacoes/preferencias/:clubeId',
    autenticar,
    async (req, res) => {
      const clubeId = idPositivo(req.params.clubeId);
      const data = validarPreferenciasPush(req.body);
      if (!clubeId || !data) {
        return res
          .status(400)
          .json({
            error:
              'Informe um clube válido e preferências do tipo verdadeiro ou falso.',
          });
      }
      const where = {
        clube_id: clubeId,
        usuario_id: (req as any).usuarioId as number,
      };
      const atualizados = await banco.usuarioClube.updateMany({ where, data });
      if (!atualizados.count) {
        return res
          .status(403)
          .json({ error: 'Você não possui vínculo com este clube.' });
      }
      const preferencia = await banco.usuarioClube.findFirst({
        where,
        select: selecao,
      });
      if (!preferencia)
        return res
          .status(404)
          .json({ error: 'Vínculo com o clube não encontrado.' });
      res.json(preferencia);
    }
  );

  return router;
}
