/** Mesma lista explícita de consultas públicas usada pelo Web. Escritas nunca são redirecionadas. */
export function endpointVisitante(endpoint: string, clubeId: string | null, method = 'GET') {
  if (method.toUpperCase() !== 'GET') return endpoint;
  const [path, query] = endpoint.split('?');
  const partida = path.match(/^\/partidas\/(\d+)(?:\/gestao)?$/);
  if (partida) return `/publico/partidas/${partida[1]}${clubeId ? `?clube_id=${encodeURIComponent(clubeId)}` : ''}`;
  if (clubeId && ['/categorias', '/times', '/partidas', '/partidas/home', '/partidas/agenda', '/competicoes'].includes(path)) {
    return `/publico/clubes/${clubeId}${path}${query ? `?${query}` : ''}`;
  }
  return endpoint;
}
