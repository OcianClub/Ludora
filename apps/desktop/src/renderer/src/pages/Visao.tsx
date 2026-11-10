import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { VisaoGlobal, ResumoOperacional } from '@ludora/shared-types';
import { Btn, LoadingSkeleton, DesktopState, DesktopSection } from '../components/AdminUI';
import { Icon, type IconName } from '@web/components/Icon';
import { CollectionSearch, CollectionViewToggle } from '@web/components/CollectionToolbar';
import { DesktopMenu, DesktopMenuRadioItem, DesktopMenuLabel, DesktopMenuSeparator, DesktopMenuItem } from '../components/DesktopMenu';
import { AdminIcon, type AdminIconName } from '../components/AdminIcon';
import { fetchVisaoGlobal, requestJson } from '../services/api';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { ServicesDiagnostic } from '../components/ServicesDiagnostic';
import { LiveMatchesReview } from '../components/LiveMatchesReview';
import { PlatformClubCards, PlatformClubTable, type PlatformClubSort, type PlatformClubSortKey } from '../components/PlatformClubCollection';
import './Visao.css';

const numero = (n: number) => n.toLocaleString('pt-BR');

export default function VisaoPage() {
  const { usuario } = useAdminAuth();
  const superadmin = usuario?.papel_plataforma === 'SUPERADMIN';
  const [dados, setDados] = useState<VisaoGlobal | null>(null);
  const [operacao, setOperacao] = useState<ResumoOperacional | null>(null);
  const [erro, setErro] = useState('');
  const [erroOperacao, setErroOperacao] = useState(false);
  const [busca, setBusca] = useState('');
  const [modo, setModo] = useState('tabela');
  const [filtros, setFiltros] = useState({ status: '', plano: '' });
  const [ordem, setOrdem] = useState<PlatformClubSort>(null);
  const [revisar, setRevisar] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [atualizado, setAtualizado] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const sequencia = useRef(0);
  const carregar = useCallback(async () => {
    const id = ++sequencia.current;
    setAtualizando(true); setErro(''); setErroOperacao(false);
    const [principal, resumo] = await Promise.allSettled([fetchVisaoGlobal(), requestJson<ResumoOperacional>('/admin/overview/operacao')]);
    if (id !== sequencia.current) return;
    if (principal.status === 'fulfilled') { setDados(principal.value); setAtualizado(new Date().toISOString()); }
    else setErro('Não foi possível atualizar os totais e clubes.');
    if (resumo.status === 'fulfilled') setOperacao(resumo.value);
    else setErroOperacao(true);
    setAtualizando(false);
  }, []);
  useEffect(() => { if (superadmin) void carregar(); return () => { sequencia.current++; }; }, [carregar, superadmin]);
  useEffect(() => {
    if (!superadmin) return;
    let ativo = true;
    const conferir = () => {
      if (document.visibilityState !== 'visible' || !ativo) return;
      requestJson<ResumoOperacional>('/admin/overview/operacao').then(r => { if (ativo) { setOperacao(r); setErroOperacao(false); } })
        .catch(() => { if (ativo) setErroOperacao(true); });
    };
    const intervalo = window.setInterval(conferir, 60_000);
    window.addEventListener('focus', conferir);
    return () => { ativo = false; clearInterval(intervalo); window.removeEventListener('focus', conferir); };
  }, [superadmin]);

  if (!superadmin) return <div className="desktop-overview">
    <header className="page-header"><div><h1 className="page-title">Visão global</h1><p className="page-sub">Serviços e atendimento da plataforma.</p></div></header>
    <div className="desktop-shortcuts" aria-label="Operação da plataforma">
      <Link to={usuario?.papel_plataforma === 'DESENVOLVEDOR' ? '/chamados?visao=ENCAMINHADOS' : '/chamados?visao=MEUS'}><span className="desktop-shortcut-icon"><AdminIcon name="headset"/></span><span><strong>{usuario?.papel_plataforma === 'DESENVOLVEDOR' ? 'Chamados encaminhados' : 'Meus chamados'}</strong><small>Acompanhar o atendimento</small></span><Icon name="chevronRight" size={16}/></Link>
      <Link to="/chamados"><span className="desktop-shortcut-icon"><AdminIcon name="headset"/></span><span><strong>Fila de chamados</strong><small>Consultar relatos e respostas</small></span><Icon name="chevronRight" size={16}/></Link>
      {usuario?.papel_plataforma === 'SUPORTE' && <Link to="/manutencao"><span className="desktop-shortcut-icon"><AdminIcon name="wrench"/></span><span><strong>Manutenção</strong><small>Revisar pausas de funções</small></span><Icon name="chevronRight" size={16}/></Link>}
    </div><ServicesDiagnostic/>
  </div>;

  if (erro && !dados) return <DesktopState error title="Não foi possível carregar a visão global" description={erro} onRetry={carregar}/>;
  if (!dados) return <LoadingSkeleton kind="overview" label="Carregando visão global"/>;
  const { totais, conexoes, clubes } = dados;
  const atuais = !erroOperacao ? operacao : null;
  const filtrados = clubes.filter(c => [c.nome, c.cidade, c.estado].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR'))
    && (!filtros.status || c.ativo === (filtros.status === 'ativo')) && (!filtros.plano || c.plano === filtros.plano));
  if (ordem) filtrados.sort((a, b) => {
    const x = a[ordem.key], y = b[ordem.key];
    return ordem.dir * (typeof x === 'number' && typeof y === 'number' ? x - y : typeof x === 'boolean' && typeof y === 'boolean' ? Number(x) - Number(y) : String(x ?? '').localeCompare(String(y ?? ''), 'pt-BR')) || a.id - b.id;
  });
  const ordenar = (key: PlatformClubSortKey) => setOrdem(old => old?.key !== key ? { key, dir: 1 } : old.dir === 1 ? { key, dir: -1 } : null);
  const attention: { to: string; title: string; detail: string; state: string; health: string; icon: AdminIconName }[] = [
    { to: '/chamados', title: 'Chamados', detail: atuais?.chamados?.atrasados ? `${atuais.chamados.atrasados} com revisão atrasada` : 'Acompanhar relatos e atendimento', state: atuais?.chamados ? atuais.chamados.abertos ? `${numero(atuais.chamados.abertos)} abertos` : 'Sem chamados abertos' : 'Consulta indisponível', health: !atuais?.chamados ? 'unknown' : atuais.chamados.abertos ? 'warning' : 'good', icon: 'headset' },
    { to: '/manutencao', title: 'Manutenção', detail: 'Revisar pausas de funções', state: atuais?.manutencao == null ? 'Consulta indisponível' : atuais.manutencao ? `${numero(atuais.manutencao)} ${atuais.manutencao === 1 ? 'pausa ativa' : 'pausas ativas'}` : 'Nenhuma pausa ativa', health: atuais?.manutencao == null ? 'unknown' : atuais.manutencao ? 'warning' : 'good', icon: 'wrench' },
    { to: '/paulista', title: 'Federação', detail: 'Conferir sincronização e divergências', state: !atuais?.federacao ? 'Consulta indisponível' : atuais.federacao.erroRotina || atuais.federacao.falhas ? 'Falha na atualização' : atuais.federacao.pendencias ? `${numero(atuais.federacao.pendencias)} pendências` : 'Sem pendências identificadas', health: !atuais?.federacao ? 'unknown' : atuais.federacao.erroRotina || atuais.federacao.falhas || atuais.federacao.pendencias ? 'warning' : 'good', icon: 'trophy' },
  ];
  const totalItems: [string, number, IconName][] = [['Clubes ativos', clubes.filter(c => c.ativo).length, 'shield'], ['Contas da plataforma', totais.usuarios, 'user'], ['Jogadores', totais.jogadores, 'team'], ['Partidas cadastradas', totais.partidas, 'ball']];
  return <div className="desktop-overview overview-v2">
    <header className="page-header"><div><span className="ticket-kicker">Plataforma Ludora</span><h1 className="page-title">Visão global</h1><p className="page-sub">Operação, serviços e clubes em um só lugar.</p></div><div className="overview-refresh"><small>{atualizado && `Totais consultados às ${new Date(atualizado).toLocaleTimeString('pt-BR')}`}</small><Btn variant="ghost" disabled={atualizando} onClick={() => { setRefreshKey(n => n + 1); void carregar(); }}><Icon name="refresh" size={16}/>{atualizando ? 'Atualizando…' : 'Atualizar'}</Btn></div></header>
    {erro && <p className="overview-error" role="alert">{erro} Os últimos dados continuam visíveis.</p>}
    {erroOperacao && <p className="overview-error" role="alert">Não foi possível consultar a operação. As contagens de atenção não estão disponíveis.</p>}
    {!!atuais?.antigas?.length && <div className="overview-review" role="status"><Icon name="clock" size={22}/><div><strong>{numero(atuais.antigas.length)} {atuais.antigas.length === 1 ? 'partida está' : 'partidas estão'} há mais de 24 horas ao vivo</strong><p>Revise o encerramento para atualizar a súmula e o Scout.</p>{atuais.consultadoEm && <small>Conferido às {new Date(atuais.consultadoEm).toLocaleTimeString('pt-BR')}</small>}</div><Btn variant="ghost" onClick={() => setRevisar(true)}>Revisar partidas<Icon name="chevronRight" size={15}/></Btn></div>}
    {!!atuais?.semInicio?.length && <div className="overview-untracked"><Icon name="info" size={16}/><span>{numero(atuais.semInicio.length)} partidas ao vivo sem registro do início. A duração não pode ser confirmada.</span><button type="button" onClick={() => setRevisar(true)}>Consultar partidas</button></div>}
    {atuais && atuais.antigas === null && <p className="overview-error" role="status">Não foi possível conferir o início das partidas ao vivo.</p>}
    <div className="desktop-shortcuts overview-attention" aria-label="Operação da plataforma">{attention.map(a => <Link key={a.to} to={a.to} data-health={a.health}><span className="desktop-shortcut-icon"><AdminIcon name={a.icon} size={21}/></span><span><strong>{a.title}</strong><em>{a.state}</em><small>{a.detail}</small></span><Icon name="chevronRight" size={16}/></Link>)}</div>
    <div className="overview-now-grid"><DesktopSection title="Agora" className="overview-now"><dl><div><dt><i className="overview-live-dot"/>Partidas ao vivo</dt><dd>{numero(totais.partidasAoVivo)}</dd></div><div><dt>Conexões Web e App</dt><dd>{numero(conexoes.principal)}</dd></div></dl><p>Conexões nesta instância da API; não representam usuários únicos.</p></DesktopSection><ServicesDiagnostic compact refreshKey={refreshKey}/></div>
    <dl className="overview-totals" aria-label="Totais da plataforma">{totalItems.map(([label, value, icon]) => <div key={label}><Icon name={icon} size={18}/><dt>{label}</dt><dd>{numero(value)}</dd></div>)}</dl>
    <section className="overview-club-directory" aria-labelledby="overview-clubs-title">
      <header className="desktop-section-heading"><h2 id="overview-clubs-title">Clubes na plataforma</h2><Link className="desktop-text-link" to="/clubes">Gerenciar clubes<Icon name="chevronRight" size={15}/></Link></header>
      <div className="overview-club-toolbar"><CollectionSearch label="Buscar clube na visão global" placeholder="Nome, cidade ou UF…" value={busca} onChange={setBusca}/>
        <DesktopMenu label="Filtrar clubes na visão global" className="overview-club-filter" trigger={<><Icon name="filters" size={18}/>{(filtros.status || filtros.plano) && <span className="compact-filter-count">{Number(!!filtros.status) + Number(!!filtros.plano)}</span>}</>}>
          <div role="group" aria-label="Situação"><DesktopMenuLabel>Situação</DesktopMenuLabel>
            {[['', 'Todas as situações'], ['ativo', 'Ativo'], ['inativo', 'Indisponível']].map(([value, label]) => <DesktopMenuRadioItem key={value} checked={filtros.status === value} onSelect={() => setFiltros(f => ({ ...f, status: value }))}>{label}</DesktopMenuRadioItem>)}
          </div>
          <DesktopMenuSeparator/>
          <div role="group" aria-label="Plano"><DesktopMenuLabel>Plano</DesktopMenuLabel>
            {['', ...[...new Set(clubes.map(c => c.plano))].sort()].map(plano => <DesktopMenuRadioItem key={plano} checked={filtros.plano === plano} onSelect={() => setFiltros(f => ({ ...f, plano }))}>{plano || 'Todos os planos'}</DesktopMenuRadioItem>)}
          </div>
          <DesktopMenuSeparator/><DesktopMenuItem disabled={!filtros.status && !filtros.plano} icon={<Icon name="refresh" size={15}/>} onSelect={() => setFiltros({ status: '', plano: '' })}>Limpar filtros</DesktopMenuItem>
        </DesktopMenu>
        <CollectionViewToggle value={modo} onChange={setModo} options={[{value:'tabela',label:'Tabela',icon:'table'},{value:'cards',label:'Cards',icon:'grid'}]}/></div>
      <p className="overview-club-count" role="status"><strong>{filtrados.length} {filtrados.length === 1 ? 'clube' : 'clubes'}</strong><span>{filtrados.length !== clubes.length ? `de ${clubes.length} cadastrados · ` : ''}{clubes.filter(c => !c.ativo).length} indisponíveis</span></p>
      {!filtrados.length ? <DesktopState icon="search" title="Nenhum clube encontrado" description="Experimente outro nome ou município."/> : modo === 'tabela' ? <PlatformClubTable clubes={filtrados} ordem={ordem} onSort={ordenar}/> : <PlatformClubCards clubes={filtrados}/>}
    </section>
    <LiveMatchesReview open={revisar} onClose={() => setRevisar(false)} partidas={[...(atuais?.antigas ?? []), ...(atuais?.semInicio ?? [])]} consultadoEm={atuais?.consultadoEm}/>
  </div>;
}
