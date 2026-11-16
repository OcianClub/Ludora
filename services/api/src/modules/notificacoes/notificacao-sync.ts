import type { RequestHandler } from 'express';
/** Broadcast only after an authorized mutation commits a successful response. */
export const sincronizarNotificacoes: RequestHandler = (req, res, next) => {
  if (['PATCH', 'DELETE'].includes(req.method)) res.on('finish', () => {
    const usuarioId = (req as any).usuarioId;
    if (res.statusCode < 400 && usuarioId) req.app.get('io')?.to(`usuario:${usuarioId}`).emit('notificacoes_atualizadas', { clubeId: (req as any).clubeId });
  });
  next();
};
