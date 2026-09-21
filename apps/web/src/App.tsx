import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

function Protegida({ children }: { children: React.ReactNode }) {
  const { token, clube } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (!clube) return <Navigate to="/selecionar-clube" replace />;
  return <>{children}</>;
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
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registrar" element={<RegistrarPage />} />
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
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
