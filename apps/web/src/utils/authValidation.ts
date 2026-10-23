export const normalizarEmail = (email: string) => email.trim().toLowerCase();

export function erroNome(nome: string) {
  return nome.trim().length < 2 || nome.trim().length > 100
    ? 'Informe um nome com 2 a 100 caracteres.'
    : '';
}

export function erroEmail(email: string) {
  return email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ? 'Digite um e-mail válido, como nome@exemplo.com.'
    : '';
}

export function erroSenha(senha: string) {
  if (senha.length < 8) return 'Use pelo menos 8 caracteres na senha.';
  if (new TextEncoder().encode(senha).length > 72) return 'A senha está muito longa. Use até 72 bytes.';
  return '';
}

export function erroConfirmacao(senha: string, confirmacao: string) {
  return senha !== confirmacao || !confirmacao ? 'Repita a mesma senha para confirmar.' : '';
}

export const normalizarCodigo = (codigo: string) => codigo.toUpperCase().replace(/[\s-]/g, '');
export const codigoValido = (codigo: string) => /^[A-HJ-NP-Z2-9]{8}$/.test(normalizarCodigo(codigo));

export function formatarCodigo(codigo: string) {
  const limpo = normalizarCodigo(codigo).slice(0, 8);
  return limpo.length > 4 ? `${limpo.slice(0, 4)}-${limpo.slice(4)}` : limpo;
}

export function caminhoConvite(credencial: string, token = false) {
  if (token) {
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(credencial)) return null;
    return `/convites/${encodeURIComponent(credencial)}`;
  }
  return codigoValido(credencial)
    ? `/convites/codigo/${encodeURIComponent(normalizarCodigo(credencial))}`
    : null;
}
