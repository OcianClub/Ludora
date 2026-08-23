import { Router } from 'express';

import { PYTHON_AI_URL } from '../../config/env';
import {
  exigirAcessoTotalCategorias,
  exigirGestorDoClube,
} from '../../middlewares/permissoes.middleware';
import { limitarOperacaoPesada } from '../../middlewares/rate-limit.middleware';
import { processarMachineLearning } from '../../services/scout-ia.service';

const router = Router();

router.post('/admin/reprocessar-scout', exigirGestorDoClube, exigirAcessoTotalCategorias, limitarOperacaoPesada, async (req, res) => {
  if (!PYTHON_AI_URL) {
    return res.status(503).json({ error: 'PYTHON_AI_URL não configurada no servidor.' });
  }
  res.json({ ok: true, mensagem: 'Scout IA iniciado em background. Aguarde ~60s e consulte /jogadores/perfis.' });
  processarMachineLearning((req as any).clubeId).catch(err => console.error('Erro no reprocessamento manual:', err));
});


export default router;
