export class AuthError extends Error {
  status: number;
  code?: string;
  retryAfter: number;

  constructor(message: string, status = 0, code?: string, retryAfter = 0) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export async function authRequest<T>(
  url: string,
  options: RequestInit = {},
  timeout = 20_000,
  uncertainWrite = false,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const message = response.status === 429
        ? 'Muitas tentativas. Aguarde um pouco antes de tentar novamente.'
        : response.status >= 500
          ? 'O serviço está indisponível no momento. Tente novamente em instantes.'
          : typeof body?.error === 'string'
            ? body.error
            : 'Não foi possível concluir. Confira os dados e tente novamente.';
      throw new AuthError(message, response.status, body?.code ?? body?.codigo,
        Number(response.headers.get('Retry-After')) || 0);
    }
    if (!body || typeof body !== 'object') {
      throw new AuthError('Não conseguimos confirmar a resposta do serviço. Tente novamente.');
    }
    return body as T;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError(uncertainWrite
      ? 'Não recebemos a confirmação do serviço. Verifique sua conexão. Se você estava criando uma conta, aceitando um convite ou trocando a senha, tente entrar antes de repetir a operação.'
      : 'Não conseguimos conectar ao Ludora. Verifique sua internet e tente novamente.');
  } finally {
    clearTimeout(timer);
  }
}
