import { BASE_URL } from '../../services/api';
import { fetchComTimeout } from '../../utils/request';
import { normalizarCodigoSenha } from '../../utils/recuperacaoSenha';

async function enviar(endpoint: string, dados: object, redefinindo = false) {
  let resposta: Response;
  try {
    resposta = await fetchComTimeout(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    });
  } catch {
    throw new Error(
      redefinindo
        ? 'Não recebemos a confirmação da alteração. Verifique sua conexão e tente entrar com a nova senha antes de solicitar outro código.'
        : 'Não conseguimos conectar ao Ludora. Verifique sua internet e tente novamente.'
    );
  }

  if (resposta.status === 429) {
    throw new Error(
      'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.'
    );
  }
  if (resposta.status >= 500) {
    throw new Error(
      'A recuperação está indisponível no momento. Tente novamente em instantes.'
    );
  }
  if (!resposta.ok) {
    throw new Error(
      redefinindo
        ? 'Código inválido, expirado ou já utilizado. Confira o e-mail e o código ou solicite um novo.'
        : 'Não foi possível solicitar o código. Confira seu e-mail e tente novamente.'
    );
  }
  const dadosResposta = await resposta.json().catch(() => null);
  if (typeof dadosResposta?.mensagem !== 'string') {
    throw new Error(
      'Não conseguimos confirmar a resposta do serviço. Tente novamente.'
    );
  }
}

export function solicitarCodigoSenha(email: string) {
  return enviar('/auth/recuperar-senha', { email: email.trim().toLowerCase() });
}

export function redefinirSenha(email: string, codigo: string, senha: string) {
  return enviar(
    '/auth/redefinir-senha',
    {
      email: email.trim().toLowerCase(),
      codigo: normalizarCodigoSenha(codigo),
      senha,
    },
    true
  );
}
