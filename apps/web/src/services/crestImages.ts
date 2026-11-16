const failed = new Set<string>();
export function crestSource(src: string | null | undefined, baseUrl: string): string | undefined {
  if (!src || failed.has(src)) return undefined;
  try {
    const url = new URL(src);
    const file = url.pathname.match(/^\/assets\/images\/foto\/escudo\/(\d{1,12}\.(?:png|jpe?g|webp))$/i)?.[1];
    if (url.hostname === 'admfutsal.com.br' && file) return `${baseUrl.replace(/\/$/, '')}/publico/escudos/paulista/${file}`;
  } catch { /* Local assets retain their original URL. */ }
  return src;
}
export function markCrestFailed(src: string) { if (failed.size >= 1000) failed.clear(); failed.add(src); }
