import { Page, preloadPage, LoginPage, RegistrarPage, SelecionarClubePage, DashboardPage, JogadoresPage, JogadorPerfil, ClubePerfil, TimesPage, SolicitacoesPartidas, PartidasPage, PartidaDetalhePage, CompeticoesPage, ElencoPage, PerfilPage, MembrosPage, RecuperarSenhaPage, ConvitePage } from './routePages';
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import { TooltipLayer } from './components/Tooltip';

function Protegida({ children }: { children: React.ReactNode }) {
  const { token, clube } = useAuth();
  const { pathname } = useLocation();
  if (!token) return <Navigate to="/login" replace />;
  if (!clube && pathname !== '/perfil') return <Navigate to="/selecionar-clube" replace />;
  return <>{children}</>;
}

function RouteNavigation() {
  const { pathname } = useLocation();
  useEffect(() => {
    const preload = (event: Event) => {
      const link = (event.target as Element)?.closest<HTMLAnchorElement>('a[href]');
      if (link?.origin === window.location.origin) preloadPage(link.pathname);
    };
    document.addEventListener('pointerover', preload);
    document.addEventListener('focusin', preload);
    return () => {
      document.removeEventListener('pointerover', preload);
      document.removeEventListener('focusin', preload);
    };
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      const content = document.querySelector<HTMLElement>('#main-content');
      content?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
  return null;
}

function SoToken({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RouteNavigation />
        <TooltipLayer />
        <Routes>
          <Route path="/login" element={<Page><LoginPage /></Page>} />
          <Route path="/registrar" element={<Page><RegistrarPage /></Page>} />
          <Route path="/recuperar-senha" element={<Page><RecuperarSenhaPage /></Page>} />
          <Route path="/convite" element={<Page><ConvitePage /></Page>} />
          <Route path="/convite/token/:codigo" element={<Page><ConvitePage /></Page>} />
          <Route path="/convite/:codigo" element={<Page><ConvitePage /></Page>} />
          <Route path="/selecionar-clube" element={<SoToken><Page><SelecionarClubePage /></Page></SoToken>} />
          <Route element={<Protegida><Layout /></Protegida>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Page><DashboardPage /></Page>} />
            <Route path="/jogadores" element={<Page><JogadoresPage /></Page>} />
            <Route path="/jogadores/:id" element={<Page><JogadorPerfil /></Page>} />
            <Route path="/jogadores/:id/partidas" element={<Page><JogadorPerfil history="partidas" /></Page>} />
            <Route path="/jogadores/:id/campeonatos" element={<Page><JogadorPerfil history="campeonatos" /></Page>} />
            <Route path="/clube" element={<Page><ClubePerfil /></Page>} />
            <Route path="/elenco" element={<Page><ElencoPage /></Page>} />
            <Route path="/times" element={<Page><TimesPage /></Page>} />
            <Route path="/partidas" element={<Page><PartidasPage /></Page>} />
            <Route path="/partidas/solicitacoes" element={<Page><SolicitacoesPartidas /></Page>} />
            <Route path="/partidas/:id" element={<Page><PartidaDetalhePage /></Page>} />
            <Route path="/competicoes" element={<Page><CompeticoesPage /></Page>} />
            <Route path="/perfil" element={<Page><PerfilPage /></Page>} />
            <Route path="/membros" element={<Page><MembrosPage /></Page>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
