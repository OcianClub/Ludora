import { useState } from 'react';
import { getThemePreference, setThemePreference, type ThemePreference } from '../styles/theme';
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
  const [tema, setTema] = useState(getThemePreference);
  const [erroTema, setErroTema] = useState('');

  const isDark =
    tema === 'dark' ||
    (tema === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleTema = () => {
    const novoTema: ThemePreference = isDark ? 'light' : 'dark';
    try {
      setThemePreference(novoTema);
      setTema(novoTema);
      setErroTema('');
    } catch {
      setErroTema('Não foi possível salvar o tema.');
    }
  };

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
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="theme-toggle-container">
            <span className="field-label">Aparência</span>
            <button
              type="button"
              className={`theme-toggle ${isDark ? 'dark' : 'light'}`}
              onClick={toggleTema}
              aria-label={`Mudar para tema ${isDark ? 'claro' : 'escuro'}`}
              title={`Tema atual: ${isDark ? 'Escuro' : 'Claro'}`}
            >
              <span className="theme-toggle-track">
                <span className="theme-icon sun" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                </span>
                <span className="theme-icon moon" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                </span>
                <span className="theme-toggle-thumb" />
              </span>
            </button>
          </div>

          {erroTema && <small role="alert">{erroTema}</small>}

          <Link to="/perfil" className="sidebar-usuario">
            <span className="usuario-avatar">{usuario?.nome?.[0] || '?'}</span>
            <span className="usuario-info">
              <strong>{usuario?.nome || 'Meu perfil'}</strong>
              <small>Minha conta</small>
            </span>
            <Icon name="arrow" size={16} />
          </Link>

          <button className="btn-logout" onClick={logout}>
            <Icon name="logout" size={18} /> Sair da conta
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="workspace-header">
          <Link to="/selecionar-clube" className="current-club" title="Trocar clube">
            <ClubBadge src={clube?.escudo} size={38} />
            <span>
              <strong>{clube?.nome || 'Selecione um clube'}</strong>
              {clube?.meuPapel && <PapelBadge papel={clube.meuPapel} />}
            </span>
          </Link>

          <div className="workspace-actions">
            <Link to="/selecionar-clube" className="btn btn-ghost btn-sm" aria-label="Trocar clube">
              <Icon name="switchClub" size={18} />
              <span>Trocar clube</span>
            </Link>
            <Link to="/perfil" className="profile-link" aria-label="Meu perfil">
              <Icon name="user" />
            </Link>
            <button className="profile-link mobile-logout" onClick={logout} aria-label="Sair da conta">
              <Icon name="logout" size={18} />
            </button>
          </div>
        </header>

        <main className="content" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}