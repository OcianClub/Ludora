import { createHash, randomInt } from 'crypto';

const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function gerarHashConvite(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function gerarCodigoConvite(): string {
  let codigo = '';

  for (let indice = 0; indice < 8; indice++) {
    codigo += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)];
  }

  return `${codigo.slice(0, 4)}-${codigo.slice(4)}`;
}

export function normalizarCodigoConvite(codigo: string): string {
  return codigo.trim().toUpperCase().replace(/[\s-]/g, '');
}

export function codigoConviteValido(codigo: string): boolean {
  const codigoNormalizado = normalizarCodigoConvite(codigo);

  return (
    codigoNormalizado.length === 8 &&
    [...codigoNormalizado].every(caractere =>
      ALFABETO_CODIGO.includes(caractere)
    )
  );
}

export function gerarHashCodigoConvite(codigo: string): string {
  return gerarHashConvite(normalizarCodigoConvite(codigo));
}

export function obterFiltroCredencialConvite(
  params: Record<string, string | string[] | undefined>
) {
  const obterParametro = (valor: string | string[] | undefined) =>
    Array.isArray(valor) ? valor[0] ?? '' : valor ?? '';

  const codigo = obterParametro(params.codigo).trim();
  if (codigo) {
    if (!codigoConviteValido(codigo)) return null;
    return { codigo_hash: gerarHashCodigoConvite(codigo) };
  }

  const token = obterParametro(params.token).trim();
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) return null;
  return { token_hash: gerarHashConvite(token) };
}
