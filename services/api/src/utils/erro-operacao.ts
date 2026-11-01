import type { Response } from 'express';

export class ErroOperacao extends Error {
  constructor(mensagem: string, public readonly status = 409) {
    super(mensagem);
  }
}

export function responderErroOperacao(res: Response, erro: unknown, mensagem: string) {
  if (erro instanceof ErroOperacao) {
    return res.status(erro.status).json({ error: erro.message });
  }
  if ((erro as { code?: string })?.code === 'P2034') {
    return res.status(409).json({
      error: 'Outra alteração ocorreu. Atualize e tente novamente.',
    });
  }
  return res.status(500).json({ error: mensagem });
}
