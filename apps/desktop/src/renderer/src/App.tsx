import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Spinner } from '@web/components/UI';
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext';
import AdminLayout from './components/AdminLayout';
import LoginPage from './pages/Login';
import VisaoPage from './pages/Visao';
import ClubesPage from './pages/Clubes';
import ClubeDetalhePage from './pages/ClubeDetalhe';
import UsuariosPage from './pages/Usuarios';
import BancoPage from './pages/Banco';
import LogsPage from './pages/Logs';
import AjustesPage from './pages/Ajustes';

function Rotas() {
  const { estado } = useAdminAuth();
  if (estado === 'carregando') return <Spinner />;
  if (estado === 'anonimo') return <LoginPage />;
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="/visao" replace />} />
        <Route path="/visao" element={<VisaoPage />} />
        <Route path="/clubes" element={<ClubesPage />} />
        <Route path="/clubes/:id" element={<ClubeDetalhePage />} />
        <Route path="/usuarios" element={<UsuariosPage />} />
        <Route path="/banco" element={<BancoPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/ajustes" element={<AjustesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/visao" replace />} />
    </Routes>
  );
}

// HashRouter: em produção o renderer é carregado via file://, onde rotas por caminho não existem.
export default function App() {
  return (
    <AdminAuthProvider>
      <HashRouter><Rotas /></HashRouter>
    </AdminAuthProvider>
  );
}
