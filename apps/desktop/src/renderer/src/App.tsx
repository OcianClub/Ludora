import { lazy, Suspense } from 'react';
import { TooltipLayer } from '@web/components/Tooltip';
import { createHashRouter, Navigate, Route, RouterProvider, Routes } from 'react-router-dom';
import { Spinner } from './components/AdminUI';
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext';
import AdminLayout from './components/AdminLayout';
const LoginPage = lazy(() => import('./pages/Login'));
const VisaoPage = lazy(() => import('./pages/Visao'));
const ClubesPage = lazy(() => import('./pages/Clubes'));
const ClubeDetalhePage = lazy(() => import('./pages/ClubeDetalhe'));
const UsuariosPage = lazy(() => import('./pages/Usuarios'));
const BancoPage = lazy(() => import('./pages/Banco'));
const LogsPage = lazy(() => import('./pages/Logs'));
const AjustesPage = lazy(() => import('./pages/Ajustes'));
const PaulistaAdmin = lazy(() => import('./pages/Paulista'));
const ChamadosPage = lazy(() => import('./pages/Chamados'));
const ManutencaoPage = lazy(() => import('./pages/Manutencao'));

function Rotas() {
  const { estado, usuario } = useAdminAuth();
  if (estado === 'carregando') return <Spinner />;
  if (estado === 'anonimo') return <Suspense fallback={<Spinner label="Abrindo acesso…"/>}><LoginPage /></Suspense>;
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="/visao" replace />} />
        <Route path="/visao" element={<VisaoPage />} />
        <Route path="/equipe" element={<Navigate to="/visao" replace />} />
        <Route path="/chamados" element={<ChamadosPage />} />
        {usuario?.papel_plataforma !== 'DESENVOLVEDOR' && <Route path="/manutencao" element={<ManutencaoPage />} />}
        <Route path="/ajustes" element={<AjustesPage />} />
        {usuario?.papel_plataforma === 'SUPERADMIN' && <>
        <Route path="/clubes" element={<ClubesPage />} />
        <Route path="/clubes/:id" element={<ClubeDetalhePage />} />
        <Route path="/usuarios" element={<UsuariosPage />} />
        <Route path="/banco" element={<BancoPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/paulista" element={<PaulistaAdmin />} />
        </>}
      </Route>
      <Route path="*" element={<Navigate to="/visao" replace />} />
    </Routes>
  );
}

// HashRouter: em produção o renderer é carregado via file://, onde rotas por caminho não existem.
const router = createHashRouter([{ path: '*', element: <AdminAuthProvider><TooltipLayer/><Rotas/></AdminAuthProvider> }]);
export default function App() { return <RouterProvider router={router}/>; }
