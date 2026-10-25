// Regras puras do processo principal. Ficam em shared/ para poderem ser
// testadas com node:test sem subir o Electron.

export const METODOS_HTTP = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type MetodoHttp = (typeof METODOS_HTTP)[number];

const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Aceita só https:// (ou http:// para máquina local). Devolve apenas a origem,
 * descartando caminho/query. O token de sessão só é enviado para este endereço.
 */
export function validarApiUrl(valor: string): string {
  let url: URL;
  try {
    url = new URL(String(valor).trim());
  } catch {
    throw new Error('URL inválida');
  }
  if (url.username || url.password) throw new Error('A URL não pode conter usuário ou senha');
  const local = HOSTS_LOCAIS.has(url.hostname);
  if (url.protocol === 'https:' || (url.protocol === 'http:' && local)) return url.origin;
  throw new Error('Use https:// (http só é aceito para localhost)');
}

/**
 * O renderer não é um proxy HTTP genérico: só pode pedir login e rotas /admin.
 * Sem pontos no caminho, o que bloqueia "../" e variações codificadas.
 */
export function caminhoApiPermitido(caminho: unknown): caminho is string {
  if (typeof caminho !== 'string' || caminho.length > 300) return false;
  const [pathname, query, resto] = caminho.split('?');
  if (resto !== undefined) return false;
  const rotaOk = pathname === '/auth/login' || /^\/admin(\/[A-Za-z0-9_-]+)+$/.test(pathname);
  const queryOk = query === undefined || /^[A-Za-z0-9_=&%@.+-]*$/.test(query);
  return rotaOk && queryOk;
}

export function metodoPermitido(metodo: unknown): metodo is MetodoHttp {
  return METODOS_HTTP.includes(metodo as MetodoHttp);
}

export function emailValido(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(valor);
}
