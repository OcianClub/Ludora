import type { NextFunction, Request, Response } from 'express';

import { getUsuarioId } from '../auth/jwt';

export async function exigirAutenticacao(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const usuarioId = await getUsuarioId(req);
  if (!usuarioId) return res.status(401).json({ error: 'Não autorizado' });
  (req as any).usuarioId = usuarioId;
  next();
}
