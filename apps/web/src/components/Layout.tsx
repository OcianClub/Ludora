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
  const { usuario, clube } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const role = clube?.meuPapel ? ROLE_LABELS[clube.meuPapel] || clube.meuPapel : 'Visualização pública';
  const gerenciaClube = ['ADMIN', 'TECNICO', 'MESARIO'].includes(clube?.meuPapel || '');
  const extraLinks = NAV.slice(4);
  const moreActive = extraLinks.some(item => location.pathname.startsWith(item.to)) || location.pathname === '/membros';
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const closeOnDesktop = () => { if (!media.matches) setMoreOpen(false); };
    media.addEventListener('change', closeOnDesktop);
    return () => media.removeEventListener('change', closeOnDesktop);
  }, []);
  useEffect(() => {
    setMoreOpen(false);
  }, [location.key, clube?.id]);
  return (
    <div className="layout">
      <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
      
      <aside className="sidebar">
        <Link to="/dashboard" className="sidebar-brand" aria-label="Ludora — visão geral">
          <Brand />
        </Link>
        
        <span className="sidebar-label">MEU CLUBE</span>
        
        <nav className="sidebar-nav" aria-label="Navegação principal">
          {NAV.slice(0, 4).map(item => (
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
          <span className="sidebar-group-label">{gerenciaClube ? 'GESTÃO' : 'CLUBE'}</span>
          {NAV.slice(4).map(item => (
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
          <NavLink to="/perfil" className="sidebar-usuario" aria-label="Meu perfil" title="Meu perfil e preferências">
            <span className="usuario-avatar">{usuario?.nome?.[0] || '?'}</span>
            <span className="usuario-info">
              <strong>{usuario?.nome || 'Meu perfil'}</strong>
              <small>Conta e preferências</small>
            </span>
            <Icon name="chevronRight" size={16} />
          </NavLink>
        </div>
      </aside>

      <div className="workspace">
        <header className="workspace-header">
          <div className="workspace-header-inner">
            <Link to="/selecionar-clube" className="current-club" title={`${clube?.nome || 'Selecione um clube'} · ${role}`} aria-label={`${clube?.nome || 'Selecione um clube'}, ${role}. Trocar clube`}>
              <ClubBadge src={clube?.escudo} name={clube?.nome} size={46} />
              <span className="current-club-copy">
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
              <NavLink to="/perfil" className="profile-link header-profile-link" aria-label="Meu perfil">
                <Icon name="user" size={24} />
              </NavLink>
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
        <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Mais opções" className="mobile-more-sheet">
          <div className="mobile-more-club">
            <ClubBadge src={clube?.escudo} name={clube?.nome} size={44} />
            <span>
              <strong>{clube?.nome || 'Selecione um clube'}</strong>
              <small>{role}</small>
            </span>
          </div>

          <section className="mobile-more-section" aria-labelledby="mobile-more-management">
            <h3 id="mobile-more-management">{gerenciaClube ? 'Gestão do clube' : 'Sobre o clube'}</h3>
            <nav className="mobile-more-links" aria-label="Gestão do clube">
            {extraLinks.map(item => (
              <NavLink key={item.to} to={item.to} className="mobile-more-item" aria-label={item.label} onClick={() => setMoreOpen(false)}>
                <span className="mobile-more-item-icon"><Icon name={item.icon} /></span>
                <span>{item.label}</span>
                <Icon name="chevronRight" size={18} />
              </NavLink>
            ))}
            {clube?.meuPapel === 'ADMIN' && (
              <NavLink to="/membros" className="mobile-more-item" aria-label="Pessoas e acessos" onClick={() => setMoreOpen(false)}>
                <span className="mobile-more-item-icon"><Icon name="user" /></span>
                <span>Pessoas e acessos</span>
                <Icon name="chevronRight" size={18} />
              </NavLink>
            )}
            </nav>
          </section>

        </Modal>
      </div>
    </div>
  );
}
