import { Outlet, NavLink, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Brand, ClubBadge } from './Brand';
import { Icon, IconName } from './Icon';
import { PapelBadge } from './UI';
import './Layout.css';

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/dashboard', label: 'Visão geral', icon: 'home' },
  { to: '/partidas', label: 'Partidas', icon: 'ball' },
  { to: '/elenco', label: 'Elenco', icon: 'team' },
  { to: '/jogadores', label: 'Jogadores', icon: 'player' },
  { to: '/times', label: 'Times', icon: 'shield' },
  { to: '/competicoes', label: 'Competições', icon: 'trophy' },
];

export default function Layout() {
  const { usuario, clube, logout } = useAuth();
  return (
    <div className="layout">
      <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
      <aside className="sidebar">
        <Link to="/dashboard" className="sidebar-brand" aria-label="Ludora — visão geral"><Brand /></Link>
        <span className="sidebar-label">MEU CLUBE</span>
        <nav className="sidebar-nav" aria-label="Navegação principal">
          {NAV.map(item => <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Icon name={item.icon} /><span>{item.label}</span>
          </NavLink>)}
        </nav>
        <div className="sidebar-footer">
          <Link to="/perfil" className="sidebar-usuario">
            <span className="usuario-avatar">{usuario?.nome?.[0] || '?'}</span>
            <span className="usuario-info"><strong>{usuario?.nome || 'Meu perfil'}</strong><small>Minha conta</small></span>
            <Icon name="arrow" size={16} />
          </Link>
          <button className="btn-logout" onClick={logout}><Icon name="logout" size={18} /> Sair da conta</button>
        </div>
      </aside>
      <div className="workspace">
        <header className="workspace-header">
          <Link to="/selecionar-clube" className="current-club" title="Trocar clube">
            <ClubBadge src={clube?.escudo} size={38} />
            <span><strong>{clube?.nome || 'Selecione um clube'}</strong>{clube?.meuPapel && <PapelBadge papel={clube.meuPapel} />}</span>
          </Link>
          <div className="workspace-actions">
            <Link to="/selecionar-clube" className="btn btn-ghost btn-sm" aria-label="Trocar clube"><Icon name="switchClub" size={18} /><span>Trocar clube</span></Link>
            <Link to="/perfil" className="profile-link" aria-label="Meu perfil"><Icon name="user" /></Link>
            <button className="profile-link mobile-logout" onClick={logout} aria-label="Sair da conta"><Icon name="logout" size={18} /></button>
          </div>
        </header>
        <main className="content" id="main-content" tabIndex={-1}><Outlet /></main>
      </div>
    </div>
  );
}
