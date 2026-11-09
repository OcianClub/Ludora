import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cachedJson, cachedClubProfiles, fetchCategorias, type PerfilJogador, type Categoria } from '../services/api';
import { Btn, Modal } from '../components/UI';
import { ScoutIndexHelp } from '../components/ScoutIndexHelp';
import { ScoutSkeleton } from '../components/PageSkeleton';
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
import { hasAssessment, nextScoutOrder, profileClass, searchScout, sortScout, scoutOrderStartsAscending, SCOUT_PROFILES, SCOUT_ORDERS, SCOUT_TABLE_COLUMNS } from '../utils/scoutPlayers';
import './Partidas.css';
import './Dashboard.css';
import './Elenco.css';
import '../components/ResponsiveControls.css';
import './ScoutCollection.css';

function metricValue(player: PerfilJogador, order: string) {
  if (['rating', 'name', 'position', 'age', 'profile'].includes(order)) return player.totalPartidas;
  const field = { goals: 'totalGols', assists: 'totalAssistencias', saves: 'totalDefesas', games: 'totalPartidas', shirt: 'numCamisa' } as const;
  return player[field[order as keyof typeof field]] ?? '—';
}

export default function ElencoPage() {
  const { clube } = useAuth();
  const [params, setParams] = useSearchParams();
  const [players, setPlayers] = useState<PerfilJogador[]>(() => cachedClubProfiles() || []);
  const [tiedLeaders, setTiedLeaders] = useState<{ title: string; players: PerfilJogador[] } | null>(null);
  const [categories, setCategories] = useState<Categoria[]>(() => cachedJson<Categoria[]>('/categorias') || []);
  const [loading, setLoading] = useState(() => !cachedClubProfiles() || !cachedJson('/categorias'));
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftPosition, setDraftPosition] = useState('');
  const [draftRecords, setDraftRecords] = useState('');
  const [draftProfile, setDraftProfile] = useState('');
  const [draftOrder, setDraftOrder] = useState('');
  const [limit, setLimit] = useState(20);
  const [smallScreen, setSmallScreen] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const requestedCategory = params.get('categoria_id') || '';
  const { phase, selected: category } = useClubCategory(categories, requestedCategory, params.get('fase'));
  const phaseCategories = useMemo(() => categories.filter(category => category.tipo === phase).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })), [categories, phase]);
  const search = params.get('busca') || '';
  const position = params.get('posicao') || '';
  const profile = params.get('perfil') || '';
  const records = params.get('registros') || '';
  const assessment = params.get('avaliacao') || '';
  const explicitOrder = SCOUT_TABLE_COLUMNS.some(item => item.value === params.get('ordem')) ? params.get('ordem')! : null;
  const order = explicitOrder || 'rating';
  const ascending = explicitOrder && ['asc', 'desc'].includes(params.get('direcao') || '')
    ? params.get('direcao') === 'asc' : scoutOrderStartsAscending(order);
  const table = !smallScreen && params.get('visualizacao') !== 'cards';
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
    const controller = new AbortController();
    setLoading(!cachedClubProfiles() || !cachedJson('/categorias'));
    setError('');
    Promise.all([loadClubProfiles(version > 0, controller.signal), fetchCategorias(controller.signal)]).then(([data, cats]) => {
      if (active) { setPlayers(data); setCategories(cats); }
    }).catch(failure => {
      if (active) setError(failure instanceof Error ? failure.message : 'Não foi possível carregar o elenco. Verifique sua conexão e tente novamente.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
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
  useEffect(() => setLimit(20), [filterKey]);
  function getLeaders(categoryPlayers: PerfilJogador[]) {
    return [
    { title: 'Mais gols', field: 'totalGols', icon: 'ball' },
    { title: 'Assistências', field: 'totalAssistencias', icon: 'handshake' },
    { title: 'Convocações', field: 'totalPartidas', icon: 'team' },
  ].map(item => {
    const candidates = categoryPlayers;
    const max = Math.max(0, ...candidates.map(player => Number(player[item.field as keyof PerfilJogador]) || 0));
    const tied = candidates.filter(player => Number(player[item.field as keyof PerfilJogador]) === max);
    return { ...item, value: max, player: max > 0 ? tied[0] || null : null, tied: tied.length, tiedPlayers: tied };
    });
  }
  const chips = [
    { key: 'busca', text: search && `Busca: ${search}` }, { key: 'posicao', text: position },
    { key: 'perfil', text: profile === 'pending' ? 'Sem perfil' : profile },
    { key: 'registros', text: records && (records === 'with' ? 'Com escalações' : 'Sem escalações') },
    { key: 'avaliacao', text: assessment && (assessment === 'with' ? 'Com perfil' : 'Sem perfil') },
  ].filter(chip => chip.text);
  const clear = () => change({ busca: '', posicao: '', perfil: '', registros: '', avaliacao: '' });
  const categoryIndex = phaseCategories.indexOf(category!);

  function renderCategory(offset: number) {
    const item = phaseCategories[categoryIndex + offset];
    const data = item && categoryData.get(item.id);
    if (!data || (loading && !players.length)) return null;
    const { categoryPlayers, filtered } = data;
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
        <CollectionFilterButton label="Mais filtros" count={[position, records, assessment || profile].filter(Boolean).length} onClick={() => { setDraftPosition(position); setDraftRecords(records); setDraftProfile(profile === 'pending' ? 'without' : profile || assessment); setDraftOrder(explicitOrder || ''); setFiltersOpen(true); }} />
        {!smallScreen && <CollectionViewToggle label="Visualização do elenco" value={table ? 'tabela' : 'cards'} onChange={value => change({ visualizacao: value === 'cards' ? 'cards' : '' })}
          options={[{ value: 'tabela', label: 'Tabela', icon: 'list' }, { value: 'cards', label: 'Cards', icon: 'grid' }]} />}
      </div>
      {!!chips.length && <div className="scout-active-filters" aria-label="Filtros ativos">{chips.map(chip => <button type="button" key={chip.key} onClick={() => change({ [chip.key]: '' })} aria-label={`Remover filtro ${chip.text}`}>{chip.text}<Icon name="minus" size={14} /></button>)}<button type="button" onClick={clear}>Limpar tudo</button></div>}
      <div className="scout-section-heading scout-athletes-heading">
        <div className="scout-athlete-count" role="status"><h2>{filtered.length} atletas</h2><p>{filtered.length !== categoryPlayers.length && `de ${categoryPlayers.length} · `}{category?.nome.toUpperCase()}</p></div>
        <ScoutIndexHelp label="Como ler o Scout" />
      </div>
      {smallScreen && <div data-swipe-ignore className="scout-order-tabs" role="group" aria-label="Ordenar atletas">
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
      </div>}
      {!filtered.length ? <div className="scout-empty" role="status"><Icon name="team" size={28} /><p>{categoryPlayers.length ? 'Nenhum atleta corresponde aos filtros.' : 'Nenhum atleta cadastrado nesta categoria.'}</p>{!!chips.length && <Btn variant="ghost" onClick={clear}>Limpar filtros</Btn>}</div> : <>
        {table ? <div className="scout-table-scroll" role="region" aria-label="Tabela de atletas" tabIndex={0} data-swipe-ignore>
          <table className="scout-table">
            <caption className="sr-only">Atletas de {category.nome.toUpperCase()}. Registros de partidas finalizadas. Clique nos títulos para alternar a ordenação.</caption>
            <colgroup>{SCOUT_TABLE_COLUMNS.map(column => <col key={column.value} className={`scout-col-${column.value}`}/>)}</colgroup>
            <thead><tr>{SCOUT_TABLE_COLUMNS.map(column => <th key={column.value} scope="col" aria-sort={explicitOrder === column.value ? ascending ? 'ascending' : 'descending' : 'none'}>
              <button type="button" onClick={() => change(nextScoutOrder(explicitOrder, column.value, ascending))}>
                {column.label}<span aria-hidden="true" className={`scout-sort-indicator${explicitOrder === column.value ? ascending ? ' is-ascending' : ' is-descending' : ''}`}><i/><i/></span>
              </button>
            </th>)}</tr></thead>
            <tbody>{filtered.slice(0, limit).map(player => <tr key={player.id} className={`scout-tone-${profileClass(player)}`} onClick={event => { if (!(event.target as Element).closest('button, a')) openPlayer(player); }}>
              <td className="scout-table-shirt">{player.numCamisa != null ? String(player.numCamisa).padStart(2, '0') : '—'}</td>
              <th scope="row"><button className="scout-table-name" onClick={() => openPlayer(player)} type="button" aria-label={`Ver ficha de ${player.nome}`}><span data-tooltip={player.nome} data-tooltip-overflow>{player.nome}</span></button></th>
              <td><span className="scout-table-position"><PositionIcon decorative tooltip={false} position={player.posicao}/><span>{normalizePosition(player.posicao) || '—'}</span></span></td>
              <td>{player.idade != null ? `${player.idade} anos` : '—'}</td>
              <td className="scout-table-number">{player.totalPartidas}</td><td className="scout-table-number">{player.totalGols}</td><td className="scout-table-number">{player.totalAssistencias}</td><td className="scout-table-number">{player.totalDefesas}</td>
              <td><span className="scout-table-profile">{hasAssessment(player) ? player.perfil_ml : 'Sem perfil'}</span></td>
            </tr>)}</tbody>
          </table>
        </div> : <div className={`scout-players${smallScreen ? ' scout-players-compact' : ''}`}>{filtered.slice(0, offset === 0 ? limit : 20).map(player => {
          const assessed = hasAssessment(player);
          const keeper = normalizePosition(player.posicao) === 'Goleiro';
          if (smallScreen) return <article key={player.id} className={`scout-player scout-tone-${profileClass(player)}`}>
            <button type="button" className="scout-mobile-player" onClick={() => openPlayer(player)} aria-label={`Ver ficha de ${player.nome}`}>
              <span className="scout-mobile-shirt">{player.numCamisa != null ? String(player.numCamisa).padStart(2, '0') : '—'}</span>
              <span className="scout-mobile-identity"><strong>{player.nome}</strong><span><PositionIcon decorative tooltip={false} position={player.posicao}/>{normalizePosition(player.posicao) || 'Sem posição'}</span></span>
              <span className="scout-mobile-metrics">{[{ label: 'Convocações', short: 'CONV', value: player.totalPartidas }, { label: 'Gols', short: 'GOL', value: player.totalGols }, { label: keeper ? 'Defesas' : 'Assistências', short: keeper ? 'DEF' : 'AST', value: keeper ? player.totalDefesas : player.totalAssistencias }].map(metric => <span key={metric.label} aria-label={`${metric.value} ${metric.label}`}><b>{metric.value}</b><small>{metric.short}</small></span>)}</span>
            </button>
          </article>;
          return <article key={player.id} className={`scout-player scout-tone-${profileClass(player)}`} onClick={event => {
            if (!(event.target as Element).closest('button, a')) openPlayer(player);
          }}>
            <button className="scout-player-main" type="button" onClick={() => openPlayer(player)} aria-label={`Ver ficha de ${player.nome}`}>
              <span className="scout-shirt">{player.numCamisa != null ? `#${player.numCamisa}` : '—'}</span><span className="scout-player-identity"><strong data-tooltip={player.nome} data-tooltip-overflow>{player.nome}</strong><span className="position-inline"><PositionIcon decorative tooltip={false} position={player.posicao}/>{normalizePosition(player.posicao) || 'Posição não informada'}{player.idade != null ? ` · ${player.idade} anos` : ''}</span></span>
              <span className="scout-rating"><span>{order === 'name' ? 'Convocações' : SCOUT_ORDERS.find(item => item.value === order)?.label || 'Convocações'}</span><strong>{metricValue(player, order)}</strong></span><Icon name="chevronRight" size={18} />
            </button>
            <div className="scout-player-bottom"><span className="scout-profile-label">{assessed ? player.perfil_ml : 'Sem perfil'}</span><dl className="scout-player-metrics"><div><dt>Convocações</dt><dd>{player.totalPartidas}</dd></div><div><dt>Gols</dt><dd>{player.totalGols}</dd></div><div><dt>{keeper ? 'Defesas' : 'Assistências'}</dt><dd>{keeper ? player.totalDefesas : player.totalAssistencias}</dd></div></dl></div>
          </article>;
        })}</div>}
        {filtered.length > limit && <Btn className="scout-show-more" variant="ghost" onClick={() => setLimit(value => value + 20)}>Carregar mais atletas ({filtered.length - limit})</Btn>}
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
      {loading && !players.length ? <ScoutSkeleton/> : null}
      {error && <div role="alert" className="notice-error"><p>{error}</p><Btn variant="ghost" onClick={() => setVersion(value => value + 1)}>Tentar novamente</Btn></div>}
      {(!loading || players.length > 0) && renderCategory(0)}
    <CollectionFilterDialog open={filtersOpen} title="Filtrar elenco" className="scout-filter-dialog" onClose={() => setFiltersOpen(false)}
      onClear={() => { setDraftPosition(''); setDraftRecords(''); setDraftProfile(''); setDraftOrder(''); }}
      onApply={() => {
        change({
          posicao: draftPosition, registros: draftRecords,
          avaliacao: ['with', 'without'].includes(draftProfile) ? draftProfile : '',
          perfil: ['with', 'without'].includes(draftProfile) ? '' : draftProfile, ordem: draftOrder,
          direcao: !draftOrder ? '' : draftOrder === explicitOrder
            ? ascending ? 'asc' : 'desc' : scoutOrderStartsAscending(draftOrder) ? 'asc' : 'desc',
        });
        setFiltersOpen(false);
      }}>
      <fieldset className="scout-filter-options"><legend>Posição</legend>{['', ...POSITIONS].map(value => <button type="button" key={value} aria-pressed={draftPosition === value} onClick={() => setDraftPosition(value)}>{value || 'Todas'}</button>)}</fieldset>
      <fieldset className="scout-filter-options"><legend>Participação</legend>{[{ value: '', label: 'Todos' }, { value: 'with', label: 'Com escalações' }, { value: 'without', label: 'Sem escalações' }].map(item => <button type="button" key={item.value} aria-pressed={draftRecords === item.value} onClick={() => setDraftRecords(item.value)}>{item.label}</button>)}</fieldset>
      <fieldset className="scout-filter-options"><legend>Perfil de registros</legend>{[{ value: '', label: 'Todos' }, ...SCOUT_PROFILES.map(value => ({ value, label: value })), { value: 'with', label: 'Com perfil' }, { value: 'without', label: 'Sem perfil' }].map(item => <button type="button" key={item.value} aria-pressed={draftProfile === item.value} onClick={() => setDraftProfile(item.value)}>{item.label}</button>)}</fieldset>
      <FilterSelect label="Ordenar por" emptyLabel="Padrão (convocações)" options={SCOUT_TABLE_COLUMNS} value={draftOrder} onChange={setDraftOrder} inlineOptions />
    </CollectionFilterDialog>
    <Modal open={!!tiedLeaders} title={tiedLeaders ? `${tiedLeaders.title} · atletas empatados` : 'Atletas empatados'} onClose={() => setTiedLeaders(null)}>
      <p className="scout-help">Atletas com o mesmo resultado nesta categoria. Selecione um para ver sua ficha.</p>
      <div className="scout-tied-list">{tiedLeaders?.players.map(player => <button key={player.id} type="button" onClick={() => { setTiedLeaders(null); openPlayer(player); }}><span>{player.nome}</span><Icon name="chevronRight" size={17}/></button>)}</div>
    </Modal>
    {selected && !loading && <ScoutPlayerDetail key={`${clube?.id}-${selected.id}`} player={selected} category={categories.find(item => item.id === selected.categoria_id)?.nome.toUpperCase() || 'Sem categoria'} initialFilter={{ partida_id: Number(params.get('partida_id')) || undefined, competicao_id: Number(params.get('competicao_id')) || undefined }} onClose={() => change({ atleta: '', partida_id: '', competicao_id: '' })} />}
  </div>;
}
