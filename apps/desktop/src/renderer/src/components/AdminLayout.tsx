import { Outlet, NavLink, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Brand } from '@web/components/Brand';
import { ThemeOptions } from '@web/components/ThemeOptions';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { AdminIcon, type AdminIconName } from './AdminIcon';
import { ROTULO_ESTADO, useEstadoTempoReal } from './useTempoReal';
import { NOMES_PAPEIS } from '../pages/Equipe';

const NAV: { to: string; label: string; icon: AdminIconName }[] = [
  { to: '/equipe', label: 'Área da equipe', icon: 'user' },
  { to: '/chamados', label: 'Chamados', icon: 'clipboard' },
  { to: '/manutencao', label: 'Manutenção', icon: 'info' },
  { to: '/visao', label: 'Visão global', icon: 'home' },
  { to: '/clubes', label: 'Clubes', icon: 'shield' },
  { to: '/paulista', label: 'Campeonato Paulista', icon: 'radar' },
  { to: '/usuarios', label: 'Usuários', icon: 'user' },
  { to: '/banco', label: 'Banco e integrações', icon: 'radar' },
  { to: '/logs', label: 'Logs ao vivo', icon: 'clipboard' },
  { to: '/ajustes', label: 'Ajustes', icon: 'info' },
];

export default function AdminLayout() {
  const { usuario, sair } = useAdminAuth();
  const estado = useEstadoTempoReal();
  const [apiHost, setApiHost] = useState('');
  useEffect(() => {
    let ativo = true;
    window.ludora.config.obter().then(config => {
      if (ativo) setApiHost(new URL(config.apiUrl).hostname);
    }).catch(() => undefined);
    return () => { ativo = false; };
  }, []);
  const ambiente = ['localhost', '127.0.0.1', '[::1]'].includes(apiHost)
    ? 'API local'
    : apiHost === 'ludora-pgho.onrender.com' ? 'Produção' : apiHost;

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <Link to="/visao" className="admin-brand" aria-label="Ludora Admin — visão global"><Brand /></Link>
        <span className="admin-sidebar-label">PLATAFORMA</span>

        <nav className="admin-nav" aria-label="Navegação principal">
          {NAV.filter(item => usuario?.papel_plataforma === 'SUPERADMIN' || (usuario?.papel_plataforma === 'SUPORTE' && item.to === '/manutencao') || ['/equipe', '/chamados', '/ajustes'].includes(item.to)).map(item => (
            <NavLink key={item.to} to={item.to} aria-label={item.label} className="admin-nav-link">
              <AdminIcon name={item.icon} />
              <span className="admin-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-account" aria-label={usuario?.nome}>
            <span className="admin-avatar" aria-hidden="true">{usuario?.nome?.[0] || '?'}</span>
            <span className="admin-account-copy">
              <strong>{usuario?.nome}</strong>
              <small>{usuario?.email}</small>
            </span>
          </div>
          <button className="admin-nav-link admin-logout" type="button" aria-label="Sair da conta" onClick={() => void sair()}>
            <AdminIcon name="logout" size={18} /> <span className="admin-nav-label">Sair da conta</span>
          </button>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-workspace-header">
          <span className="admin-badge"><AdminIcon name="star" size={16} /> {usuario && NOMES_PAPEIS[usuario.papel_plataforma]}</span>
          <div className="admin-workspace-actions">
            {ambiente && <Link to="/ajustes" className={`admin-environment${ambiente === 'Produção' ? ' admin-environment-production' : ''}`}>{ambiente}</Link>}
            {usuario?.papel_plataforma === 'SUPERADMIN' && <span className={`rt-pill rt-${estado}`} title="Conexão em tempo real com a API">
              <span className="rt-dot" />{ROTULO_ESTADO[estado]}
            </span>}
            <ThemeOptions />
          </div>
        </header>
        <main className="admin-content" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
