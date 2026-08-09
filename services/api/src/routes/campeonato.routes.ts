import { Router } from 'express';
import {
  getClassificacao,
  getOpcoes,
  postSincronizar,
} from '../controllers/campeonato.controller';

const router = Router();
router.get('/classificacao', getClassificacao);

router.get('/opcoes', getOpcoes);

router.post('/sincronizar', postSincronizar);

export default router;