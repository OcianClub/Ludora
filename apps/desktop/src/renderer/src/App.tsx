import ManutencaoPage from './pages/Manutencao';
import { TooltipLayer } from '@web/components/Tooltip';
import { createHashRouter, Navigate, Route, RouterProvider, Routes } from 'react-router-dom';
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
import PaulistaAdmin from './pages/Paulista';
import EquipePage from './pages/Equipe';
import ChamadosPage from './pages/Chamados';

function Rotas() {
  const { estado, usuario } = useAdminAuth();
  if (estado === 'carregando') return <Spinner />;
  if (estado === 'anonimo') return <LoginPage />;
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/equipe" element={<EquipePage />} />
        <Route path="/chamados" element={<ChamadosPage />} />
        {usuario?.papel_plataforma !== 'DESENVOLVEDOR' && <Route path="/manutencao" element={<ManutencaoPage />} />}
        <Route path="/ajustes" element={<AjustesPage />} />
        {usuario?.papel_plataforma === 'SUPERADMIN' && <>
        <Route index element={<Navigate to="/visao" replace />} />
        <Route path="/visao" element={<VisaoPage />} />
        <Route path="/clubes" element={<ClubesPage />} />
        <Route path="/clubes/:id" element={<ClubeDetalhePage />} />
        <Route path="/usuarios" element={<UsuariosPage />} />
        <Route path="/banco" element={<BancoPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/paulista" element={<PaulistaAdmin />} />
        </>}
      </Route>
      <Route path="*" element={<Navigate to={usuario?.papel_plataforma === 'SUPERADMIN' ? '/visao' : '/equipe'} replace />} />
    </Routes>
  );
}

// HashRouter: em produção o renderer é carregado via file://, onde rotas por caminho não existem.
const router = createHashRouter([{ path: '*', element: <AdminAuthProvider><TooltipLayer/><Rotas/></AdminAuthProvider> }]);
export default function App() { return <RouterProvider router={router}/>; }
