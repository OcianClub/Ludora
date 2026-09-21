import type { NextFunction, Request, Response } from 'express';

type RateEntry = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateEntry>();

function limitarRequisicoes({
  janelaMs,
  limite,
  prefixo,
}: {
  janelaMs: number;
  limite: number;
  prefixo: string;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const agora = Date.now();
    const identidade = `${req.ip}:${String(req.body?.email || '')
      .trim()
      .toLowerCase()}`;
    const chave = `${prefixo}:${identidade}`;
    const atual = rateBuckets.get(chave);
    const entrada =
      !atual || atual.resetAt <= agora
        ? { count: 0, resetAt: agora + janelaMs }
        : atual;

    entrada.count += 1;
    rateBuckets.set(chave, entrada);

    res.setHeader('RateLimit-Limit', String(limite));
    res.setHeader(
      'RateLimit-Remaining',
      String(Math.max(0, limite - entrada.count))
    );
    res.setHeader('RateLimit-Reset', String(Math.ceil(entrada.resetAt / 1000)));

    if (entrada.count > limite) {
      res.setHeader(
        'Retry-After',
        String(Math.ceil((entrada.resetAt - agora) / 1000))
      );
      return res
        .status(429)
        .json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
    }

    next();
  };
}

export const limitarAuth = limitarRequisicoes({
  janelaMs: 15 * 60_000,
  limite: 20,
  prefixo: 'auth',
});

export const limitarOperacaoPesada = limitarRequisicoes({
  janelaMs: 10 * 60_000,
  limite: 5,
  prefixo: 'heavy',
});

const rateCleanup = setInterval(() => {
  const agora = Date.now();
  for (const [chave, entrada] of rateBuckets) {
    if (entrada.resetAt <= agora) rateBuckets.delete(chave);
  }
}, 10 * 60_000);

rateCleanup.unref();
