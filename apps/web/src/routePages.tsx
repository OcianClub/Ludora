import { Component, Suspense, lazy, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { StandaloneLoading } from './components/StandaloneLoading';

const loaders = {
  '/login': () => import('./pages/Login'),
  '/registrar': () => import('./pages/Registrar'),
  '/recuperar-senha': () => import('./pages/RecuperarSenha'),
  '/convite': () => import('./pages/Convite'),
  '/selecionar-clube': () => import('./pages/SelecionarClube'),
  '/dashboard': () => import('./pages/Dashboard'),
  '/jogadores/:id': () => import('./pages/JogadorPerfil'),
  '/jogadores': () => import('./pages/Jogadores'),
  '/clube': () => import('./pages/ClubePerfil'),
  '/times': () => import('./pages/Times'),
  '/partidas/solicitacoes': () => import('./pages/SolicitacoesPartidas'),
  '/partidas/:id': () => import('./pages/PartidaDetalhe'),
  '/partidas': () => import('./pages/Partidas'),
  '/competicoes': () => import('./pages/Competicoes'),
  '/elenco': () => import('./pages/Elenco'),
  '/perfil': () => import('./pages/Perfil'),
  '/membros': () => import('./pages/Membros'),
};

export const LoginPage = lazy(loaders['/login']);
export const RegistrarPage = lazy(loaders['/registrar']);
export const RecuperarSenhaPage = lazy(loaders['/recuperar-senha']);
export const ConvitePage = lazy(loaders['/convite']);
export const SelecionarClubePage = lazy(loaders['/selecionar-clube']);
export const DashboardPage = lazy(loaders['/dashboard']);
export const JogadoresPage = lazy(loaders['/jogadores']);
export const JogadorPerfil = lazy(loaders['/jogadores/:id']);
export const ClubePerfil = lazy(loaders['/clube']);
export const TimesPage = lazy(loaders['/times']);
export const SolicitacoesPartidas = lazy(loaders['/partidas/solicitacoes']);
export const PartidaDetalhePage = lazy(loaders['/partidas/:id']);
export const PartidasPage = lazy(loaders['/partidas']);
export const CompeticoesPage = lazy(loaders['/competicoes']);
export const ElencoPage = lazy(loaders['/elenco']);
export const PerfilPage = lazy(loaders['/perfil']);
export const MembrosPage = lazy(loaders['/membros']);

const prefetched = new Set<string>();
export function preloadPage(path: string) {
  const key = path.startsWith('/jogadores/') ? '/jogadores/:id'
    : path.startsWith('/partidas/') && path !== '/partidas/solicitacoes' ? '/partidas/:id'
    : path.startsWith('/convite/') ? '/convite' : path;
  if (!(key in loaders) || prefetched.has(key)) return;
  prefetched.add(key);
  void loaders[key as keyof typeof loaders]().catch(() => prefetched.delete(key));
}

class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return (
        <div className="route-load-error" role="alert">
          <p>Não foi possível abrir esta tela. Verifique a conexão e recarregue a página.</p>
          <button type="button" className="btn btn-ghost" onClick={() => window.location.reload()}>
            Recarregar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function Page({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const standalone = ['/login', '/registrar', '/recuperar-senha', '/selecionar-clube'].includes(pathname) || pathname.startsWith('/convite');
  return (
    <PageBoundary key={pathname}>
      <Suspense fallback={standalone ? <StandaloneLoading pathname={pathname} /> :
        <div className="route-loading">
          <LoadingSkeleton label="Abrindo tela" count={3} />
        </div>
      }>
        {children}
      </Suspense>
    </PageBoundary>
  );
}
