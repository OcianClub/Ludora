import { BASE_URL } from '../../services/api';
import { fetchComTimeout } from '../../utils/request';

export async function solicitarCodigoCadastro(email: string): Promise<string> {
  let resposta: Response;
  try {
    resposta = await fetchComTimeout(
      `${BASE_URL}/auth/cadastro/solicitar-codigo`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      }
    );
  } catch {
    throw new Error(
      'Não conseguimos conectar ao Ludora. Verifique sua internet e tente novamente.'
    );
  }
  if (resposta.status === 409)
    throw new Error('Este e-mail já possui uma conta. Use a opção Entrar.');
  if (resposta.status === 429)
    throw new Error(
      'Aguarde um minuto antes de pedir outro código. Se continuar, aguarde alguns minutos.'
    );
  if (resposta.status >= 500)
    throw new Error(
      'Não foi possível enviar o código agora. Tente novamente em instantes.'
    );
  const dados = await resposta.json().catch(() => null);
  if (
    !resposta.ok ||
    typeof dados?.cadastro_id !== 'string' ||
    !/^[a-f0-9]{64}$/.test(dados.cadastro_id)
  ) {
    throw new Error(
      'Não conseguimos confirmar o envio. Confira seu e-mail e tente novamente.'
    );
  }
  return dados.cadastro_id;
}
