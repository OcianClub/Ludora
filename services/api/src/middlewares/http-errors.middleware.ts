import type { ErrorRequestHandler, RequestHandler } from 'express';

export const protegerCacheHttp: RequestHandler = (req, res, next) => {
  const sensivel = /^\/(?:auth|usuarios|convites|notificacoes|admin)(?:\/|$)/.test(req.path)
    || /\/membros(?:\/|$)/.test(req.path);
  res.setHeader('Cache-Control', sensivel ? 'no-store' : 'private, no-cache');
  next();
};

export const tratarErroHttp: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error);

  const tipo = error?.type;
  const status = tipo === 'entity.too.large' ? 413
    : tipo === 'entity.parse.failed' || tipo === 'request.aborted' ? 400
    : tipo === 'charset.unsupported' || tipo === 'encoding.unsupported' ? 415
    : error?.message === 'Origem não permitida pelo CORS' ? 403
    : 500;
  const mensagens: Record<number, string> = {
    400: 'Não foi possível interpretar os dados enviados. Confira o formato da requisição.',
    403: 'Origem não permitida',
    413: 'Payload muito grande',
    415: 'Formato de dados não suportado',
    500: 'Erro interno do servidor',
  };

  if (status === 500) console.error('Erro não tratado:', error?.name || 'Error');
  res.status(status).json({ error: mensagens[status] });
};
