import cors from 'cors';
import express from 'express';
import type { Server } from 'socket.io';

import { corsOptions, isProduction } from './config/env';
import {
  exigirAcessoTotalCategorias,
  exigirGestorDoClube,
} from './middlewares/permissoes.middleware';
import { limitarOperacaoPesada } from './middlewares/rate-limit.middleware';
import authRoutes from './modules/auth/auth.routes';
import cadastroRoutes from './modules/cadastros/cadastro.routes';
import clubeRoutes from './modules/clubes/clube.routes';
import conviteRoutes from './modules/convites/convite.routes';
import escalacaoRoutes from './modules/escalacoes/escalacao.routes';
import jogadorRoutes from './modules/jogadores/jogador.routes';
import { criarPartidaRoutes } from './modules/partidas/partida.routes';
import scoutRoutes from './modules/scout/scout.routes';
import campeonatoRoutes from './routes/campeonato.routes';
import importacaoRoutes from './routes/importacao.routes';

export function criarApp(io: Server) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 0));
  app.use(cors(corsOptions));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()'
    );
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');

    if (isProduction) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
    }

    next();
  });
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '256kb' }));

  app.use(
    '/partidas/importar',
    exigirGestorDoClube,
    exigirAcessoTotalCategorias,
    limitarOperacaoPesada,
    importacaoRoutes
  );
  app.use(
    '/campeonato/sincronizar',
    exigirGestorDoClube,
    exigirAcessoTotalCategorias,
    limitarOperacaoPesada
  );
  app.use('/campeonato', campeonatoRoutes);

  app.use(authRoutes);
  app.use(clubeRoutes);
  app.use(conviteRoutes);
  app.use(cadastroRoutes);
  app.use(jogadorRoutes);
  app.use(criarPartidaRoutes(io));
  app.use(escalacaoRoutes);
  app.use(scoutRoutes);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
  });

  app.use(
    (
      error: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const status =
        error?.type === 'entity.too.large'
          ? 413
          : error?.message === 'Origem não permitida pelo CORS'
            ? 403
            : 500;

      if (status === 500) {
        console.error('Erro não tratado:', error?.message || error);
      }

      res.status(status).json({
        error:
          status === 413
            ? 'Payload muito grande'
            : status === 403
              ? 'Origem não permitida'
              : 'Erro interno do servidor',
      });
    }
  );

  return app;
}
