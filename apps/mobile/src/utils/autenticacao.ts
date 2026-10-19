import { fetchComTimeout } from './request';

export function emailValido(email: string) {
  return email.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Evita expor HTML, mensagens de infraestrutura ou detalhes internos da API. */
export async function lerRespostaAuth(resposta: Response, operacao: 'login' | 'cadastro') {
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    if (resposta.status === 429) throw new Error('Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.');
    if (resposta.status === 408 || resposta.status === 504) throw new Error(operacao === 'cadastro'
      ? 'O cadastro demorou para responder. Tente novamente; se a conta já tiver sido criada, use Entrar.'
      : 'O serviço demorou para responder. Aguarde um pouco e tente entrar novamente.');
    if (resposta.status === 403) throw new Error('Não foi possível autorizar esta solicitação. Aguarde um pouco e tente novamente.');
    if (resposta.status >= 500) throw new Error('O serviço está indisponível no momento. Tente novamente em instantes.');
    if (operacao === 'login' && resposta.status === 401) throw new Error('E-mail ou senha incorretos. Confira seus dados.');
    if (operacao === 'cadastro' && resposta.status === 409) throw new Error('Este e-mail já possui uma conta. Use a opção Entrar.');
    throw new Error(operacao === 'login'
      ? 'Não foi possível entrar. Confira seu e-mail e senha.'
      : 'Não foi possível criar a conta. Confira os dados e tente novamente.');
  }
  if (!dados || typeof dados !== 'object' || Array.isArray(dados) ||
      (operacao === 'cadastro' && (!Number.isInteger(dados.id) || dados.id <= 0)) ||
      (operacao === 'login' && (typeof dados.token !== 'string' || !dados.token.trim()))) {
    throw new Error('Não conseguimos confirmar a resposta do serviço. Tente novamente.');
  }
  return dados;
}

export async function enviarAutenticacao(url: string, dados: object, operacao: 'login' | 'cadastro') {
  let resposta: Response;
  try {
    resposta = await fetchComTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('A conexão demorou demais')) {
      throw new Error(operacao === 'cadastro'
        ? 'O cadastro demorou para responder. Verifique sua conexão e tente novamente. Se a conta já tiver sido criada, use Entrar.'
        : 'O serviço demorou para responder. Verifique sua conexão e tente entrar novamente em instantes.');
    }
    throw new Error(operacao === 'cadastro'
      ? 'Não recebemos a confirmação do cadastro. Verifique sua conexão e tente novamente. Se o e-mail já estiver cadastrado, use Entrar.'
      : 'Não conseguimos conectar ao Ludora. Verifique sua internet e tente entrar novamente. Se continuar, o serviço pode estar temporariamente indisponível.');
  }
  return lerRespostaAuth(resposta, operacao);
}
