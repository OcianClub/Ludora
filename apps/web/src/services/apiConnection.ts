import { RequestError } from './http';

export type ConnectionState = 'idle' | 'connecting' | 'slow' | 'ready' | 'error';

export function createApiConnection(baseUrl: string, timeout = 90_000, slowAfter = 4_000) {
  let state: ConnectionState = 'idle';
  let pending: Promise<void> | undefined;
  let readyAt = 0;
  let failedAt = 0;
  let lastError: RequestError | undefined;
  const listeners = new Set<() => void>();
  const update = (value: ConnectionState) => {
    if (state === value) return;
    state = value;
    listeners.forEach(listener => listener());
  };

  function prepare(): Promise<void> {
    if (pending) return pending;
    if (state === 'ready' && Date.now() - readyAt < 10 * 60_000) {
      readyAt = Date.now();
      return Promise.resolve();
    }
    update('connecting');
    const controller = new AbortController();
    const slow = setTimeout(() => { if (state === 'connecting') update('slow'); }, slowAfter);
    const deadline = setTimeout(() => controller.abort(), timeout);
    pending = (async () => {
      await Promise.resolve();
      try {
        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/health`, {
          signal: controller.signal,
          cache: 'no-store',
          credentials: 'omit',
        });
        if (!response.ok || (await response.json())?.status !== 'ok') throw new Error();
        readyAt = Date.now();
        lastError = undefined;
        update('ready');
      } catch {
        // Uma resposta de outra consulta já pode ter confirmado a conexão.
        if (state === 'ready') return;
        failedAt = Date.now();
        lastError = new RequestError(
          controller.signal.aborted ? 'O servidor demorou para responder. Tente conectar novamente.' :
            'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
          controller.signal.aborted ? 'timeout' : 'network',
        );
        update('error');
        throw lastError;
      } finally {
        clearTimeout(slow);
        clearTimeout(deadline);
        pending = undefined;
      }
    })();
    return pending;
  }

  async function wait(signal?: AbortSignal | null) {
    if (signal?.aborted) throw signal.reason || new DOMException('Consulta cancelada', 'AbortError');
    const connection = prepare();
    if (!signal) return connection;
    return new Promise<void>((resolve, reject) => {
      const abort = () => {
        signal.removeEventListener('abort', abort);
        reject(signal.reason || new DOMException('Consulta cancelada', 'AbortError'));
      };
      signal.addEventListener('abort', abort, { once: true });
      connection.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
  }

  return {
    prepare,
    markReady() {
      readyAt = Date.now();
      lastError = undefined;
      update('ready');
    },
    getError: () => lastError,
    wait,
    async waitForRequest(signal?: AbortSignal | null) {
      if (signal?.aborted) throw signal.reason || new DOMException('Consulta cancelada', 'AbortError');
      if (state === 'error' && Date.now() - failedAt < 30_000) return;
      try {
        await wait(signal);
      } catch (error) {
        if (signal?.aborted || !(error instanceof RequestError)) throw error;
      }
    },
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

let configured: ReturnType<typeof createApiConnection> | undefined;
let apiBase = '';

export function configureApiConnection(baseUrl: string) {
  configured = undefined;
  apiBase = '';
  try {
    if (!new URL(baseUrl).hostname.endsWith('.onrender.com')) return;
  } catch { return; }
  apiBase = baseUrl.replace(/\/$/, '');
  configured = createApiConnection(apiBase);
  void configured.prepare().catch(() => undefined);
}

export function waitForApiConnection(url: string, signal?: AbortSignal | null) {
  return configured && url.startsWith(`${apiBase}/`) ? configured.waitForRequest(signal) : undefined;
}

export const subscribeApiConnection = (listener: () => void) => configured?.subscribe(listener) || (() => undefined);
export const getApiConnectionState = () => configured?.getState() || 'idle';
export const getApiConnectionError = () => configured?.getError();
export const retryApiConnection = () => configured?.prepare().catch(() => undefined);
export function reportApiConnection(url: string) {
  if (configured && url.startsWith(`${apiBase}/`)) configured.markReady();
}
