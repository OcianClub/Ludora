import { memo, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchHomePartidas, fetchCategorias, cachedJson, invalidateApiReads, type HomePartida, type Categoria } from '../services/api';
import { Btn } from '../components/UI';
import { CategoryFilter } from '../components/CategoryFilter';
import { useClubCategory } from '../hooks/useClubCategory';
import { HomePending, HomeHighlights, useHomeHighlights } from '../components/HomeOverviewSupport';
import { HomeHistoryTable, HomeMatch } from '../components/HomeMatch';
import { HomeSkeleton } from '../components/HomeSkeleton';
import { ClubBadge } from '../components/Brand';
import { Icon } from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import { teamName } from '../utils/teamIdentity';
import { acaoHome, dataHome, gerenciaCategoria, hojeCalendario, resumoCategoria } from '../utils/homeDashboard';
import './Dashboard.css';

type Snapshot = { clubId: number; matches: HomePartida[]; categories: Categoria[]; updatedAt: Date };

function cachedSnapshot(clubId?: number): Snapshot | null {
  if (!clubId) return null;
  const matches = cachedJson<HomePartida[]>(`/partidas/home?hoje=${hojeCalendario()}`);
  const categories = cachedJson<Categoria[]>('/categorias');
  return matches && categories ? { clubId, matches, categories: [...categories].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })), updatedAt: new Date() } : null;
}

const HomeCategoryPanel = memo(function HomeCategoryPanel({ current, matches, podeGerenciar, refreshKey }: {
  current: Categoria;
  matches: HomePartida[];
  podeGerenciar: boolean;
  refreshKey: number;
}) {
  const { clube } = useAuth();
  const { principal, aoVivo, historico, seguintes, outrasCategoriasComAgenda } = useMemo(
    () => resumoCategoria(matches, current.nome, hojeCalendario()),
    [matches, current.nome],
  );
  const highlights = useHomeHighlights(current.id, !podeGerenciar, refreshKey);
  const hasHighlights = !podeGerenciar && (highlights.loading || highlights.error || highlights.leaders.length > 0);
  const hasExtras = aoVivo.length > 1;
  const featuredUpcoming = principal && ['AGENDADA', 'PREPARADA'].includes(principal.status);
  const upcomingDays = useMemo(() => {
    const days = new Map<string, HomePartida[]>();
    for (const match of seguintes) {
      const day = match.data.slice(0, 10);
      days.set(day, [...(days.get(day) || []), match]);
    }
    return [...days.entries()];
  }, [seguintes]);
  return (
    <div className="home-swipe-content">
      <div className={`home-focus${podeGerenciar ? '' : ' home-focus-public'}`}>
        <section className="home-feature">
          <div className="home-section-heading">
            <h2>{principal?.status === 'AO_VIVO' ? 'Agora em campo' : principal?.status === 'FINALIZADA' ? 'Última partida' : principal?.data.slice(0, 10) === hojeCalendario() ? 'É dia de jogo' : 'Próxima partida'}</h2>
            {principal?.status === 'AO_VIVO'
              ? <span className="home-live"><i aria-hidden="true" />Ao vivo</span>
              : <span className="home-category-label">{current.nome.toUpperCase()}</span>}
          </div>
          {principal ? <HomeMatch partida={principal} manager={podeGerenciar} /> : (
            <div className="home-empty"><Icon name="calendar" size={30} /><h3>Seu próximo jogo aparece aqui</h3><p>Ainda não há partidas agendadas para o {current.nome.toUpperCase()}.</p><Link className="btn btn-ghost btn-sm" to="/partidas">{podeGerenciar ? 'Abrir agenda e organizar partida' : 'Ver agenda do clube'}</Link></div>
          )}
          {hasExtras && <div className="home-feature-extras">
            {aoVivo.length > 1 && <div className="home-extra-live">
              {aoVivo.slice(1, 3).map(match => <Link key={match.id} to={`/partidas/${match.id}`}>Também ao vivo: {teamName(match.mandante?.nome ?? '')} × {teamName(match.visitante?.nome ?? '')}<Icon name="chevronRight" size={16} /></Link>)}
            </div>}
          </div>}
        </section>

        <div className="home-side">
          {podeGerenciar && <HomePending category={current} matches={[...(principal ? [principal] : []), ...seguintes, ...historico].filter((match, index, rows) => rows.findIndex(row => row.id === match.id) === index)} refreshKey={refreshKey} />}
          <section className="home-upcoming">
            <div className="home-section-heading"><h2>Na sequência</h2><Link to={`/partidas?status=PROXIMAS&categoria_id=${current.id}`}>Ver agenda<Icon name="chevronRight" size={15} /></Link></div>
            <div className="home-upcoming-card">
              {seguintes.length ? <div className="home-upcoming-list">
                {upcomingDays.map(([day, games]) => <div className="home-upcoming-day" key={day}>
                  <h3><Icon name="calendar" size={16} /><time dateTime={day}>{day === hojeCalendario() ? 'Hoje · ' : ''}{dataHome(day)}</time></h3>
                  {games.map(match => {
                    const opponent = match.emCasa ? match.visitante : match.mandante;
                    const detail = podeGerenciar ? match.minha_equipe_pronta ? 'Equipe confirmada' : match.status === 'PREPARADA' ? 'Preparada' : 'Agendada' : match.local || 'Local a definir';
                    const metadata = `${match.emCasa ? 'Em casa' : 'Fora'} · ${detail}`;
                    return <Link key={match.id} className="home-upcoming-match" to={`/partidas/${match.id}`}
                      aria-label={`${dataHome(day, true)}, ${match.horario || 'horário a definir'}: contra ${teamName(opponent?.nome || 'Adversário')}. ${acaoHome(match, podeGerenciar, clube?.id)}`}>
                      <time className="home-upcoming-time" dateTime={match.horario ? `${day}T${match.horario}` : day}><Icon name="clock" size={14} />{match.horario || 'A definir'}</time>
                      <ClubBadge src={opponent?.escudo} name={teamName(opponent?.nome || 'Adversário')} size={34} />
                      <span className="home-upcoming-opponent"><strong data-tooltip={teamName(opponent?.nome || 'Adversário')} data-tooltip-overflow>{teamName(opponent?.nome || 'Adversário')}</strong><small><Icon name={match.emCasa ? 'home' : 'bus'} size={13} /><span data-tooltip={metadata} data-tooltip-overflow>{metadata}</span></small></span>
                      <span className="home-upcoming-action"><span>{podeGerenciar ? acaoHome(match, true, clube?.id).replace(' da partida', '') : 'Ver jogo'}</span><Icon name="chevronRight" size={16} /></span>
                    </Link>;
                  })}
                </div>)}
              </div> : <div className="home-upcoming-empty">
                <Icon name="calendar" size={25} />
                <h3>{featuredUpcoming ? 'A próxima partida está em destaque acima' : `Nenhuma partida futura no ${current.nome.toUpperCase()}`}</h3>
                <p>{featuredUpcoming
                  ? 'Depois dela, não há outros compromissos marcados nesta categoria.'
                  : outrasCategoriasComAgenda.length
                    ? `Há jogos agendados em ${outrasCategoriasComAgenda.join(', ')}. Troque a categoria para consultar.`
                    : 'Os próximos jogos desta categoria aparecerão aqui.'}</p>
              </div>}
            </div>
          </section>
          {hasHighlights && <HomeHighlights category={current} highlights={highlights} />}
        </div>
      </div>

      <section className="home-history">
        <div className="home-section-heading"><h2>Histórico de partidas <span className="home-category-label">{current.nome.toUpperCase()}</span></h2><Link to={`/partidas?status=FINALIZADA&categoria_id=${current.id}`}>Ver histórico completo<Icon name="chevronRight" size={15} /></Link></div>
        {historico.length ? <HomeHistoryTable partidas={historico} />
          : <div className="home-empty"><Icon name="ball" size={28} /><p>As partidas finalizadas desta categoria aparecerão aqui.</p></div>}
      </section>
    </div>
  );
});

export default function DashboardPage() {
  const { clube } = useAuth();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(() => cachedSnapshot(clube?.id));
  const [params, setParams] = useSearchParams();
  const { phase, selected: current } = useClubCategory(snapshot && snapshot.clubId === clube?.id ? snapshot.categories : [], params.get('categoria_id'), params.get('fase'));
  const [pending, setPending] = useState(true);
  const [failure, setFailure] = useState<{ clubId: number; message: string } | null>(null);
  const [version, setVersion] = useState(0);
  const data = snapshot?.clubId === clube?.id ? snapshot : null;
  const error = failure && failure.clubId === clube?.id ? failure.message : '';


  useEffect(() => {
    if (!clube) return;
    const clubId = clube.id;
    let active = true;
    let running = false;
    let controller: AbortController | null = null;

    async function refresh() {
      if (running) return;
      running = true;
      setPending(true);
      const request = new AbortController();
      controller = request;
      const timeout = window.setTimeout(() => request.abort(), 20_000);
      try {
        const [matches, categories] = await Promise.all([
          fetchHomePartidas(hojeCalendario(), request.signal), fetchCategorias(request.signal),
        ]);
        if (!active) return;
        setSnapshot({
          clubId, matches, updatedAt: new Date(),
          categories: [...categories].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })),
        });
        setFailure(null);
      } catch {
        if (active) setFailure({ clubId, message: 'Não conseguimos atualizar a visão geral. Verifique sua conexão e tente novamente.' });
      } finally {
        window.clearTimeout(timeout);
        running = false;
        if (active) setPending(false);
      }
    }

    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 30_000);
    const onVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('ludora:public-matches-changed', onVisibility);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('ludora:public-matches-changed', onVisibility);
    };
  }, [clube?.id, version]);

  const available = data?.categories.filter(item => item.tipo === phase) ?? [];
  const podeGerenciar = Boolean(current && gerenciaCategoria(clube, current));

  function retry() {
    invalidateApiReads();
    setVersion(previous => previous + 1);
  }

  return (
    <div className="dashboard">
      <div className="page-header"><div><h1 className="page-title">Visão geral</h1><p className="page-sub">Resumo do {clube?.nome || 'clube'}{current ? ` · ${current.nome.toUpperCase()}` : ''}</p></div></div>
      {data && <CategoryFilter categories={data.categories} phase={phase} selected={current}
        onPhase={next => setParams({ fase: next }, { replace: true, preventScrollReset: true })}
        onSelect={name => { const next = available.find(item => item.nome === name); if (next) setParams({ categoria_id: String(next.id) }, { replace: true, preventScrollReset: true }); }} />}

      {error && (
        <div className="home-load-error" role="alert">
          <div><strong>{data ? 'Seus dados continuam aqui' : 'A visão geral não carregou'}</strong><p>{error}</p></div>
          <Btn variant="ghost" size="sm" disabled={pending} onClick={retry}>Tentar novamente</Btn>
        </div>
      )}

      {!data ? (!error && <HomeSkeleton manager={!!clube && ['ADMIN', 'TECNICO', 'MESARIO'].includes(clube.meuPapel || '')} />) : !current ? (
        <section className="home-empty"><Icon name="team" size={28} /><h2>Nenhuma categoria nesta fase</h2><p>Selecione outra fase para consultar as equipes do clube.</p></section>
      ) : null}

      {data && current && <HomeCategoryPanel current={current} matches={data.matches} podeGerenciar={podeGerenciar} refreshKey={data.updatedAt.getTime()} />}
    </div>
  );
}
