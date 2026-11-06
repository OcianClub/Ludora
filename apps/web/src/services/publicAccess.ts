const MODE = 'ludora_navigation_mode';
const INTENT = 'ludora_access_intent';
export type NavigationMode = 'publico' | 'gestao';
export function navigationMode(): NavigationMode {
  try {
    const club = JSON.parse(localStorage.getItem('ludora_clube') || 'null');
    return localStorage.getItem('ludora_token') && ['ADMIN', 'TECNICO', 'MESARIO'].includes(club?.meuPapel) && localStorage.getItem(MODE) !== 'publico' ? 'gestao' : 'publico';
  }
  catch { return 'publico'; }
}
export function saveNavigationMode(mode: NavigationMode) { localStorage.setItem(MODE, mode); }
function internalPath(path: string) {
  try {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return '/selecionar-clube';
    const url = new URL(path, location.origin);
    return url.origin === location.origin ? url.pathname + url.search + url.hash : '/selecionar-clube';
  } catch { return '/selecionar-clube'; }
}
export function rememberAccess(returnTo = location.pathname + location.search, followClub?: number) {
  sessionStorage.setItem(INTENT, JSON.stringify({ returnTo: internalPath(returnTo), followClub, createdAt: Date.now() }));
}
export function consumeAccess(): { returnTo: string; followClub?: number } | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(INTENT) || 'null');
    sessionStorage.removeItem(INTENT);
    return raw && typeof raw.returnTo === 'string' && Number.isFinite(raw.createdAt) && Date.now() - raw.createdAt >= 0 && Date.now() - raw.createdAt < 15 * 60_000 ? { returnTo: internalPath(raw.returnTo), followClub: Number.isSafeInteger(raw.followClub) && raw.followClub > 0 ? raw.followClub : undefined } : null;
  } catch { return null; }
}
// Apenas consultas explicitamente públicas usam esta API. Escritas continuam autenticadas.
export function publicEndpoint(endpoint: string, clubId: number | null) {
  if (navigationMode() !== 'publico') return endpoint;
  const [path, query] = endpoint.split('?');
  const match = path.match(/^\/partidas\/(\d+)\/gestao$/);
  if (match) return `/publico/partidas/${match[1]}${clubId ? `?clube_id=${clubId}` : ''}`;
  if (!clubId) return endpoint;
  const prefix = `/publico/clubes/${clubId}`;
  if (['/categorias', '/times', '/partidas', '/partidas/home', '/competicoes'].includes(path)) return prefix + path + (query ? `?${query}` : '');
  if (/^\/competicoes\/\d+\/classificacao$/.test(path)) return prefix + path;
  return endpoint;
}
