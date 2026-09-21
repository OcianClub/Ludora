import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Layout.css';

const NAV = [
  { to: '/dashboard', label: 'Visão Geral', icon: '◈' },
  { to: '/partidas', label: 'Partidas', icon: '⚽' },
  { to: '/elenco', label: 'Elenco', icon: '👥' },
  { to: '/jogadores', label: 'Jogadores', icon: '🏃' },
  { to: '/times', label: 'Times', icon: '🛡' },
  { to: '/competicoes', label: 'Competições', icon: '🏆' },
];

export default function Layout() {
  const { usuario, clube, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-logo">LUDORA</span>
          <span className="sidebar-clube" onClick={() => navigate('/selecionar-clube')} title="Trocar clube">
            {clube?.nome || '—'}
          </span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-usuario">
            <div className="usuario-avatar">{usuario?.nome?.[0] || '?'}</div>
            <div className="usuario-info">
              <span className="usuario-nome">{usuario?.nome}</span>
              <span className="usuario-papel">{clube?.meuPapel || 'TORCEDOR'}</span>
            </div>
          </div>
          <button className="btn-logout" onClick={logout}>Sair</button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
