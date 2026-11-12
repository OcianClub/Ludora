import ConfirmarEmail from './pages/ConfirmarEmail';
import { Page, preloadPage, LoginPage, RegistrarPage, SelecionarClubePage, DashboardPage, JogadoresPage, JogadorPerfil, ClubePerfil, TimesPage, SolicitacoesPartidas, PartidasPage, PartidaDetalhePage, CompeticoesPage, PaulistaPage, ElencoPage, PerfilPage, MembrosPage, RecuperarSenhaPage, ConvitePage } from './routePages';
import { Fragment, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import { SupportCenter } from './components/SupportCenter';
import { TooltipLayer } from './components/Tooltip';
import { WorkspaceAccess, ManagementAccess, AccessRequired, PublicClubEntry, PublicMatchEntry } from './components/PublicAccess';
import { clubAccessScope } from './services/authSession';

function Protegida({ children }: { children: React.ReactNode }) {
  const { token, modo, clubeSelecionado } = useAuth();
  return <WorkspaceAccess><Fragment key={`${token}:${modo}:${clubAccessScope(clubeSelecionado)}`}>{children}</Fragment></WorkspaceAccess>;
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
  if (!token) return <AccessRequired />;
  return <Fragment key={token}>{children}</Fragment>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SupportCenter>
        <RouteNavigation />
        <TooltipLayer />
        <Routes>
          <Route path="/login" element={<Page><LoginPage /></Page>} />
          <Route path="/registrar" element={<Page><RegistrarPage /></Page>} />
          <Route path="/confirmar-email" element={<ConfirmarEmail />} />
          <Route path="/recuperar-senha" element={<Page><RecuperarSenhaPage /></Page>} />
          <Route path="/convite" element={<Page><ConvitePage /></Page>} />
          <Route path="/convite/token/:codigo" element={<Page><ConvitePage /></Page>} />
          <Route path="/convite/:codigo" element={<Page><ConvitePage /></Page>} />
          <Route path="/selecionar-clube" element={<Page><SelecionarClubePage /></Page>} />
          <Route path="/clubes/:clubeId" element={<PublicClubEntry />}>
            <Route index element={<Page><DashboardPage /></Page>} />
            <Route path="partidas" element={<Page><PartidasPage /></Page>} />
            <Route path="competicoes" element={<Page><CompeticoesPage /></Page>} />
          </Route>
          <Route element={<Protegida><Layout /></Protegida>}>
            <Route index element={<Navigate to="/selecionar-clube" replace />} />
            <Route path="/dashboard" element={<Page><DashboardPage /></Page>} />
            <Route path="/jogadores" element={<ManagementAccess><Page><JogadoresPage /></Page></ManagementAccess>} />
            <Route path="/jogadores/:id" element={<ManagementAccess><Page><JogadorPerfil /></Page></ManagementAccess>} />
            <Route path="/jogadores/:id/partidas" element={<ManagementAccess><Page><JogadorPerfil history="partidas" /></Page></ManagementAccess>} />
            <Route path="/jogadores/:id/campeonatos" element={<ManagementAccess><Page><JogadorPerfil history="campeonatos" /></Page></ManagementAccess>} />
            <Route path="/clube" element={<ManagementAccess><Page><ClubePerfil /></Page></ManagementAccess>} />
            <Route path="/elenco" element={<ManagementAccess><Page><ElencoPage /></Page></ManagementAccess>} />
            <Route path="/times" element={<ManagementAccess><Page><TimesPage /></Page></ManagementAccess>} />
            <Route path="/partidas" element={<Page><PartidasPage /></Page>} />
            <Route path="/partidas/solicitacoes" element={<ManagementAccess><Page><SolicitacoesPartidas /></Page></ManagementAccess>} />
            <Route path="/partidas/:id" element={<PublicMatchEntry><Page><PartidaDetalhePage /></Page></PublicMatchEntry>} />
            <Route path="/competicoes" element={<Page><CompeticoesPage /></Page>} />
            <Route path="/competicoes/paulista" element={<Page><PaulistaPage /></Page>} />
            <Route path="/perfil" element={<SoToken><Page><PerfilPage /></Page></SoToken>} />
            <Route path="/membros" element={<ManagementAccess><Page><MembrosPage /></Page></ManagementAccess>} />
          </Route>
          <Route path="*" element={<Navigate to="/selecionar-clube" replace />} />
        </Routes>
        </SupportCenter>
      </BrowserRouter>
    </AuthProvider>
  );
}
