export function emailValido(email: string) {
  return email.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Evita expor HTML, mensagens de infraestrutura ou detalhes internos da API. */
export async function lerRespostaAuth(resposta: Response, operacao: 'login' | 'cadastro') {
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    if (resposta.status === 429) throw new Error('Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.');
    if (resposta.status >= 500) throw new Error('O serviço está indisponível no momento. Tente novamente em instantes.');
    if (operacao === 'login' && resposta.status === 401) throw new Error('E-mail ou senha incorretos. Confira seus dados.');
    if (operacao === 'cadastro' && resposta.status === 409) throw new Error('Este e-mail já possui uma conta. Use a opção Entrar.');
    throw new Error(operacao === 'login'
      ? 'Não foi possível entrar. Confira seu e-mail e senha.'
      : 'Não foi possível criar a conta. Confira os dados e tente novamente.');
  }
  if (!dados || (operacao === 'login' && (typeof dados.token !== 'string' || !dados.token.trim()))) {
    throw new Error('Não conseguimos confirmar a resposta do serviço. Tente novamente.');
  }
  return dados;
}
