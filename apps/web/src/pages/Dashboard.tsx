import { memo, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchHomePartidas, fetchCategorias, fetchEscalacao, type HomePartida, type Categoria } from '../services/api';
import { Btn } from '../components/UI';
import { CategoryFilter } from '../components/CategoryFilter';
import { useClubCategory } from '../hooks/useClubCategory';
import { useClubPending } from '../contexts/ClubPendingContext';
import { HomeHistoryTable, HomeMatch, RESULTADOS } from '../components/HomeMatch';
import { ClubBadge } from '../components/Brand';
import { Icon } from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import { teamName } from '../utils/teamIdentity';
import { dataHome, hojeCalendario, resumoCategoria, resultadoPartida } from '../utils/homeDashboard';
import './Dashboard.css';

type Snapshot = { clubId: number; matches: HomePartida[]; categories: Categoria[]; updatedAt: Date };

function HomeSkeleton() {
  return (
    <div className="home-skeleton" role="status" aria-label="Carregando visão geral">
      <div className="home-skeleton-controls home-placeholder" />
      <div className="home-skeleton-grid">
        <div className="home-placeholder home-skeleton-match" />
        <div className="home-placeholder home-skeleton-moment" />
      </div>
      <div className="home-placeholder home-skeleton-history" />
    </div>
  );
}

function HomePending({ category }: { category: Categoria }) {
  const data = useClubPending();
  const { podeGerenciar } = useAuth();
  if (!podeGerenciar) return null;
  const missing = data?.missing?.get(category.id) ?? 0;
  const unassessed = data?.unassessed?.get(category.id) ?? 0;
  const complete = Boolean(data?.missing && data.unassessed);
  const total = missing + unassessed;
  return <section className="home-pending" aria-labelledby="home-pending-title">
    <div className="home-section-heading"><h2 id="home-pending-title">Pendências</h2><span className="home-category-label">{category.nome.toUpperCase()}</span></div>
    <div className="home-pending-card">
      <div className="home-pending-intro">
        <span className="home-pending-symbol"><Icon name={complete && !total ? 'checkAll' : 'alert'} size={24} /></span>
        <div><h3>{!data ? 'Consultando a categoria' : complete && !total ? 'Tudo em dia' : 'Atenção à categoria'}</h3><p>Confira os cadastros e as avaliações dos atletas.</p></div>
      </div>
      {!data ? <p className="home-inline-empty" role="status">Consultando pendências…</p> : <div className="home-pending-items">
        <Link to={`/jogadores?categoria=${category.id}&camisa=missing`}>
          <span className="home-pending-item-icon"><Icon name="shirt" size={21} /></span>
          <span className="home-pending-item-copy"><strong>Numeração do elenco</strong><small>{data.missing === null ? 'Consulta indisponível. Abrir jogadores.' : missing ? 'Jogadores com camisa ainda não definida' : 'Todos os jogadores com camisa definida'}</small></span>
          {missing > 0 && <span className="home-pending-count" aria-label={`${missing} jogadores sem camisa`}>{missing}</span>}
          <Icon name="chevronRight" size={17} />
        </Link>
        <Link to={`/elenco?categoria_id=${category.id}&perfil=pending`}>
          <span className="home-pending-item-icon"><Icon name="radar" size={21} /></span>
          <span className="home-pending-item-copy"><strong>Avaliações dos atletas</strong><small>{data.unassessed === null ? 'Consulta indisponível. Abrir scout.' : unassessed ? 'Atletas que ainda não têm avaliação' : 'Todos os atletas com avaliação disponível'}</small></span>
          {unassessed > 0 && <span className="home-pending-count" aria-label={`${unassessed} atletas não avaliados`}>{unassessed}</span>}
          <Icon name="chevronRight" size={17} />
        </Link>
      </div>}
      <p className="home-pending-note"><Icon name="info" size={16} /><span>{complete && !total ? 'Nenhuma pendência identificada nesta categoria.' : 'Selecione um item para consultar e atualizar os registros.'}</span></p>
    </div>
  </section>;
}

const HomeCategoryPanel = memo(function HomeCategoryPanel({ current, matches, podeGerenciar, starters = null, lineupError = false }: {
  current: Categoria;
  matches: HomePartida[];
  podeGerenciar: boolean;
  starters?: number | null;
  lineupError?: boolean | null;
}) {
  const { principal, aoVivo, historico, totais, seguintes } = useMemo(
    () => resumoCategoria(matches, current.nome, hojeCalendario()),
    [matches, current.nome],
  );
  const preparation = podeGerenciar && principal && !principal.somente_leitura && ['AGENDADA', 'PREPARADA'].includes(principal.status);
  return (
    <div className="home-swipe-content">
      <div className={`home-focus${podeGerenciar ? '' : ' home-focus-public'}`}>
        <section className="home-feature">
          <div className="home-section-heading">
            <h2>{principal?.status === 'AO_VIVO' ? 'Agora em campo' : principal?.data.slice(0, 10) === hojeCalendario() ? 'É dia de jogo' : 'Próxima partida'}</h2>
            {principal?.status === 'AO_VIVO'
              ? <span className="home-live"><i aria-hidden="true" />Ao vivo</span>
              : <span className="home-category-label">{current.nome.toUpperCase()}</span>}
          </div>
          {principal ? <HomeMatch partida={principal} /> : (
            <div className="home-empty"><Icon name="calendar" size={30} /><h3>Seu próximo jogo aparece aqui</h3><p>Ainda não há partidas agendadas para o {current.nome.toUpperCase()}.</p><Link className="btn btn-ghost btn-sm" to="/partidas">{podeGerenciar ? 'Abrir agenda e organizar partida' : 'Ver agenda do clube'}</Link></div>
          )}
          {aoVivo.length > 1 && <div className="home-extra-live">
            {aoVivo.slice(1, 3).map(match => <Link key={match.id} to={`/partidas/${match.id}`}>Também ao vivo: {teamName(match.mandante?.nome ?? '')} × {teamName(match.visitante?.nome ?? '')}<Icon name="chevronRight" size={16} /></Link>)}
          </div>}
          {preparation && principal && (
            <section className="home-preparation">
              <Icon name="player" size={22} />
              <div><h3>{starters === 5 ? 'Escalação pronta para revisar' : 'Prepare sua equipe'}</h3><p>{lineupError ? 'Não foi possível consultar a escalação.' : starters === null ? 'Consultando titulares…' : `${starters} de 5 titulares definidos`}</p></div>
              <Link to={`/partidas/${principal.id}`}>{starters === 5 ? 'Revisar' : 'Preparar'}<Icon name="chevronRight" size={16} /></Link>
            </section>
          )}
        </section>


          <section className="category-moment">
            <div className="home-section-heading"><h2>Momento da categoria</h2></div>
            <p className="home-section-copy">Últimas 5 partidas · selecione para ver detalhes</p>
            {historico.length ? <>
              <div className="moment-results">
                {[...historico].reverse().map((match, index) => (
                  <Link key={match.id} className={`moment-result result-${resultadoPartida(match)}`}
                    to={`/partidas/${match.id}`} title={`${RESULTADOS[resultadoPartida(match)]} · ${match.gols_mandante} a ${match.gols_visitante}`}
                    aria-label={`${RESULTADOS[resultadoPartida(match)]} em ${dataHome(match.data, true)}, ver partida`}>
                    <strong>{resultadoPartida(match)}</strong>
                    <small className={index === historico.length - 1 ? 'is-latest' : ''}>{dataHome(match.data)}</small>
                  </Link>
                ))}
              </div>
              <div className="moment-footer">
                <p><span>{totais.V} vit.</span><i>·</i>{totais.E} emp.<i>·</i><span>{totais.D} der.</span></p>
                <small>Mais recente à direita</small>
              </div>
            </> : <p className="home-inline-empty">Os resultados aparecem após a primeira partida finalizada.</p>}
          </section>

          <section className="home-upcoming">
            <div className="home-section-heading"><h2>Na sequência</h2><Link to={`/partidas?status=PROXIMAS&categoria_id=${current.id}`}>Ver agenda<Icon name="chevronRight" size={15} /></Link></div>
            <p className="home-section-copy">Próximos compromissos do {current.nome.toUpperCase()}</p>
            {seguintes.length ? <div className="home-upcoming-list">
              {[...new Map(seguintes.map(match => [match.data.slice(0, 10), seguintes.filter(item => item.data.slice(0, 10) === match.data.slice(0, 10))])).entries()].map(([day, games]) => <div className="home-upcoming-day" key={day}>
                <h3><Icon name="calendar" size={16} />{day === hojeCalendario() ? 'Hoje · ' : ''}{dataHome(day)}</h3>
                {games.map(match => {
                  const opponent = match.emCasa ? match.visitante : match.mandante;
                  return <Link key={match.id} to={`/partidas/${match.id}`}>
                    <time><Icon name="clock" size={14} />{match.horario || 'A definir'}</time>
                    <ClubBadge src={opponent?.escudo} name={teamName(opponent?.nome || 'Adversário')} size={34} />
                    <span><strong>{teamName(opponent?.nome || 'Adversário')}</strong><small><Icon name={match.emCasa ? 'home' : 'bus'} size={13} />{match.emCasa ? 'Em casa' : 'Fora de casa'}</small></span>
                    <Icon name="chevronRight" size={16} />
                  </Link>;
                })}
              </div>)}
            </div> : <p className="home-inline-empty">Sem outros compromissos marcados para esta categoria.</p>}
          </section>
        {podeGerenciar && <HomePending category={current} />}
      </div>

      <section className="home-history">
        <div className="home-section-heading"><h2>Histórico de partidas</h2><span className="home-category-label">{current.nome.toUpperCase()}</span></div>
        <p className="home-section-copy">Últimos cinco confrontos · mais recente primeiro</p>
        {historico.length ? <HomeHistoryTable partidas={historico} />
          : <div className="home-empty"><Icon name="ball" size={28} /><p>As partidas finalizadas desta categoria aparecerão aqui.</p></div>}
        <Link className="home-history-all" to={`/partidas?status=FINALIZADA&categoria_id=${current.id}`}>Ver histórico completo<Icon name="chevronRight" size={17} /></Link>
      </section>
    </div>
  );
});

export default function DashboardPage() {
  const { clube, podeGerenciar } = useAuth();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [params, setParams] = useSearchParams();
  const { phase, selected: current } = useClubCategory(snapshot && snapshot.clubId === clube?.id ? snapshot.categories : [], params.get('categoria_id'), params.get('fase'));
  const [pending, setPending] = useState(true);
  const [failure, setFailure] = useState<{ clubId: number; message: string } | null>(null);
  const [version, setVersion] = useState(0);
  const [lineup, setLineup] = useState<{ matchId: number; count: number | null; error: boolean } | null>(null);
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
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [clube?.id, version]);

  const available = data?.categories.filter(item => item.tipo === phase) ?? [];
  const summary = useMemo(
    () => resumoCategoria(data?.matches ?? [], current?.nome ?? '', hojeCalendario()),
    [data, current?.nome],
  );
  const { principal } = summary;
  const preparation = podeGerenciar && principal && !principal.somente_leitura && ['AGENDADA', 'PREPARADA'].includes(principal.status);
  const starters = lineup && lineup.matchId === principal?.id ? lineup.count : null;
  const lineupError = lineup && lineup.matchId === principal?.id && lineup.error;

  useEffect(() => {
    let active = true;
    setLineup(null);
    if (!preparation || !principal) return;
    const matchId = principal.id;
    fetchEscalacao(matchId)
      .then(rows => { if (active) setLineup({ matchId, count: rows.filter(row => row.titular).length, error: false }); })
      .catch(() => { if (active) setLineup({ matchId, count: null, error: true }); });
    return () => { active = false; };
  }, [preparation, principal?.id, clube?.id, version]);

  function retry() {
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

      {!data ? (!error && <HomeSkeleton />) : !current ? (
        <section className="home-empty"><Icon name="team" size={28} /><h2>Nenhuma categoria nesta fase</h2><p>Selecione outra fase para consultar as equipes do clube.</p></section>
      ) : null}

      {data && current && <HomeCategoryPanel current={current} matches={data.matches} podeGerenciar={podeGerenciar} starters={starters} lineupError={Boolean(lineupError)} />}
    </div>
  );
}
