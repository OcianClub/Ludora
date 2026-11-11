type Snapshot = {
  body: string;
  status: number;
  statusText: string;
  headers: [string, string][];
  json: unknown;
};

type Entry = {
  value?: Snapshot;
  expires: number;
  pending?: Promise<Snapshot>;
  controller?: AbortController;
  consumers: number;
};
const entries = new Map<string, Entry>();
const MAX_ENTRIES = 64;
const MAX_BODY_SIZE = 4_000_000;

export function readLifetime(endpoint: string) {
  const path = endpoint.split('?')[0];
  if (/^\/publico\/clubes\/\d+\/paulista$/.test(path)) return 30_000;
  if (path === '/categorias') return 60_000;
  if (['/times', '/competicoes'].includes(path)) return 30_000;
  if (['/jogadores', '/jogadores/perfis', '/clubes'].includes(path)) return 15_000;
  if (/^\/jogadores\/\d+\/scout-contexto$/.test(path)) return 15_000;
  if (['/partidas', '/partidas/home', '/times/contexto'].includes(path)) return 5_000;
  return 0;
}

export function invalidateReadCache(prefix = '') {
  for (const key of entries.keys()) if (key.startsWith(prefix)) entries.delete(key);
}

export function peekRead<T>(key: string, allowStale = false): T | undefined {
  const entry = entries.get(key);
  return entry && (allowStale || entry.expires > Date.now()) ? entry.value?.json as T | undefined : undefined;
}

function trimCache() {
  let size = [...entries.values()].reduce((total, entry) => total + (entry.value?.body.length || 0), 0);
  for (const [key, entry] of entries) {
    if (entries.size <= MAX_ENTRIES && size <= MAX_BODY_SIZE) break;
    if (entry.pending) continue;
    size -= entry.value?.body.length || 0;
    entries.delete(key);
  }
}

function response(snapshot: Snapshot) {
  return new Response([204, 205, 304].includes(snapshot.status) ? null : snapshot.body, { status: snapshot.status, statusText: snapshot.statusText, headers: snapshot.headers });
}

export function cachedRead(key: string, load: (signal: AbortSignal) => Promise<Response>, lifetime: number, signal?: AbortSignal | null): Promise<Response> {
  if (signal?.aborted) return Promise.reject(new DOMException('Consulta cancelada', 'AbortError'));
  let entry = entries.get(key);
  if (entry?.value && entry.expires > Date.now()) {
    entries.delete(key);
    entries.set(key, entry);
    return Promise.resolve(response(entry.value));
  }
  if (!entry?.pending || entry.controller?.signal.aborted) {
    entry = { value: entry?.value, expires: entry?.expires || 0, consumers: 0 };
    const current = entry;
    const controller = new AbortController();
    current.controller = controller;
    entries.set(key, current);
    const timeout = setTimeout(() => controller.abort(new DOMException('A consulta demorou para responder', 'TimeoutError')), 20_000);
    current.pending = (async () => {
      const result = await load(controller.signal);
      const body = await result.text();
      let json: unknown;
      let validJson = false;
      try { json = JSON.parse(body); validJson = true; } catch { /* A chamada original trata respostas que não são JSON. */ }
      if ([401, 403].includes(result.status) || result.headers.get('cache-control')?.includes('no-store')) current.value = undefined;
      const snapshot: Snapshot = { body, json, status: result.status, statusText: result.statusText, headers: [...result.headers.entries()] };
      if (entries.get(key) === current && result.ok && validJson && lifetime > 0 && body.length <= MAX_BODY_SIZE && !result.headers.get('cache-control')?.includes('no-store')) {
        current.value = snapshot;
        current.expires = Date.now() + lifetime;
      }
      return snapshot;
    })().finally(() => {
      clearTimeout(timeout);
      current.pending = undefined;
      if (entries.get(key) === current && !current.value) entries.delete(key);
      trimCache();
    });
  }
  const current = entry;
  current.consumers++;
  return new Promise<Response>((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return false;
      settled = true;
      current.consumers--;
      signal?.removeEventListener('abort', abort);
      return true;
    };
    const abort = () => {
      if (!finish()) return;
      reject(new DOMException('Consulta cancelada', 'AbortError'));
      queueMicrotask(() => {
        if (!current.consumers && current.pending) {
          current.controller?.abort();
          if (entries.get(key) === current) entries.delete(key);
        }
      });
    };
    signal?.addEventListener('abort', abort, { once: true });
    current.pending!.then(value => { if (finish()) resolve(response(value)); }, error => { if (finish()) reject(error); });
  });
}
