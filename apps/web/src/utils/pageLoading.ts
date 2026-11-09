export type LoadingPage = 'home' | 'players' | 'player' | 'scout' | 'teams' | 'schedule' | 'match' | 'requests' | 'members' | 'profile' | 'club' | 'competition';

export function loadingPage(path: string): LoadingPage {
  if (/^\/clubes\/\d+\/competicoes$/.test(path) || path.startsWith('/competicoes')) return 'competition';
  if (/^\/clubes\/\d+\/partidas$/.test(path) || path === '/partidas') return 'schedule';
  if (path === '/partidas/solicitacoes') return 'requests';
  if (path.startsWith('/partidas/')) return 'match';
  if (path.startsWith('/jogadores/')) return 'player';
  if (path === '/jogadores') return 'players';
  if (path === '/elenco') return 'scout';
  if (path === '/times') return 'teams';
  if (path === '/membros') return 'members';
  if (path === '/perfil') return 'profile';
  if (path === '/clube') return 'club';
  return 'home';
}
