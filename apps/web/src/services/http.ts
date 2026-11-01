export class RequestError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'timeout' | 'response',
  ) {
    super(message);
    this.name = 'RequestError';
  }
}

export async function fetchJsonResponse(
  url: string,
  options: RequestInit = {},
  timeout = 20_000,
): Promise<Response> {
  const controller = new AbortController();
  const caller = options.signal;
  let timedOut = false;
  const abort = () => controller.abort(caller?.reason);
  if (caller?.aborted) throw caller.reason || new DOMException('Consulta cancelada', 'AbortError');
  caller?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);

  try {
    const result = await fetch(url, { ...options, signal: controller.signal });
    const text = await result.text();
    let body: unknown;
    let validJson = false;
    try { body = JSON.parse(text); validJson = true; } catch { body = null; }

    if (!result.ok) {
      const message = result.status === 429
        ? 'Muitas tentativas. Aguarde um pouco antes de tentar novamente.'
        : result.status >= 500
          ? 'O serviço está indisponível no momento. Tente novamente em instantes.'
          : result.status === 401
            ? 'Seu acesso expirou. Entre novamente para continuar.'
            : result.status === 403
              ? 'Seu acesso não permite realizar esta operação.'
              : 'Não foi possível concluir a solicitação. Confira os dados e tente novamente.';
      const details = body && typeof body === 'object' && !Array.isArray(body) && result.status < 500
        ? body as Record<string, unknown>
        : {};
      const error = result.status < 500 && typeof details.error === 'string'
        ? details.error
        : message;
      return new Response(JSON.stringify({ ...details, error }), {
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
      });
    }

    if ([204, 205].includes(result.status)) return result;
    if (!validJson) {
      throw new RequestError('Não conseguimos confirmar a resposta do serviço. Tente novamente.', 'response');
    }
    return new Response(text, {
      status: result.status,
      statusText: result.statusText,
      headers: result.headers,
    });
  } catch (error) {
    if (caller?.aborted && caller.reason?.name !== 'TimeoutError') {
      throw caller.reason || new DOMException('Consulta cancelada', 'AbortError');
    }
    if (error instanceof RequestError) throw error;
    const write = !['GET', 'HEAD'].includes((options.method || 'GET').toUpperCase());
    const uncertain = write ? ' A confirmação não chegou; confira se a alteração foi salva antes de repetir.' : '';
    if (timedOut || caller?.reason?.name === 'TimeoutError') {
      throw new RequestError(`O serviço demorou para responder. Verifique sua conexão e tente novamente.${uncertain}`, 'timeout');
    }
    throw new RequestError(`Não conseguimos conectar ao Ludora. Verifique sua internet e tente novamente.${uncertain}`, 'network');
  } finally {
    clearTimeout(timer);
    caller?.removeEventListener('abort', abort);
  }
}
