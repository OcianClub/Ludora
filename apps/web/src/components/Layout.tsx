import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Notifications } from './Notifications';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Brand, ClubBadge } from './Brand';
import { Icon, IconName } from './Icon';
import { Modal } from './UI';
import { AccountMenu } from './AccountMenu';
import './Layout.css';
import './ClubWorkspace.css';
import { ClubPendingProvider, useClubPending } from '../contexts/ClubPendingContext';

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/dashboard', label: 'Visão geral', icon: 'home' },
  { to: '/partidas', label: 'Partidas', icon: 'ball' },
  { to: '/elenco', label: 'Scout', icon: 'radar' },
  { to: '/jogadores', label: 'Jogadores', icon: 'player' },
  { to: '/times', label: 'Times', icon: 'shield' },
  { to: '/competicoes', label: 'Competições', icon: 'trophy' },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador', TECNICO: 'Técnico', MESARIO: 'Mesário', TORCEDOR: 'Torcedor', OLHEIRO: 'Olheiro',
};

export default function Layout() {
  return <ClubPendingProvider><LayoutContent /></ClubPendingProvider>;
}

function LayoutContent() {
  const { clube } = useAuth();
  const pending = useClubPending();
  const missingShirts = pending?.missing ? [...pending.missing.values()].reduce((sum, value) => sum + value, 0) : 0;
  const [moreOpen, setMoreOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    try { return localStorage.getItem('ludora_sidebar_expanded') === 'true'; }
    catch { return false; }
  });
  const [compactSidebar, setCompactSidebar] = useState(() => matchMedia('(max-width: 1050px)').matches);
  const [tabletExpanded, setTabletExpanded] = useState(false);
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 760px)').matches);
  const expanded = compactSidebar ? tabletExpanded : sidebarExpanded;
  const sidebarRef = useRef<HTMLElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const role = clube?.meuPapel ? ROLE_LABELS[clube.meuPapel] || clube.meuPapel : 'Visualização pública';
  const gerenciaClube = ['ADMIN', 'TECNICO', 'MESARIO'].includes(clube?.meuPapel || '');
  const extraLinks = NAV.slice(4);
  const moreActive = extraLinks.some(item => location.pathname.startsWith(item.to)) || location.pathname === '/membros';
  function toggleSidebar() {
    if (compactSidebar) setTabletExpanded(value => !value);
    else setSidebarExpanded(value => {
      try { localStorage.setItem('ludora_sidebar_expanded', String(!value)); } catch {}
      return !value;
    });
  }
  useEffect(() => {
    const media = matchMedia('(max-width: 1050px)');
    const update = () => { setCompactSidebar(media.matches); setTabletExpanded(false); };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!compactSidebar || !tabletExpanded) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!sidebarRef.current?.contains(target) && !target.closest('[data-account-popover], dialog')) setTabletExpanded(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [compactSidebar, tabletExpanded]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const closeOnDesktop = () => { setMobile(media.matches); if (!media.matches) setMoreOpen(false); };
    media.addEventListener('change', closeOnDesktop);
    return () => media.removeEventListener('change', closeOnDesktop);
  }, []);
  useEffect(() => {
    setMoreOpen(false);
    setTabletExpanded(false);
  }, [location.key, clube?.id]);
  useLayoutEffect(() => {
    const navigation = navigationRef.current;
    const layout = layoutRef.current;
    if (!navigation || !layout) return;
    const viewport = window.visualViewport;
    const measure = () => {
      layout.style.setProperty('--mobile-navigation-height', `${navigation.getBoundingClientRect().height}px`);
      const offset = viewport && viewport.scale === 1
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      navigation.style.setProperty('--mobile-navigation-offset', `${offset}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(navigation);
    viewport?.addEventListener('resize', measure);
    viewport?.addEventListener('scroll', measure);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      viewport?.removeEventListener('resize', measure);
      viewport?.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, []);
  return (
    <div className="layout" data-sidebar-expanded={expanded} ref={layoutRef}>
      <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
      
      <aside className="sidebar" ref={sidebarRef} data-tooltip-disabled>
        <div className="sidebar-top">
        <Link to="/dashboard" className="sidebar-brand" aria-label="Ludora — visão geral" aria-hidden={!expanded} tabIndex={expanded ? 0 : -1}>
          <Brand subtitle={false} />
        </Link>
        <button type="button" className="sidebar-toggle" aria-label={expanded ? 'Recolher navegação' : 'Expandir navegação'}
          aria-expanded={expanded} aria-controls="sidebar-navigation" onClick={toggleSidebar}>
          <Icon name={expanded ? 'sidebarCollapse' : 'sidebarExpand'} size={20} />
        </button>
        </div>
        
        <div className="sidebar-club">
          <Link to="/clube" className="current-club" aria-label={`Ver perfil do clube ${clube?.nome || ''}`}>
            <ClubBadge src={clube?.escudo} name={clube?.nome} size={38} />
            <span className="current-club-copy"><strong>{clube?.nome || 'Seu clube'}</strong><small className="current-club-role">{role}</small></span>
          </Link>
          <Link to="/selecionar-clube" className="sidebar-club-switch" aria-label="Trocar clube"><Icon name="switchClub" size={18} /></Link>
        </div>
        
        <nav id="sidebar-navigation" className="sidebar-nav" aria-label="Navegação principal">
          {NAV.slice(0, 4).map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={item.label}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon"><Icon name={item.icon} /></span>
              <span className="nav-label">{item.label}</span>
              {item.to === '/jogadores' && missingShirts > 0 && <span className="nav-pending-count" aria-label={`${missingShirts} jogadores sem camisa`}>{missingShirts}</span>}
            </NavLink>
          ))}
          <span className="sidebar-group-label">{gerenciaClube ? 'GESTÃO' : 'CLUBE'}</span>
          {NAV.slice(4).map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={item.label}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon"><Icon name={item.icon} /></span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
          {clube?.meuPapel === 'ADMIN' && <NavLink to="/membros" aria-label="Pessoas e acessos" className={({isActive})=>`nav-item${isActive?' active':''}`}><span className="nav-icon"><Icon name="user"/></span><span className="nav-label">Pessoas e acessos</span></NavLink>}
        </nav>

        <div className="sidebar-footer">
          <AccountMenu />
          {!mobile && <Notifications />}
        </div>
      </aside>

      <div className="workspace">
        <header className="workspace-header">
          <div className="workspace-header-inner">
            <Link to="/clube" className="current-club" title={`${clube?.nome || 'Clube'} · ${role}`} aria-label={`Ver perfil do clube ${clube?.nome || ''}`}>
              <ClubBadge src={clube?.escudo} name={clube?.nome} size={46} />
              <span className="current-club-copy">
                <strong>{clube?.nome || 'Selecione um clube'}</strong>
                <small className="current-club-role">{role}</small>
              </span>
            </Link>

            <Link to="/selecionar-clube" className="mobile-club-switch" aria-label="Trocar clube"><Icon name="switchClub" size={18} /></Link>
            <div className="workspace-actions">
              {mobile && <Notifications />}
            </div>
          </div>
        </header>

        <main className="content" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      {createPortal(<div className="mobile-navigation">
        <nav className="bottom-nav" ref={navigationRef} aria-label="Navegação principal no celular">
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

          <div className="mobile-more-account">
            <NavLink to="/perfil" className="mobile-more-item" onClick={() => setMoreOpen(false)}>
              <span className="mobile-more-item-icon"><Icon name="user" /></span>
              <span>Conta e preferências</span>
              <Icon name="chevronRight" size={18} />
            </NavLink>
          </div>

        </Modal>
      </div>, document.body)}
    </div>
  );
}
