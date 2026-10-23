import { Router, type RequestHandler } from 'express';
import { FiltroDataInvalido } from './filtros-data.utils';

export function criarAgendaRoutes(
  exigirClube: RequestHandler,
  consultar: (clubeId: number, filtros: Record<string, unknown>) => Promise<unknown[]>
) {
  const router = Router();
  router.get('/partidas/agenda', exigirClube, async (req, res) => {
    try {
      const clubeId = (req as typeof req & { clubeId: number }).clubeId;
      res.json(await consultar(clubeId, req.query));
    } catch (erro) {
      res.status(erro instanceof FiltroDataInvalido ? 400 : 500).json({
        error: erro instanceof FiltroDataInvalido
          ? erro.message
          : 'Não foi possível carregar a agenda do clube.',
      });
    }
  });
  return router;
}
