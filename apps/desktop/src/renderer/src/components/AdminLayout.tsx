import { Outlet, NavLink, Link } from 'react-router-dom';
import { Brand } from '@web/components/Brand';
import { ThemeToggle } from '@web/components/ThemeToggle';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { AdminIcon, type AdminIconName } from './AdminIcon';
import { ROTULO_ESTADO, useEstadoTempoReal } from './useTempoReal';

const NAV: { to: string; label: string; icon: AdminIconName }[] = [
  { to: '/visao', label: 'Visão global', icon: 'home' },
  { to: '/clubes', label: 'Clubes', icon: 'shield' },
  { to: '/usuarios', label: 'Usuários', icon: 'user' },
  { to: '/banco', label: 'Banco e integrações', icon: 'radar' },
  { to: '/logs', label: 'Logs ao vivo', icon: 'clipboard' },
  { to: '/ajustes', label: 'Ajustes', icon: 'info' },
];

export default function AdminLayout() {
  const { usuario, sair } = useAdminAuth();
  const estado = useEstadoTempoReal();

  return (
    <div className="layout">
      <aside className="sidebar">
        <Link to="/visao" className="sidebar-brand" aria-label="Ludora Admin — visão global"><Brand /></Link>
        <span className="sidebar-label">PLATAFORMA · SUPER ADMIN</span>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <AdminIcon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <ThemeToggle />
          <div className="sidebar-usuario" style={{ cursor: 'default' }}>
            <span className="usuario-avatar">{usuario?.nome?.[0] || '?'}</span>
            <span className="usuario-info">
              <strong>{usuario?.nome}</strong>
              <small>{usuario?.email}</small>
            </span>
          </div>
          <button className="btn-logout" onClick={() => void sair()}>
            <AdminIcon name="logout" size={18} /> Sair da conta
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="workspace-header">
          <span className="admin-badge"><AdminIcon name="star" size={16} /> Acesso Super Admin</span>
          <div className="workspace-actions">
            <span className={`rt-pill rt-${estado}`} title="Conexão em tempo real com a API">
              <span className="rt-dot" />{ROTULO_ESTADO[estado]}
            </span>
          </div>
        </header>
        <main className="content" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
