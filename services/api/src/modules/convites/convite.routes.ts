import { Router } from 'express';

import conviteAdminRoutes from './convite-admin.routes';
import convitePublicoRoutes from './convite-publico.routes';

const router = Router();

router.use(conviteAdminRoutes);
router.use(convitePublicoRoutes);

export default router;
