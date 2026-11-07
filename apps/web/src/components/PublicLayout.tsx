import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Brand, ClubBadge } from './Brand';
import { AccountMenu } from './AccountMenu';
import { Notifications } from './Notifications';
import { Icon, type IconName } from './Icon';
import { subscribePublicClub } from '../services/matchRealtime';
import './PublicLayout.css';

export function PublicHeader() {
  const { clube, clubeSelecionado, token, podeEntrarGestao, mudarModo } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const insideClub = Boolean(clube) && (/^\/clubes\/\d+(?:\/|$)/.test(pathname) || /^\/(dashboard|partidas|competicoes)(?:\/|$)/.test(pathname));
  const base = clube ? `/clubes/${clube.id}` : '';
  const links: { to: string; label: string; icon: IconName; end?: boolean }[] = [
    ...(clube ? [{ to: base, label: 'Visão geral', icon: 'home' as IconName, end: true },
      { to: `${base}/partidas`, label: 'Partidas', icon: 'ball' as IconName },
      { to: `${base}/competicoes`, label: 'Campeonatos', icon: 'trophy' as IconName }] : []),
    { to: '/selecionar-clube', label: 'Clubes', icon: 'shield' },
  ];
  const active = (link: typeof links[number], isActive: boolean) => isActive || (link.icon === 'home' && pathname === '/dashboard') || (link.icon === 'ball' && pathname.startsWith('/partidas')) || (link.icon === 'trophy' && pathname.startsWith('/competicoes')) ? 'active' : '';
  return <>
    <header className={`public-header${insideClub ? ' public-header-in-club' : ''}`}><div className="public-header-inner">
      <div className="public-header-identity">
      <Link to="/selecionar-clube" className="public-brand" aria-label="Ludora · encontrar clubes"><Brand /></Link>
      {insideClub && clube && <div className="public-club-switcher">
        <Link to={base} className="public-current-club" aria-label={`Visão geral do ${clube.nome}`}><ClubBadge src={clube.escudo} name={clube.nome} size={34} /><strong>{clube.nome}</strong></Link>
      </div>}
      </div>
      {insideClub && <nav className="public-top-nav" aria-label="Navegação pública">{links.map(link => <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => active(link, isActive)}>{link.label}</NavLink>)}</nav>}
      <div className="public-header-actions">
        {insideClub && podeEntrarGestao && <button type="button" className="btn btn-ghost btn-sm public-manage" aria-label="Gerenciar clube" onClick={() => { mudarModo('gestao'); navigate('/dashboard'); }}><Icon name="settings" size={16} /><span>Gerenciar clube</span></button>}
        {insideClub && token && clubeSelecionado?.meuPapel && <Notifications />}
        <AccountMenu header />
      </div>
    </div></header>
    {insideClub && <nav className="public-bottom-nav" aria-label="Navegação pública no celular">{links.map(link => <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => active(link, isActive)}><Icon name={link.icon} size={21} /><span>{link.label === 'Visão geral' ? 'Início' : link.label}</span></NavLink>)}
      {podeEntrarGestao && <button type="button" onClick={() => { mudarModo('gestao'); navigate('/dashboard'); }}><Icon name="settings" size={21} /><span>Gerenciar</span></button>}
    </nav>}
  </>;
}

export default function PublicLayout() {
  const { clube } = useAuth();
  const { pathname } = useLocation();
  const matchPage = /^\/partidas\/\d+$/.test(pathname);
  useEffect(() => clube && !matchPage ? subscribePublicClub(clube.id) : undefined, [clube?.id, matchPage]);
  return <div className="public-layout"><PublicHeader /><main id="main-content" tabIndex={-1} className="public-content"><Outlet /></main></div>;
}
