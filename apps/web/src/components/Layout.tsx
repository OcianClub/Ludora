import { ThemeToggle } from './ThemeToggle';
import { useEffect, useState } from 'react';
import { Notifications } from './Notifications';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Brand, ClubBadge } from './Brand';
import { Icon, IconName } from './Icon';
import { Modal } from './UI';
import './Layout.css';

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/dashboard', label: 'Visão geral', icon: 'home' },
  { to: '/partidas', label: 'Partidas', icon: 'ball' },
  { to: '/elenco', label: 'Elenco', icon: 'team' },
  { to: '/jogadores', label: 'Jogadores', icon: 'player' },
  { to: '/times', label: 'Times', icon: 'shield' },
  { to: '/competicoes', label: 'Competições', icon: 'trophy' },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador', TECNICO: 'Técnico', MESARIO: 'Mesário', TORCEDOR: 'Torcedor', OLHEIRO: 'Olheiro',
};

export default function Layout() {
  const { usuario, clube, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const role = clube?.meuPapel ? ROLE_LABELS[clube.meuPapel] || clube.meuPapel : 'Visualização pública';
  const extraLinks = NAV.slice(4);
  const moreActive = extraLinks.some(item => location.pathname.startsWith(item.to)) || location.pathname === '/membros';
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const closeOnDesktop = () => { if (!media.matches) setMoreOpen(false); };
    media.addEventListener('change', closeOnDesktop);
    return () => media.removeEventListener('change', closeOnDesktop);
  }, []);
  return (
    <div className="layout">
      <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
      
      <aside className="sidebar">
        <Link to="/dashboard" className="sidebar-brand" aria-label="Ludora — visão geral">
          <Brand />
        </Link>
        
        <span className="sidebar-label">MEU CLUBE</span>
        
        <nav className="sidebar-nav" aria-label="Navegação principal">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={item.label}
              title={item.label}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon"><Icon name={item.icon} /></span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
          {clube?.meuPapel === 'ADMIN' && <NavLink to="/membros" aria-label="Pessoas e acessos" title="Pessoas e acessos" className={({isActive})=>`nav-item${isActive?' active':''}`}><span className="nav-icon"><Icon name="user"/></span><span className="nav-label">Pessoas e acessos</span></NavLink>}
        </nav>

        <div className="sidebar-footer">
          <ThemeToggle />

          <Link to="/perfil" className="sidebar-usuario" aria-label="Meu perfil" title="Meu perfil">
            <span className="usuario-avatar">{usuario?.nome?.[0] || '?'}</span>
            <span className="usuario-info">
              <strong>{usuario?.nome || 'Meu perfil'}</strong>
              <small>Minha conta</small>
            </span>
            <Icon name="chevronRight" size={16} />
          </Link>

          <button className="btn-logout" onClick={logout} aria-label="Sair da conta" title="Sair da conta">
            <Icon name="logout" size={18} /><span>Sair da conta</span>
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="workspace-header">
          <div className="workspace-header-inner">
            <Link to="/selecionar-clube" className="current-club" title={`${clube?.nome || 'Selecione um clube'} · ${role}`} aria-label={`${clube?.nome || 'Selecione um clube'}, ${role}. Trocar clube`}>
              <ClubBadge src={clube?.escudo} name={clube?.nome} size={46} />
              <span>
                <strong>{clube?.nome || 'Selecione um clube'}</strong>
                <small className="current-club-role">{role}</small>
              </span>
            </Link>

            <div className="workspace-actions">
              <Link to="/selecionar-clube" className="btn btn-ghost btn-sm switch-club-link" aria-label="Trocar clube">
                <Icon name="switchClub" size={18} />
                <span>Trocar clube</span>
              </Link>
              <Notifications />
              <Link to="/perfil" className="profile-link header-profile-link" aria-label="Meu perfil">
                <Icon name="user" />
              </Link>
            </div>
          </div>
        </header>

        <main className="content" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <div className="mobile-navigation">
        <nav className="bottom-nav" aria-label="Navegação principal no celular">
          {NAV.slice(0, 4).map(item => (
            <NavLink key={item.to} to={item.to} aria-label={item.label}
              className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon"><Icon name={item.icon} size={23} /></span>
              <span>{item.to === '/dashboard' ? 'Início' : item.label}</span>
            </NavLink>
          ))}
          <button type="button" className={`bottom-nav-item${moreActive ? ' active' : ''}`}
            aria-label="Mais opções de navegação" aria-haspopup="dialog" aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}>
            <span className="nav-icon"><Icon name="grid" size={23} /></span><span>Mais</span>
          </button>
        </nav>
        <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Mais opções">
          <nav className="mobile-more-links" aria-label="Outras páginas">
            {extraLinks.map(item => (
              <NavLink key={item.to} to={item.to} className="nav-item" onClick={() => setMoreOpen(false)}>
                <Icon name={item.icon} /><span>{item.label}</span>
              </NavLink>
            ))}
            {clube?.meuPapel === 'ADMIN' && (
              <NavLink to="/membros" className="nav-item" onClick={() => setMoreOpen(false)}>
                <Icon name="user" /><span>Pessoas e acessos</span>
              </NavLink>
            )}
          </nav>
          <div className="mobile-more-theme"><span>Aparência</span><ThemeToggle /></div>
          <Link to="/selecionar-clube" className="nav-item" onClick={() => setMoreOpen(false)}><Icon name="switchClub" /><span>Trocar clube</span></Link>
          <button className="btn-logout" onClick={logout}><Icon name="logout" size={20} /><span>Sair da conta</span></button>
        </Modal>
      </div>
    </div>
  );
}
