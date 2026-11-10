import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { Suspense, useEffect, useState } from 'react';
import { DesktopErrorBoundary } from './DesktopErrorBoundary';
import { Spinner } from './AdminUI';
import { Brand } from '@web/components/Brand';
import { ThemeOptions } from '@web/components/ThemeOptions';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { AdminIcon, type AdminIconName } from './AdminIcon';
import { ROTULO_ESTADO, useEstadoTempoReal } from './useTempoReal';

const NAV: { label: string; items: { to: string; label: string; icon: AdminIconName }[] }[] = [
  { label: 'Gestão da plataforma', items: [
    { to: '/clubes', label: 'Clubes', icon: 'shield' },
    { to: '/usuarios', label: 'Usuários', icon: 'people' },
    { to: '/paulista', label: 'Campeonato Paulista', icon: 'trophy' },
  ] },
  { label: 'Operação', items: [
    { to: '/chamados', label: 'Chamados', icon: 'headset' },
    { to: '/manutencao', label: 'Manutenção', icon: 'wrench' },
  ] },
  { label: 'Sistema', items: [
    { to: '/banco', label: 'Banco e integrações', icon: 'database' },
    { to: '/logs', label: 'Logs ao vivo', icon: 'terminal' },
    { to: '/ajustes', label: 'Ajustes', icon: 'settings' },
  ] },
];

export default function AdminLayout() {
  const { usuario, sair } = useAdminAuth();
  const location = useLocation();
  const estado = useEstadoTempoReal();
  const [recolhida, setRecolhida] = useState(() => {
    try { return localStorage.getItem('ludora_desktop_sidebar') === 'recolhida'; }
    catch { return false; }
  });
  const [compacta, setCompacta] = useState(() => matchMedia('(max-width: 960px)').matches);
  const [expandidaCompacta, setExpandidaCompacta] = useState(false);
  useEffect(() => {
    const media = matchMedia('(max-width: 960px)');
    const atualizar = () => { setCompacta(media.matches); setExpandidaCompacta(false); };
    media.addEventListener('change', atualizar);
    return () => media.removeEventListener('change', atualizar);
  }, []);
  const soIcones = compacta ? !expandidaCompacta : recolhida;
  function alternarSidebar() {
    if (compacta) { setExpandidaCompacta(valor => !valor); return; }
    setRecolhida(valor => {
      try { localStorage.setItem('ludora_desktop_sidebar', valor ? 'expandida' : 'recolhida'); }
      catch { /* A preferência é opcional; a navegação continua disponível. */ }
      return !valor;
    });
  }
  const superadmin = usuario?.papel_plataforma === 'SUPERADMIN';
  const inicio = '/visao';
  const secoes = NAV.map(secao => ({ ...secao, items: secao.items.filter(item => superadmin
    || (usuario?.papel_plataforma === 'SUPORTE' && item.to === '/manutencao')
    || ['/chamados', '/ajustes'].includes(item.to)) })).filter(secao => secao.items.length);
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
    <div className={`admin-layout${soIcones ? ' admin-layout-collapsed' : ''}`}>
      <a className="admin-skip-link" href="#main-content" onClick={event => {
        event.preventDefault();
        document.getElementById('main-content')?.focus();
      }}>Pular para o conteúdo</a>
      <aside className="admin-sidebar">
        <div className="admin-sidebar-top">
          <Link to={inicio} className="admin-brand" aria-label="Ludora — visão global"><Brand subtitle={false}/></Link>
          <button type="button" className="admin-sidebar-toggle" aria-label={soIcones ? 'Expandir navegação' : 'Recolher navegação'}
            aria-expanded={!soIcones} aria-controls="admin-navigation" data-tooltip={soIcones ? 'Expandir navegação' : 'Recolher navegação'} onClick={alternarSidebar}>
            <AdminIcon name={soIcones ? 'sidebarExpand' : 'sidebarCollapse'} size={19}/>
          </button>
        </div>

        <nav id="admin-navigation" className="admin-nav" aria-label="Navegação principal">
          <NavLink to="/visao" className="admin-nav-link admin-nav-overview" aria-label="Visão global" data-tooltip={soIcones ? 'Visão global' : undefined}>
            <AdminIcon name="home"/><span className="admin-nav-label">Visão global</span>
          </NavLink>
          {secoes.map(secao => <section className="admin-nav-section" aria-label={secao.label} key={secao.label}>
            <h2 className="admin-sidebar-label">{secao.label}</h2>
            {secao.items.map(item => <NavLink key={item.to} to={item.to} aria-label={item.label}
              data-tooltip={soIcones ? item.label : undefined} className="admin-nav-link">
              <AdminIcon name={item.icon}/><span className="admin-nav-label">{item.label}</span>
            </NavLink>)}
          </section>)}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-account" aria-label={usuario?.nome} data-tooltip={soIcones ? `${usuario?.nome} · ${usuario?.email}` : undefined}>
            <span className="admin-avatar" aria-hidden="true">{usuario?.nome?.[0] || '?'}</span>
            <span className="admin-account-copy">
              <strong>{usuario?.nome}</strong>
              <small>{usuario?.email}</small>
            </span>
          </div>
          <button className="admin-nav-link admin-logout" type="button" aria-label="Sair da conta" data-tooltip={soIcones ? 'Sair da conta' : undefined} onClick={() => void sair()}>
            <AdminIcon name="logout" size={18} /> <span className="admin-nav-label">Sair da conta</span>
          </button>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-workspace-header">
          <div className="admin-header-inner">
            <div className="admin-workspace-actions">
              {ambiente && <Link to="/ajustes" aria-label={`Servidor da API: ${ambiente}. Configurar conexão`} data-tooltip={apiHost}
                className={`admin-environment${ambiente === 'Produção' ? ' admin-environment-production' : ''}`}>{ambiente}</Link>}
              {superadmin && <span className={`rt-pill rt-${estado}`} role="status" aria-label={`Conexão em tempo real: ${ROTULO_ESTADO[estado]}`} data-tooltip="Conexão em tempo real com a API">
                <span className="rt-dot" aria-hidden="true"/>{ROTULO_ESTADO[estado]}
              </span>}
              <ThemeOptions />
            </div>
          </div>
        </header>
        <main className="admin-content" id="main-content" tabIndex={-1}>
          <DesktopErrorBoundary key={location.pathname}><Suspense fallback={<Spinner label="Abrindo tela…"/>}><Outlet /></Suspense></DesktopErrorBoundary>
        </main>
      </div>
    </div>
  );
}
