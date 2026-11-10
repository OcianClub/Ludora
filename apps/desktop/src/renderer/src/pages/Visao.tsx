import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { VisaoGlobal } from '@ludora/shared-types';
import { ClubBadge } from '@web/components/Brand';
import { Btn, LoadingSkeleton, DesktopState, DesktopSection } from '../components/AdminUI';
import { Icon, type IconName } from '@web/components/Icon';
import { CollectionSearch } from '@web/components/CollectionToolbar';
import { AdminIcon, type AdminIconName } from '../components/AdminIcon';
import { fetchVisaoGlobal } from '../services/api';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { ServicesDiagnostic } from '../components/ServicesDiagnostic';

export default function VisaoPage() {
  const { usuario } = useAdminAuth();
  const superadmin = usuario?.papel_plataforma === 'SUPERADMIN';
  const [dados, setDados] = useState<VisaoGlobal | null>(null);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(() => {
    setErro('');
    setAtualizando(true);
    fetchVisaoGlobal().then(setDados).catch(e => setErro(e.message)).finally(() => setAtualizando(false));
  }, []);
  useEffect(() => { if (superadmin) carregar(); }, [carregar, superadmin]);

  if (!superadmin) return <div className="desktop-overview">
    <header className="page-header"><div><h1 className="page-title">Visão global</h1><p className="page-sub">Serviços e atendimento da plataforma.</p></div></header>
    <div className="desktop-shortcuts" aria-label="Operação da plataforma">
      <Link to={usuario?.papel_plataforma === 'DESENVOLVEDOR' ? '/chamados?visao=ENCAMINHADOS' : '/chamados?visao=MEUS'}><span className="desktop-shortcut-icon"><AdminIcon name="headset"/></span><span><strong>{usuario?.papel_plataforma === 'DESENVOLVEDOR' ? 'Chamados encaminhados' : 'Meus chamados'}</strong><small>Acompanhar o atendimento</small></span><Icon name="chevronRight" size={16}/></Link>
      <Link to="/chamados"><span className="desktop-shortcut-icon"><AdminIcon name="headset"/></span><span><strong>Fila de chamados</strong><small>Consultar relatos e respostas</small></span><Icon name="chevronRight" size={16}/></Link>
      {usuario?.papel_plataforma === 'SUPORTE' && <Link to="/manutencao"><span className="desktop-shortcut-icon"><AdminIcon name="wrench"/></span><span><strong>Manutenção</strong><small>Revisar pausas de funções</small></span><Icon name="chevronRight" size={16}/></Link>}
    </div>
    <ServicesDiagnostic/>
  </div>;

  if (erro && !dados) return <DesktopState error title="Não foi possível carregar a visão global" description={erro} onRetry={carregar}/>;
  if (!dados) return <LoadingSkeleton kind="overview" label="Carregando visão global"/>;
  const { totais, conexoes, clubes } = dados;
  const filtrados = clubes.filter(c => [c.nome, c.cidade, c.estado].filter(Boolean).join(' ').toLowerCase().includes(busca.trim().toLowerCase()));
  const cartoes: [string, number, IconName][] = [
    ['Clubes ativos', clubes.filter(c => c.ativo).length, 'shield'],
    ['Contas da plataforma', totais.usuarios, 'user'],
    ['Jogadores', totais.jogadores, 'team'],
    ['Partidas cadastradas', totais.partidas, 'ball'],
    ['Partidas ao vivo', totais.partidasAoVivo, 'live'],
    ['Conexões Web e App', conexoes.principal, 'desktop'],
  ];

  return (
    <div className="desktop-overview">
      <div className="page-header">
        <div><span className="ticket-kicker">Plataforma Ludora</span><h1 className="page-title">Visão global</h1><p className="page-sub">Clubes, elenco e atividade em um só lugar.</p></div>
        <Btn variant="ghost" disabled={atualizando} onClick={carregar}><Icon name="refresh" size={17}/>{atualizando ? 'Atualizando…' : 'Atualizar'}</Btn>
      </div>

      {erro && <DesktopState error title="Não foi possível atualizar" description="Os últimos dados carregados continuam visíveis." onRetry={carregar}/>}
      <dl className="desktop-overview-metrics" aria-label="Resumo da plataforma">
        {cartoes.map(([rotulo, valor, icone]) => <div key={rotulo}>
          <dt><Icon name={icone} size={18}/>{rotulo}</dt><dd>{valor.toLocaleString('pt-BR')}</dd>
        </div>)}
      </dl>
      <div className="desktop-shortcuts" aria-label="Operação da plataforma">
        {([
          ['/chamados', 'Chamados', 'Acompanhar relatos e atendimento', 'headset'],
          ['/manutencao', 'Manutenção', 'Revisar pausas de funções', 'wrench'],
          ['/paulista', 'Federação', 'Conferir sincronização e divergências', 'trophy'],
        ] as [string, string, string, AdminIconName][]).map(([to, title, detail, icon]) => <Link to={to} key={to}>
          <span className="desktop-shortcut-icon"><AdminIcon name={icon} size={21}/></span><span><strong>{title}</strong><small>{detail}</small></span><Icon name="chevronRight" size={16}/>
        </Link>)}
      </div>
      <ServicesDiagnostic/>
      <DesktopSection title="Clubes na plataforma" description={`${clubes.length} cadastros · ${clubes.filter(c => !c.ativo).length} indisponíveis`}
        actions={<Link className="desktop-text-link" to="/clubes">Gerenciar clubes<Icon name="chevronRight" size={15}/></Link>}>
        <CollectionSearch label="Buscar clube na visão global" placeholder="Nome, cidade ou UF…" value={busca} onChange={setBusca}/>
        {filtrados.length ? <div className="club-directory desktop-overview-clubs">{filtrados.map(c => <Link key={c.id} to={`/clubes/${c.id}`} className="club-directory-card">
          <ClubBadge src={c.escudo} name={c.nome} size={40}/><span className="ticket-card-copy"><strong>{c.nome}</strong><small>{[c.cidade, c.estado].filter(Boolean).join(' · ') || 'Localização pendente'}</small></span><Icon name="chevronRight" size={17}/>
          <span className="desktop-club-plan" data-unavailable={!c.ativo}>{c.ativo ? c.plano : 'Indisponível'}</span>
          <dl className="club-directory-meta"><div><dt>Membros</dt><dd>{c.membros}</dd></div><div><dt>SUBs</dt><dd>{c.categorias}</dd></div><div><dt>Jogadores</dt><dd>{c.jogadores}</dd></div><div><dt>Partidas</dt><dd>{c.partidas}</dd></div></dl>
        </Link>)}</div> : <DesktopState icon="search" title="Nenhum clube encontrado" description={busca ? 'Experimente outro nome ou município.' : 'Os clubes cadastrados aparecerão aqui.'}/>}
      </DesktopSection>
    </div>
  );
}
