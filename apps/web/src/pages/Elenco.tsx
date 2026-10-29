import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchJogadoresPerfis, fetchCategorias, type PerfilJogador, type Categoria } from '../services/api';
import { Btn, Modal, Spinner, Empty } from '../components/UI';
import { ScoutIndexHelp } from '../components/ScoutIndexHelp';
import { POSITIONS, normalizePosition } from '../components/CollectionControls';
import { PositionIcon } from '../components/PositionIcon';
import { ScoutPlayerDetail } from '../components/ScoutPlayerDetail';
import { CategoryFilter } from '../components/CategoryFilter';
import { FilterSelect } from '../components/FilterSelect';
import { useClubCategory } from '../hooks/useClubCategory';
import { CollectionSearch, CollectionFilterButton, CollectionViewToggle, CollectionFilterDialog } from '../components/CollectionToolbar';
import { useAuth } from '../contexts/AuthContext';
import { loadClubProfiles } from '../services/clubProfiles';
import { Icon, type IconName } from '../components/Icon';
import { hasAssessment, nextScoutOrder, profileClass, searchScout, sortScout, SCOUT_PROFILES, SCOUT_ORDERS } from '../utils/scoutPlayers';
import './Partidas.css';
import './Dashboard.css';
import './Elenco.css';
import '../components/ResponsiveControls.css';

const PROFILE_ICONS: Record<string, IconName> = { Artilheiro: 'ball', Armador: 'switchClub', Paredão: 'defense' };

function metricValue(player: PerfilJogador, order: string) {
  if (order === 'rating' || order === 'name') return hasAssessment(player) ? player.nota_geral!.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—';
  const field = { goals: 'totalGols', assists: 'totalAssistencias', saves: 'totalDefesas', games: 'totalPartidas', shirt: 'numCamisa' } as const;
  return player[field[order as keyof typeof field]] ?? '—';
}

export default function ElencoPage() {
  const { clube } = useAuth();
  const [params, setParams] = useSearchParams();
  const [players, setPlayers] = useState<PerfilJogador[]>([]);
  const [tiedLeaders, setTiedLeaders] = useState<{ title: string; players: PerfilJogador[] } | null>(null);
  const [categories, setCategories] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftPosition, setDraftPosition] = useState('');
  const [draftRecords, setDraftRecords] = useState('');
  const [draftAssessment, setDraftAssessment] = useState('');
  const [draftOrder, setDraftOrder] = useState('');
  const [limit, setLimit] = useState(24);
  const [smallScreen, setSmallScreen] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const profileTrack = useRef<HTMLDivElement>(null);
  const requestedCategory = params.get('categoria_id') || '';
  const { phase, selected: category } = useClubCategory(categories, requestedCategory, params.get('fase'));
  const phaseCategories = useMemo(() => categories.filter(category => category.tipo === phase).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })), [categories, phase]);
  const search = params.get('busca') || '';
  const position = params.get('posicao') || '';
  const profile = params.get('perfil') || '';
  const records = params.get('registros') || '';
  const assessment = params.get('avaliacao') || '';
  const explicitOrder = SCOUT_ORDERS.some(item => item.value === params.get('ordem')) ? params.get('ordem')! : null;
  const order = explicitOrder || 'rating';
  const ascending = explicitOrder && ['asc', 'desc'].includes(params.get('direcao') || '')
    ? params.get('direcao') === 'asc' : ['name', 'shirt'].includes(order);
  const list = smallScreen || params.get('visualizacao') === 'lista';
  const selected = players.find(player => String(player.id) === params.get('atleta')) || null;

  function change(values: Record<string, string>, replace = true) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
      return next;
    }, { replace, preventScrollReset: true });
  }
  function openPlayer(player: PerfilJogador) { change({ atleta: String(player.id) }, false); }

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const update = () => setSmallScreen(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setPlayers([]);
    Promise.all([loadClubProfiles(version > 0), fetchCategorias()]).then(([data, cats]) => {
      if (active) { setPlayers(data); setCategories(cats); }
    }).catch(() => {
      if (active) setError('Não foi possível carregar o elenco. Verifique sua conexão e tente novamente.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clube?.id, version]);

  const categoryData = useMemo(() => new Map(phaseCategories.map(item => {
    const categoryPlayers = players.filter(player => player.categoria_id === item.id);
    const matching = categoryPlayers.filter(player => {
    const text = `${player.nome} ${player.numCamisa ?? ''} ${player.posicao}`;
    return (!search.trim() || searchScout(text).includes(searchScout(search)))
      && (!position || normalizePosition(player.posicao) === position)
      && (!records || (records === 'with' ? player.totalPartidas > 0 : player.totalPartidas === 0))
      && (!assessment || hasAssessment(player) === (assessment === 'with'));
    });
    const filtered = sortScout(matching.filter(player => !profile || (profile === 'pending' ? !hasAssessment(player) : hasAssessment(player) && player.perfil_ml === profile)), order, ascending);
    return [item.id, { categoryPlayers, matching, filtered }];
  })), [players, phaseCategories, search, position, records, assessment, profile, order, ascending]);
  const filterKey = [category?.id, search, position, profile, records, assessment, order, ascending].join('|');
  useEffect(() => setLimit(24), [filterKey]);
  useEffect(() => {
    const track = profileTrack.current;
    const active = track?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (track && active) track.scrollTo({ left: Math.max(0, active.offsetLeft - 2), behavior: 'instant' });
  }, [profile, loading, category?.id]);
  function getLeaders(categoryPlayers: PerfilJogador[]) {
    return [
    { title: 'Mais gols', field: 'totalGols', icon: 'ball' },
    { title: 'Assistências', field: 'totalAssistencias', icon: 'handshake' },
    { title: 'Maior índice', field: 'nota_geral', icon: 'radar' },
  ].map(item => {
    const candidates = item.field === 'nota_geral' ? categoryPlayers.filter(hasAssessment) : categoryPlayers;
    const max = Math.max(0, ...candidates.map(player => Number(player[item.field as keyof PerfilJogador]) || 0));
    const tied = candidates.filter(player => Number(player[item.field as keyof PerfilJogador]) === max);
    return { ...item, value: max, player: max > 0 || item.field === 'nota_geral' ? tied[0] || null : null, tied: tied.length, tiedPlayers: tied };
    });
  }
  const chips = [
    { key: 'busca', text: search && `Busca: ${search}` }, { key: 'posicao', text: position },
    { key: 'perfil', text: profile === 'pending' ? 'Não avaliados' : profile },
    { key: 'registros', text: records && (records === 'with' ? 'Com escalações' : 'Sem escalações') },
    { key: 'avaliacao', text: assessment && (assessment === 'with' ? 'Com avaliação' : 'Sem avaliação') },
  ].filter(chip => chip.text);
  const clear = () => change({ busca: '', posicao: '', perfil: '', registros: '', avaliacao: '' });
  const categoryIndex = phaseCategories.indexOf(category!);

  function renderCategory(offset: number) {
    const item = phaseCategories[categoryIndex + offset];
    const data = item && categoryData.get(item.id);
    if (!data || loading || error) return null;
    const { categoryPlayers, matching, filtered } = data;
    const leaders = getLeaders(categoryPlayers);
    const category = item;
    const overviewTitle = `scout-overview-title-${item.id}`;
    return <div className="scout-category-content">
      <section className="scout-overview" aria-labelledby={overviewTitle}><h2 className="sr-only" id={overviewTitle}>Destaques da categoria</h2>
        <div className="scout-leaders">{leaders.map(leader => <button key={leader.field} type="button" disabled={!leader.player} onClick={() => {
          if (leader.tied > 1) setTiedLeaders({ title: leader.title, players: leader.tiedPlayers });
          else if (leader.player) openPlayer(leader.player);
        }} aria-label={leader.player ? `${leader.title}: ${leader.player.nome}, ${leader.value}${leader.tied > 1 ? `, ver ${leader.tied} atletas empatados` : ''}` : `${leader.title}: sem registros`}>
          <span className="scout-leader-icon"><Icon name={leader.icon as IconName} size={19} /></span><span className="scout-leader-title">{leader.title}</span><strong>{leader.player ? leader.value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'}</strong><span className="scout-leader-name">{leader.player?.nome || 'Sem registros'}{leader.player && leader.tied > 1 && <small>+{leader.tied - 1} {leader.tied === 2 ? 'atleta empatado' : 'atletas empatados'} · ver todos</small>}</span>
        </button>)}</div>
      </section>
      <div className="scout-controls">
        <CollectionSearch className="scout-search" id="scout-search" label="Buscar atleta" placeholder="Nome, camisa ou posição" value={search} onChange={value => change({ busca: value })} />
        <CollectionFilterButton label="Mais filtros" onClick={() => { setDraftPosition(position); setDraftRecords(records); setDraftAssessment(assessment); setDraftOrder(explicitOrder || ''); setFiltersOpen(true); }} />
      </div>
      <div data-swipe-ignore ref={offset === 0 ? profileTrack : undefined} className="scout-profile-filters" role="group" aria-label="Perfil de desempenho">{['', ...SCOUT_PROFILES, 'pending'].map(value => {
        const count = matching.filter(player => !value || (value === 'pending' ? !hasAssessment(player) : hasAssessment(player) && player.perfil_ml === value)).length;
        return <button key={value || 'all'} type="button" aria-pressed={profile === value} onClick={() => change({ perfil: value })} className={`scout-profile-filter profile-${value === 'Armador' ? 'playmaker' : value === 'Paredão' ? 'keeper' : 'scorer'}`}>{value === 'pending' ? 'Não avaliados' : value || 'Todos'}<span>{count}</span></button>;
      })}</div>
      {!!chips.length && <div className="scout-active-filters" aria-label="Filtros ativos">{chips.map(chip => <button type="button" key={chip.key} onClick={() => change({ [chip.key]: '' })} aria-label={`Remover filtro ${chip.text}`} title={chip.text}>{chip.text}<Icon name="minus" size={14} /></button>)}<button type="button" onClick={clear}>Limpar tudo</button></div>}
      <ScoutIndexHelp />
      <div className="scout-section-heading scout-athletes-heading">
        <div className="scout-athlete-count"><h2>Atletas</h2><p role="status">{filtered.length} de {categoryPlayers.length} · {category?.nome.toUpperCase()}</p></div>
        {!smallScreen && <CollectionViewToggle className="schedule-view-toggle" label="Visualização do elenco" value={list ? 'lista' : 'cards'} onChange={value => change({ visualizacao: value === 'lista' ? 'lista' : '' })}
          options={[{ value: 'cards', label: 'Cards', icon: 'grid' }, { value: 'lista', label: 'Lista', icon: 'list' }]} />}
      </div>
      <div data-swipe-ignore className="scout-order-tabs" role="group" aria-label="Ordenar atletas">
        <span className="scout-order-label">↕ Ordenar por</span>
        {SCOUT_ORDERS.map(item => {
          const selected = order === item.value;
          const direction = !explicitOrder ? 'padrão' : ascending ? 'crescente' : 'decrescente';
          return <button type="button" key={item.value} aria-pressed={selected}
            aria-label={`${item.label}${selected ? `, ${direction}` : ''}`}
            onClick={() => change(nextScoutOrder(explicitOrder, item.value, ascending))}>
            {item.label}
            {selected && explicitOrder && <span aria-hidden="true">{ascending ? ' ↑' : ' ↓'}</span>}
          </button>;
        })}
      </div>
      <p className="scout-data-note">Totais acumulados · índice calculado com os registros disponíveis.</p>
      {!filtered.length ? <div className="scout-empty"><Empty icon="👥" message={categoryPlayers.length ? 'Nenhum atleta corresponde aos filtros.' : 'Nenhum atleta cadastrado nesta categoria.'} />{!!chips.length && <Btn variant="ghost" onClick={clear}>Limpar filtros</Btn>}</div> : <>
        {list && <div className="scout-list-head" aria-hidden="true"><span>Atleta · Índice</span><span>Perfil · Escalações · Gols · Assistências / Defesas</span></div>}
        <div className={`scout-players${list ? ' scout-players-list' : ''}`}>{filtered.slice(0, offset === 0 ? limit : 24).map(player => {
          const assessed = hasAssessment(player);
          const keeper = normalizePosition(player.posicao) === 'Goleiro';
          return <article key={player.id} className={`scout-player scout-tone-${profileClass(player)}`} onClick={event => {
            if (!(event.target as Element).closest('button, a')) openPlayer(player);
          }}>
            <button className="scout-player-main" type="button" onClick={() => openPlayer(player)} aria-label={`Ver ficha de ${player.nome}`}>
              <span className="scout-shirt">{player.numCamisa != null ? `#${player.numCamisa}` : '—'}</span><span className="scout-player-identity"><strong>{player.nome}</strong><span className="position-inline"><PositionIcon position={player.posicao}/>{normalizePosition(player.posicao) || 'Posição não informada'}{player.idade != null ? ` · ${player.idade} anos` : ''}</span></span>
              <span className="scout-rating"><span>{order === 'name' ? 'Índice' : SCOUT_ORDERS.find(item => item.value === order)?.label || 'Índice'}</span><strong>{metricValue(player, order)}</strong></span><Icon name="chevronRight" size={18} />
            </button>
            <div className="scout-player-bottom"><span className="scout-profile-label">{assessed ? player.perfil_ml : 'Não avaliado'}</span><dl className="scout-player-metrics"><div><dt>Escalações</dt><dd>{player.totalPartidas}</dd></div><div><dt>Gols</dt><dd>{player.totalGols}</dd></div><div><dt>{keeper ? 'Defesas' : 'Assistências'}</dt><dd>{keeper ? player.totalDefesas : player.totalAssistencias}</dd></div></dl></div>
          </article>;
        })}</div>
        {filtered.length > limit && <Btn className="scout-show-more" variant="ghost" onClick={() => setLimit(value => value + 24)}>Mostrar mais atletas ({filtered.length - limit})</Btn>}
      </>}
    </div>;
  }

  return <div className="scout-page">
    <div className="page-header"><div><span className="scout-eyebrow">ANÁLISE DO ELENCO</span><h1 className="page-title">Scout dos jogadores</h1><p className="page-sub">Compare os registros e acompanhe os atletas de cada categoria.</p></div></div>
      <CategoryFilter categories={phaseCategories} phase={phase} selected={category}
        label="Subcategoria do scout"
        hint="Deslize o conteúdo para trocar o sub ou use as setas do teclado."
        onPhase={value => change({ fase: value, categoria_id: '', atleta: '' })}
        onSelect={name => {
          const next = phaseCategories.find(item => item.nome === name);
          if (next) change({ categoria_id: String(next.id), atleta: '' });
        }} />
      {loading ? <div className="scout-loading" role="status" aria-label="Carregando elenco">{[1, 2, 3, 4, 5, 6].map(id => <div className="scout-skeleton" key={id} />)}</div> : error ? <div role="alert" className="notice-error"><p>{error}</p><Btn variant="ghost" onClick={() => setVersion(value => value + 1)}>Tentar novamente</Btn></div> : null}
      {!loading && !error && renderCategory(0)}
    <CollectionFilterDialog open={filtersOpen} title="Filtrar elenco" className="scout-filter-dialog" onClose={() => setFiltersOpen(false)}
      onClear={() => { setDraftPosition(''); setDraftRecords(''); setDraftAssessment(''); setDraftOrder(''); }}
      onApply={() => {
        change({
          posicao: draftPosition, registros: draftRecords, avaliacao: draftAssessment, ordem: draftOrder,
          direcao: !draftOrder ? '' : draftOrder === explicitOrder
            ? ascending ? 'asc' : 'desc' : ['name', 'shirt'].includes(draftOrder) ? 'asc' : 'desc',
        });
        setFiltersOpen(false);
      }}>
      <fieldset className="scout-filter-options"><legend>Posição</legend>{['', ...POSITIONS].map(value => <button type="button" key={value} aria-pressed={draftPosition === value} onClick={() => setDraftPosition(value)}>{value || 'Todas'}</button>)}</fieldset>
      <fieldset className="scout-filter-options"><legend>Participação</legend>{[{ value: '', label: 'Todos' }, { value: 'with', label: 'Com escalações' }, { value: 'without', label: 'Sem escalações' }].map(item => <button type="button" key={item.value} aria-pressed={draftRecords === item.value} onClick={() => setDraftRecords(item.value)}>{item.label}</button>)}</fieldset>
      <fieldset className="scout-filter-options"><legend>Avaliação</legend>{[{ value: '', label: 'Todos' }, { value: 'with', label: 'Com avaliação' }, { value: 'without', label: 'Não avaliados' }].map(item => <button type="button" key={item.value} aria-pressed={draftAssessment === item.value} onClick={() => setDraftAssessment(item.value)}>{item.label}</button>)}</fieldset>
      <FilterSelect label="Ordenar por" emptyLabel="Padrão (índice)" options={SCOUT_ORDERS} value={draftOrder} onChange={setDraftOrder} inlineOptions />
    </CollectionFilterDialog>
    <Modal open={!!tiedLeaders} title={tiedLeaders ? `${tiedLeaders.title} · atletas empatados` : 'Atletas empatados'} onClose={() => setTiedLeaders(null)}>
      <p className="scout-help">Atletas com o mesmo resultado nesta categoria. Selecione um para ver sua ficha.</p>
      <div className="scout-tied-list">{tiedLeaders?.players.map(player => <button key={player.id} type="button" onClick={() => { setTiedLeaders(null); openPlayer(player); }}><span>{player.nome}</span><Icon name="chevronRight" size={17}/></button>)}</div>
    </Modal>
    {selected && !loading && <ScoutPlayerDetail key={`${clube?.id}-${selected.id}`} player={selected} category={categories.find(item => item.id === selected.categoria_id)?.nome.toUpperCase() || 'Sem categoria'} onClose={() => change({ atleta: '' })} />}
  </div>;
}
