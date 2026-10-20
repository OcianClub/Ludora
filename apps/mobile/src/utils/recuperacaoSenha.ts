export function normalizarCodigoSenha(codigo: string) {
  return codigo.toUpperCase().replace(/[\s-]/g, '');
}

export function codigoSenhaValido(codigo: string) {
  return /^[A-HJ-NP-Z2-9]{8}$/.test(normalizarCodigoSenha(codigo));
}

export function senhaRecuperacaoValida(senha: string) {
  const bytes = Array.from(senha).reduce((total, caractere) => {
    const ponto = caractere.codePointAt(0)!;
    return (
      total + (ponto <= 0x7f ? 1 : ponto <= 0x7ff ? 2 : ponto <= 0xffff ? 3 : 4)
    );
  }, 0);
  return senha.length >= 8 && bytes <= 72;
}
