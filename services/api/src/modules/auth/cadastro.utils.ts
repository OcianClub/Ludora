import { createHmac } from 'node:crypto';
import { normalizarCodigoRecuperacao } from './recuperacao.utils';

export function hashCodigoCadastro(
  desafio: string,
  codigo: string,
  segredo: string
) {
  return createHmac('sha256', segredo)
    .update(
      `confirmacao-cadastro:${desafio}:${normalizarCodigoRecuperacao(codigo)}`
    )
    .digest('hex');
}
