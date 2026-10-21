import { Router, type RequestHandler } from 'express';
import { dataHomeValida } from './home.service';

export function criarHomeRoutes(
  exigirClube: RequestHandler,
  consultar: (clubeId: number, hoje: string) => Promise<unknown[]>
) {
  const router = Router();
  router.get('/partidas/home', exigirClube, async (req, res) => {
    if (!dataHomeValida(req.query.hoje)) {
      res.status(400).json({ error: 'Informe uma data válida para a Home' });
      return;
    }
    try {
      res.json(
        await consultar(
          (req as typeof req & { clubeId: number }).clubeId,
          req.query.hoje
        )
      );
    } catch {
      res.status(500).json({ error: 'Erro ao buscar resumo do clube' });
    }
  });
  return router;
}
