import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/Login';
import RegistrarPage from './pages/Registrar';
import SelecionarClubePage from './pages/SelecionarClube';
import DashboardPage from './pages/Dashboard';
import JogadoresPage from './pages/Jogadores';
import TimesPage from './pages/Times';
import PartidasPage from './pages/Partidas';
import PartidaDetalhePage from './pages/PartidaDetalhe';
import CompeticoesPage from './pages/Competicoes';
import ElencoPage from './pages/Elenco';
import PerfilPage from './pages/Perfil';
import MembrosPage from './pages/Membros';
import RecuperarSenhaPage from './pages/RecuperarSenha';
import ConvitePage from './pages/Convite';

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
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registrar" element={<RegistrarPage />} />
          <Route path="/recuperar-senha" element={<RecuperarSenhaPage />} />
          <Route path="/convite" element={<ConvitePage />} />
          <Route path="/convite/token/:codigo" element={<ConvitePage />} />
          <Route path="/convite/:codigo" element={<ConvitePage />} />
          <Route path="/selecionar-clube" element={<SoToken><SelecionarClubePage /></SoToken>} />
          <Route element={<Protegida><Layout /></Protegida>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/jogadores" element={<JogadoresPage />} />
            <Route path="/elenco" element={<ElencoPage />} />
            <Route path="/times" element={<TimesPage />} />
            <Route path="/partidas" element={<PartidasPage />} />
            <Route path="/partidas/:id" element={<PartidaDetalhePage />} />
            <Route path="/competicoes" element={<CompeticoesPage />} />
            <Route path="/perfil" element={<PerfilPage />} />
            <Route path="/membros" element={<MembrosPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
