import { fetchRecoverableJsonResponse, isTemporaryServerError, RequestError } from './http';
import { waitForApiConnection, reportApiConnection } from './apiConnection';

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
  try {
    const method = (options.method ?? 'GET').toUpperCase();
    const isRead = method === 'GET' || method === 'HEAD';
    if (!isRead) {
      const connection = waitForApiConnection(url, options.signal);
      if (connection) await connection;
    }
    const retryLogin = method === 'POST' && url.endsWith('/auth/login');
    const response = await fetchRecoverableJsonResponse(
      url, options, timeout, retryLogin,
      isRead ? () => waitForApiConnection(url, options.signal) : undefined,
    );
    if (!isTemporaryServerError(response.status)) reportApiConnection(url);
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
    if (options.signal?.aborted) throw error;
    if (error instanceof AuthError) throw error;
    if (error instanceof RequestError && error.kind === 'response') throw new AuthError(error.message);
    throw new AuthError(uncertainWrite
      ? 'Não recebemos a confirmação do serviço. Verifique sua conexão. Se você estava criando uma conta, aceitando um convite ou trocando a senha, tente entrar antes de repetir a operação.'
      : globalThis.navigator?.onLine === false
        ? 'Seu dispositivo está sem internet. Reconecte-se à rede e tente novamente.'
        : error instanceof RequestError && error.kind === 'timeout'
          ? 'O Ludora demorou para responder. Aguarde um instante e tente novamente.'
          : 'Não foi possível conectar ao Ludora. Confira sua conexão e tente novamente.');
  }
}
