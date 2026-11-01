import type { NextFunction, Request, Response } from 'express';

type RateEntry = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateEntry>();
const MAX_BUCKETS = 10_000;
let ultimaLimpeza = 0;

export function limitarRequisicoes({
  janelaMs,
  limite,
  prefixo,
  porEmail = true,
  buckets = rateBuckets,
}: {
  janelaMs: number;
  limite: number;
  prefixo: string;
  porEmail?: boolean;
  buckets?: Map<string, RateEntry>;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const agora = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'desconhecido';
    const email = porEmail && typeof req.body?.email === 'string'
      ? req.body.email.slice(0, 320).trim().toLowerCase() : '';
    const chaves = porEmail
      ? [{ chave: `${prefixo}:ip:${ip}`, maximo: limite * 5 }, { chave: `${prefixo}:email:${ip}:${email}`, maximo: limite }]
      : [{ chave: `${prefixo}:ip:${ip}`, maximo: limite }];

    if (buckets.size >= MAX_BUCKETS && agora - ultimaLimpeza > 15_000) {
      ultimaLimpeza = agora;
      for (const [chave, entrada] of buckets) if (entrada.resetAt <= agora) buckets.delete(chave);
    }

    let entrada!: RateEntry;
    let maximo = limite;
    for (const item of chaves) {
      const atual = buckets.get(item.chave);
      if (!atual && buckets.size >= MAX_BUCKETS) {
        res.setHeader('Retry-After', '60');
        return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
      }
      entrada = !atual || atual.resetAt <= agora ? { count: 0, resetAt: agora + janelaMs } : atual;
      entrada.count = Math.min(entrada.count + 1, item.maximo + 1);
      buckets.set(item.chave, entrada);
      maximo = item.maximo;
      if (entrada.count > maximo) break;
    }

    res.setHeader('RateLimit-Limit', String(maximo));
    res.setHeader(
      'RateLimit-Remaining',
      String(Math.max(0, maximo - entrada.count))
    );
    res.setHeader('RateLimit-Reset', String(Math.ceil(entrada.resetAt / 1000)));

    if (entrada.count > maximo) {
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

export const limitarLocais = limitarRequisicoes({ janelaMs: 60_000, limite: 60, prefixo: 'locais', porEmail: false });

export const limitarOperacaoPesada = limitarRequisicoes({
  janelaMs: 10 * 60_000,
  limite: 5,
  prefixo: 'heavy',
});

export const limitarRecuperacao = limitarRequisicoes({
  janelaMs: 15 * 60_000,
  limite: 10,
  prefixo: 'recuperacao',
  porEmail: false,
});

export const limitarCadastro = limitarRequisicoes({
  janelaMs: 15 * 60_000,
  limite: 20,
  prefixo: 'cadastro-confirmacao',
  porEmail: false,
});

const rateCleanup = setInterval(() => {
  const agora = Date.now();
  for (const [chave, entrada] of rateBuckets) {
    if (entrada.resetAt <= agora) rateBuckets.delete(chave);
  }
}, 10 * 60_000);

rateCleanup.unref();
