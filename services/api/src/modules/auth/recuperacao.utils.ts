import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const VALIDADE_RECUPERACAO_MS = 15 * 60_000;
export const INTERVALO_REENVIO_MS = 60_000;
export const MAX_TENTATIVAS_RECUPERACAO = 5;

export function gerarCodigoRecuperacao() {
  return Array.from(
    { length: 8 },
    () => ALFABETO[randomInt(ALFABETO.length)]
  ).join('');
}

export function normalizarCodigoRecuperacao(codigo: string) {
  return codigo.toUpperCase().replace(/[\s-]/g, '');
}

export function hashCodigoRecuperacao(
  usuarioId: number,
  codigo: string,
  segredo: string
) {
  return createHmac('sha256', segredo)
    .update(
      `recuperacao-senha:${usuarioId}:${normalizarCodigoRecuperacao(codigo)}`
    )
    .digest('hex');
}

export function codigoRecuperacaoValido(codigo: string) {
  return /^[A-HJ-NP-Z2-9]{8}$/.test(normalizarCodigoRecuperacao(codigo));
}

export function hashesRecuperacaoIguais(a: string, b: string) {
  const primeiro = Buffer.from(a, 'hex');
  const segundo = Buffer.from(b, 'hex');
  return (
    primeiro.length === segundo.length && timingSafeEqual(primeiro, segundo)
  );
}
