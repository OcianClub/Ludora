import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchPartidas, criarPartida, fetchTimes, fetchCategorias, fetchCompeticoes, type Partida, type Time, type Categoria, type Competicao } from '../services/api';
import { Btn, Modal, Input, Spinner, Empty } from '../components/UI';
import { ClubBadge } from '../components/Brand';
import { useAuth } from '../contexts/AuthContext';
import { MatchCard, formatMatchDate } from '../components/MatchCard';
import { Icon } from '../components/Icon';
import { BlockColumns } from '../components/BlockColumns';
import { FilterSelect } from '../components/FilterSelect';
import { LiveMatchesCarousel } from '../components/LiveMatchesCarousel';
import { SchedulePeriodDialog } from '../components/SchedulePeriodDialog';
import { intervaloAgenda, grupoSituacao, ordenarAgenda, rotuloDiaAgenda, agruparAgenda, type PeriodoAgenda } from '../utils/scheduleFilters';
import { teamName } from '../utils/teamIdentity';
import './Partidas.css';
import './ScheduleCreate.css';

const STATUSES = [
  { value: 'PROXIMAS', label: 'Próximas (agendadas e preparadas)' },
  { value: 'AGENDADA', label: 'Agendada' },
  { value: 'PREPARADA', label: 'Preparada' },
  { value: 'AO_VIVO', label: 'Ao vivo' },
  { value: 'FINALIZADA', label: 'Finalizada' },
  { value: 'CANCELADA', label: 'Cancelada' },
];
const LEGEND = [
  { id: 'live', value: 'AO_VIVO', label: 'Ao vivo', icon: 'live' },
  { id: 'next', value: 'PROXIMAS', label: 'Próximas', icon: 'clock' },
  { id: 'past', value: 'FINALIZADA', label: 'Finalizadas', icon: 'checkAll' },
  { id: 'cancelled', value: 'CANCELADA', label: 'Canceladas', icon: 'minus' },
] as const;
const PERIODS = [
  { value: 'all', label: 'Todos' },
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
] as const;
const FORM_VAZIO = { mandante_id: '', visitante_id: '', data: '', horario: '', local: '', categoria_id: '', competicao_id: '', rodada: '', emCasa: 'true' };
const normalizarBusca = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

function FilterChoices({ label, value, options, onChange, className = '' }: {
  label: string;
  value: string;
  options: { value: string; label: string; icon?: 'live' | 'clock' | 'checkAll' | 'minus' | 'home' | 'bus' | 'calendar' }[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return <fieldset className={`schedule-choice-group ${className}`}>
    <legend>{label}</legend>
    <div>
      {options.map(option => <button type="button" key={option.value || 'all'} aria-pressed={value === option.value}
        onClick={() => onChange(option.value)}>
        {option.icon && <Icon name={option.icon} size={15} />}{option.label}
      </button>)}
    </div>
  </fieldset>;
}

function ScheduleSection({ title, description, matches, initialOpen, renderMatch, list, groupDays = false }: {
  title: string;
  description: string;
  matches: Partida[];
  initialOpen: boolean;
  renderMatch: (partida: Partida) => ReactNode;
  list: boolean;
  groupDays?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [limit, setLimit] = useState(12);
  const id = useId();
  if (!matches.length) return null;
  const visible = matches.slice(0, limit);
  const days = new Map<string, Partida[]>();
  visible.forEach(match => {
    const day = match.data.slice(0, 10);
    if (!days.has(day)) days.set(day, []);
    days.get(day)!.push(match);
  });
  return (
    <section className={`schedule-section${list ? ' schedule-list' : ''}`}>
      <h2>
        <button type="button" className="schedule-section-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
          <span className="schedule-section-copy"><strong><Icon name="calendar" size={19} /><span className="schedule-section-title">{title}</span><span className="schedule-section-count">{matches.length}</span></strong><small>{description}</small></span>
          <span className="schedule-section-affordance"><span>{open ? 'Recolher' : 'Expandir'}</span><span className="schedule-section-chevron"><Icon name="chevronRight" size={18} /></span></span>
        </button>
      </h2>
      <div id={id} hidden={!open}>
        {open && <>
          {groupDays ? [...days].map(([day, games]) => <div className="schedule-history-day" key={day}>
            <h3>{rotuloDiaAgenda(day)}</h3><BlockColumns list={list}>{games.map(renderMatch)}</BlockColumns>
          </div>) : <BlockColumns list={list}>{visible.map(renderMatch)}</BlockColumns>}
          {matches.length > limit && <Btn variant="ghost" className="schedule-show-more" onClick={() => setLimit(value => value + 12)}>Mostrar mais partidas ({matches.length - limit})</Btn>}
        </>}
      </div>
    </section>
  );
}

export default function PartidasPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { podeGerenciar, clube } = useAuth();
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [times, setTimes] = useState<Time[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [competicoes, setCompeticoes] = useState<Competicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [picker, setPicker] = useState<'categoria' | 'competicao' | 'mandante' | 'visitante' | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const savingRef = useRef(false);
  const [erro, setErro] = useState('');
  const [loadError, setLoadError] = useState('');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
  const [draftMando, setDraftMando] = useState('');
  const [mobileFilters, setMobileFilters] = useState(false);
  const [draftSearch, setDraftSearch] = useState('');
  const [draftCategory, setDraftCategory] = useState('');
  const [draftPeriod, setDraftPeriod] = useState('');
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [draftSort, setDraftSort] = useState('');
  const [filterError, setFilterError] = useState('');
  const loadVersion = useRef(0);
  const filtroStatus = STATUSES.some(item => item.value === searchParams.get('status')) ? searchParams.get('status')! : '';
  const filtroCategoria = searchParams.get('categoria_id') || '';
  const selectedCategory = categorias.find(category => String(category.id) === filtroCategoria);
  const phase = selectedCategory?.tipo || (searchParams.get('fase') === 'BASE' ? 'BASE' : 'INICIACAO');
  const opponent = searchParams.get('busca') || '';
  const mando = searchParams.get('mando') || '';
  const period = ['today', 'week', 'month', 'custom'].includes(searchParams.get('periodo') || '') ? searchParams.get('periodo') as PeriodoAgenda : 'all';
  const start = searchParams.get('de') || '';
  const end = searchParams.get('ate') || '';
  const list = searchParams.get('visualizacao') === 'lista';
  const sortCategory = searchParams.get('ordem') === 'categoria';
  const range = intervaloAgenda(period, start, end);

  function changeFilters(changes: Record<string, string>) {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
      return next;
    }, { replace: true, preventScrollReset: true });
  }

  function openFilters(mobile = false) {
    setMobileFilters(mobile);
    setDraftStatus(filtroStatus);
    setDraftMando(mando);
    setDraftSearch(opponent);
    setDraftCategory(filtroCategoria || phase);
    setDraftPeriod(period === 'all' ? '' : period);
    setDraftStart(range.inicio);
    setDraftEnd(range.fim);
    setDraftSort(sortCategory ? 'categoria' : '');
    setFilterError('');
    setMoreOpen(true);
  }

  function applyFilters() {
    if (mobileFilters && draftPeriod === 'custom' && (!draftStart || !draftEnd || draftStart > draftEnd)) {
      setFilterError('Informe as duas datas. A data final deve ser igual ou posterior à inicial.');
      return;
    }
    changeFilters({ status: draftStatus, mando: draftMando, ...(mobileFilters ? {
      busca: draftSearch, categoria_id: /^\d+$/.test(draftCategory) ? draftCategory : '',
      fase: ['BASE', 'INICIACAO'].includes(draftCategory) ? draftCategory : '',
      periodo: draftPeriod, de: draftPeriod === 'custom' ? draftStart : '',
      ate: draftPeriod === 'custom' ? draftEnd : '', ordem: draftSort,
    } : {}) });
    setMoreOpen(false);
  }

  function resetDraft() {
    setDraftSearch('');
    setDraftCategory('INICIACAO');
    setDraftPeriod('');
    setDraftStart('');
    setDraftEnd('');
    setDraftStatus('');
    setDraftMando('');
    setDraftSort('');
    setFilterError('');
  }

  useEffect(() => {
    if (!moreOpen || !mobileFilters || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const update = () => document.documentElement.style.setProperty('--schedule-viewport-height', `${viewport.height}px`);
    update();
    viewport.addEventListener('resize', update);
    return () => {
      viewport.removeEventListener('resize', update);
      document.documentElement.style.removeProperty('--schedule-viewport-height');
    };
  }, [moreOpen, mobileFilters]);

  useEffect(() => {
    if (!modal || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const update = () => {
      document.documentElement.style.setProperty('--schedule-create-height', `${viewport.height}px`);
      document.documentElement.style.setProperty('--schedule-create-top', `${viewport.offsetTop}px`);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      document.documentElement.style.removeProperty('--schedule-create-height');
      document.documentElement.style.removeProperty('--schedule-create-top');
    };
  }, [modal]);

  useEffect(() => {
    if (searchParams.has('local')) changeFilters({ local: '' });
  }, [searchParams]);

  function carregar() {
    const version = ++loadVersion.current;
    setLoadError('');
    setLoading(true);
    Promise.all([fetchPartidas(), fetchTimes(), fetchCategorias(), fetchCompeticoes()])
      .then(([p, t, c, comp]) => {
        if (version !== loadVersion.current) return;
        setPartidas(p); setTimes(t); setCategorias(c); setCompeticoes(comp);
      })
      .catch(() => { if (version === loadVersion.current) setLoadError('Não foi possível carregar as partidas. Tente novamente.'); })
      .finally(() => { if (version === loadVersion.current) setLoading(false); });
  }
  useEffect(() => {
    carregar();
    return () => { loadVersion.current++; };
  }, [clube?.id]);

  function validarPartida() {
    if (!form.categoria_id) return 'Selecione a categoria da partida.';
    if (!categorias.some(category => String(category.id) === form.categoria_id)) return 'Esta categoria não está mais disponível. Selecione outra categoria.';
    if (!form.mandante_id || !form.visitante_id) return 'Selecione os dois times do confronto.';
    if (form.mandante_id === form.visitante_id) return 'Mandante e visitante precisam ser times diferentes.';
    if ([form.mandante_id, form.visitante_id].some(id => !times.some(team => String(team.id) === id && String(team.categoria_id) === form.categoria_id))) return 'Os dois times precisam pertencer à categoria selecionada. Escolha os times novamente.';
    if (!form.data) return 'Informe a data da partida.';
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(form.data);
    if (!dateMatch) return 'Use uma data válida no formato DD/MM/AAAA.';
    const [year, month, day] = dateMatch.slice(1).map(Number);
    const parsedDate = new Date(year, month - 1, day);
    if (parsedDate.getFullYear() !== year || parsedDate.getMonth() !== month - 1 || parsedDate.getDate() !== day) return 'A data informada não existe. Confira dia, mês e ano.';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (parsedDate < today) return 'Escolha hoje ou uma data futura para organizar a partida.';
    if (!form.horario) return 'Informe o horário da partida.';
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(form.horario);
    if (!timeMatch || Number(timeMatch[1]) > 23 || Number(timeMatch[2]) > 59) return 'Informe um horário válido entre 00:00 e 23:59.';
    if (form.competicao_id && form.competicao_id !== 'amistoso' && !competicoes.some(item => String(item.id) === form.competicao_id && item.tipo === categorias.find(category => String(category.id) === form.categoria_id)?.tipo)) return 'Escolha uma competição compatível com a categoria da partida.';
    if (form.competicao_id && form.competicao_id !== 'amistoso' && form.rodada && (!Number.isSafeInteger(Number(form.rodada)) || Number(form.rodada) < 1)) return 'Informe uma rodada inteira a partir de 1 ou deixe o campo vazio.';
    return '';
  }

  function revisarPartida(event: React.FormEvent) {
    event.preventDefault();
    const validation = validarPartida();
    setErro(validation);
    if (!validation) setReviewOpen(true);
    else requestAnimationFrame(() => document.querySelector<HTMLElement>('.schedule-create-dialog [aria-invalid="true"], .schedule-create-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }

  async function salvar() {
    if (savingRef.current) return;
    const validation = validarPartida();
    if (validation) { setErro(validation); setReviewOpen(false); return; }
    savingRef.current = true;
    setErro(''); setSalvando(true);
    try {
      await criarPartida({
        mandante_id: Number(form.mandante_id), visitante_id: Number(form.visitante_id),
        data: form.data, horario: form.horario, local: form.local.trim() || undefined,
        categoria_id: Number(form.categoria_id),
        competicao_id: form.competicao_id && form.competicao_id !== 'amistoso' ? Number(form.competicao_id) : undefined,
        rodada: form.competicao_id && form.competicao_id !== 'amistoso' && form.rodada ? Number(form.rodada) : undefined,
        emCasa: form.emCasa === 'true',
      });
      setReviewOpen(false); setModal(false); carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível criar a partida.');
    } finally { savingRef.current = false; setSalvando(false); }
  }

  function openPicker(value: typeof picker) {
    setPickerSearch('');
    setPicker(value);
  }
  const formCategory = categorias.find(category => String(category.id) === form.categoria_id);
  const formCompetition = competicoes.find(competition => String(competition.id) === form.competicao_id);
  const formHome = times.find(time => String(time.id) === form.mandante_id);
  const formAway = times.find(time => String(time.id) === form.visitante_id);
  const localToday = new Date();
  const minimumDate = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, '0')}-${String(localToday.getDate()).padStart(2, '0')}`;
  const matches = useMemo(() => {
    const teams = new Map(times.map(time => [time.id, time]));
    const categories = new Map(categorias.map(category => [category.id, category]));
    return partidas.map(match => ({
      ...match,
      mandante: match.mandante || teams.get(match.mandante_id),
      visitante: match.visitante || teams.get(match.visitante_id),
      categoria: match.categoria || categories.get(match.categoria_id),
    }));
  }, [partidas, times, categorias]);
  const categoryOptions = useMemo(() => categorias.filter(category => category.tipo === phase)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))
    .map(category => ({ value: String(category.id), label: category.nome.toUpperCase() })), [categorias, phase]);
  const draftCategoryItem = categorias.find(category => String(category.id) === draftCategory);
  const draftPhase = draftCategoryItem?.tipo || (draftCategory === 'BASE' ? 'BASE' : draftCategory === 'INICIACAO' ? 'INICIACAO' : '');
  const draftSubs = categorias.filter(category => category.tipo === draftPhase)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
  const contextualMatches = useMemo(() => matches.filter(match => {
    const day = match.data.slice(0, 10);
    return (!phase || match.categoria?.tipo === phase)
      && (!filtroCategoria || String(match.categoria_id) === filtroCategoria || match.categoria?.nome.toLowerCase() === selectedCategory?.nome.toLowerCase())
      && (!opponent.trim() || normalizarBusca(`${match.mandante?.nome || ''} ${match.visitante?.nome || ''} ${match.local || ''}`).includes(normalizarBusca(opponent)))
      && (!mando || match.emCasa === (mando === 'casa'))
      && (!range.inicio || day >= range.inicio)
      && (!range.fim || day <= range.fim);
  }), [matches, phase, filtroCategoria, selectedCategory?.nome, opponent, mando, range.inicio, range.fim]);
  const filtered = useMemo(() => contextualMatches.filter(match => !filtroStatus || (filtroStatus === 'PROXIMAS' ? grupoSituacao(match.status) === 'next' : match.status === filtroStatus)), [contextualMatches, filtroStatus]);
  const counts = useMemo(() => contextualMatches.reduce((total, match) => {
    total[grupoSituacao(match.status)]++;
    return total;
  }, { live: 0, next: 0, past: 0, cancelled: 0 }), [contextualMatches]);
  const groups = useMemo(() => agruparAgenda(filtered), [filtered]);
  const live = useMemo(() => ordenarAgenda(groups.live, sortCategory), [groups, sortCategory]);
  const today = useMemo(() => ordenarAgenda(groups.today, sortCategory), [groups, sortCategory]);
  const upcoming = useMemo(() => ordenarAgenda(groups.upcoming, sortCategory), [groups, sortCategory]);
  const overdue = useMemo(() => ordenarAgenda(groups.overdue, sortCategory, true), [groups, sortCategory]);
  const finished = useMemo(() => ordenarAgenda(groups.finished, sortCategory, true), [groups, sortCategory]);
  const cancelled = useMemo(() => ordenarAgenda(groups.cancelled, sortCategory, true), [groups, sortCategory]);
  const customLabel = start && end ? `${formatMatchDate(start)} — ${formatMatchDate(end)}` : 'Escolher período';
  const filterKey = [phase, filtroCategoria, filtroStatus, period, start, end, opponent, mando, sortCategory].join('|');
  const chips = [
    { id: 'category', label: selectedCategory?.nome.toUpperCase() || (phase === 'BASE' ? 'Base' : ''), clear: () => changeFilters({ categoria_id: '', ...(selectedCategory ? {} : { fase: 'INICIACAO' }) }) },
    { id: 'search', label: opponent ? `Busca: ${opponent}` : '', clear: () => changeFilters({ busca: '' }) },
    { id: 'status', label: STATUSES.find(status => status.value === filtroStatus)?.label || '', clear: () => changeFilters({ status: '' }) },
    { id: 'period', label: period === 'custom' ? customLabel : period !== 'all' ? PERIODS.find(item => item.value === period)?.label || '' : '', clear: () => changeFilters({ periodo: '', de: '', ate: '' }) },
    { id: 'mando', label: mando === 'casa' ? 'Em casa' : mando === 'fora' ? 'Fora de casa' : '', clear: () => changeFilters({ mando: '' }) },
  ].filter(chip => chip.label);
  function renderMatch(match: Partida) {
    return <MatchCard key={match.id} partida={match} featured={match.status === 'AO_VIVO'} compactLive />;
  }

  return (
    <div className="match-schedule">
      <div className="page-header">
        <div><span className="eyebrow">DENTRO DA QUADRA</span><h1 className="page-title">Partidas</h1><p className="page-sub">{podeGerenciar ? 'Gerencie, acompanhe e consulte os resultados das partidas do clube.' : 'Acompanhe a agenda, os placares e os resultados do clube.'}</p></div>
        {podeGerenciar && <Btn className="schedule-desktop-new" aria-label="Nova partida" title="Nova partida" onClick={() => { setForm({ ...FORM_VAZIO, categoria_id: filtroCategoria }); setErro(''); setReviewOpen(false); setModal(true); }}><Icon name="plus" size={18} />Nova partida</Btn>}
      </div>

      <div className="schedule-status-summary" role="group" aria-label="Filtrar por situação">
        {LEGEND.map(item => <button type="button" key={item.id}
          aria-pressed={item.value === 'PROXIMAS' ? ['PROXIMAS', 'AGENDADA', 'PREPARADA'].includes(filtroStatus) : filtroStatus === item.value}
          onClick={() => changeFilters({ status: (item.value === 'PROXIMAS' ? ['PROXIMAS', 'AGENDADA', 'PREPARADA'].includes(filtroStatus) : filtroStatus === item.value) ? '' : item.value })}>
          <Icon name={item.icon} size={17} />{item.label}<span>{counts[item.id]}</span>
        </button>)}
      </div>

      <div className="schedule-filters">
        <div className="schedule-mobile-actions">
          <Btn variant="ghost" className="schedule-mobile-filter-button" aria-haspopup="dialog" onClick={() => openFilters(true)}>
            <Icon name="filters" size={18} />Filtros{!!chips.length && <span className="schedule-filter-count">{chips.length}</span>}
          </Btn>
          <div className="schedule-view-toggle" role="group" aria-label="Visualização das partidas">
            <button type="button" aria-label="Cards" title="Cards" aria-pressed={!list} onClick={() => changeFilters({ visualizacao: '' })}><Icon name="grid" size={16} /></button>
            <button type="button" aria-label="Lista" title="Lista" aria-pressed={list} onClick={() => changeFilters({ visualizacao: 'lista' })}><Icon name="list" size={16} /></button>
          </div>
          {podeGerenciar && <Btn className="schedule-mobile-new" aria-label="Nova partida" title="Nova partida" onClick={() => { setForm({ ...FORM_VAZIO, categoria_id: filtroCategoria }); setErro(''); setReviewOpen(false); setModal(true); }}><Icon name="plus" size={16} />Nova partida</Btn>}
        </div>
        <div className="schedule-filter-primary">
          <div className="schedule-search">
            <Icon name="search" size={18} /><label className="sr-only" htmlFor="match-search">Buscar time, adversário ou local</label>
            <input id="match-search" type="search" placeholder="Buscar time, adversário ou local…" value={opponent} onChange={event => changeFilters({ busca: event.target.value })} />
          </div>
          <div className="schedule-category-control">
            <span className="field-label">Categoria</span>
            <div className="schedule-phase-toggle" role="group" aria-label="Categoria das partidas">
              <button type="button" aria-pressed={phase === 'INICIACAO'} onClick={() => changeFilters({ fase: 'INICIACAO', categoria_id: '' })}>INICIAÇÃO</button>
              <button type="button" aria-pressed={phase === 'BASE'} onClick={() => changeFilters({ fase: 'BASE', categoria_id: '' })}>BASE</button>
            </div>
          </div>
          <FilterSelect label="Subcategoria" emptyLabel="TODOS OS SUBS" options={categoryOptions} value={filtroCategoria}
            onChange={value => changeFilters({ categoria_id: value })} />
          <FilterSelect label="Período" emptyLabel="Todos os períodos" options={[...PERIODS.filter(item => item.value !== 'all'), { value: 'custom', label: period === 'custom' ? customLabel : 'Personalizado…' }]}
            value={period === 'all' ? '' : period} onChange={value => value === 'custom' ? setPeriodOpen(true) : changeFilters({ periodo: value, de: '', ate: '' })} />
          <Btn variant="ghost" aria-haspopup="dialog" onClick={() => openFilters()}><Icon name="filters" size={18} />Mais filtros{(filtroStatus || mando) && <span className="schedule-filter-count">{Number(!!filtroStatus) + Number(!!mando)}</span>}</Btn>
        </div>
        {!!chips.length && <div className="schedule-active-filters" aria-label="Filtros ativos">
          {chips.map(chip => <button type="button" key={chip.id} onClick={chip.clear} title={chip.label} aria-label={`Remover filtro ${chip.label}`}><span>{chip.label}</span><Icon name="minus" size={14} /></button>)}
          <button type="button" className="schedule-clear" onClick={() => changeFilters({ fase: '', categoria_id: '', busca: '', status: '', periodo: '', de: '', ate: '', local: '', mando: '' })}>Limpar tudo</button>
        </div>}
      </div>

      <div className="schedule-results-toolbar">
        <p className="schedule-result-count" role="status">{loading ? 'Carregando partidas…' : `${filtered.length} ${filtered.length === 1 ? 'partida' : 'partidas'}`}</p>
        <FilterSelect label="Ordenar por" emptyLabel="Por horário" options={[{ value: 'categoria', label: 'Por categoria' }]} value={sortCategory ? 'categoria' : ''} onChange={value => changeFilters({ ordem: value })} />
        <div className="schedule-view-toggle" role="group" aria-label="Visualização das partidas">
          <button type="button" aria-label="Cards" title="Cards" aria-pressed={!list} onClick={() => changeFilters({ visualizacao: '' })}><Icon name="grid" size={16} /><span className="schedule-view-label">Cards</span></button>
          <button type="button" aria-label="Lista" title="Lista" aria-pressed={list} onClick={() => changeFilters({ visualizacao: 'lista' })}><Icon name="list" size={16} /><span className="schedule-view-label">Lista</span></button>
        </div>
      </div>

      {loading ? <Spinner /> : loadError ? <div className="notice-error" role="alert"><p>{loadError}</p><Btn variant="ghost" onClick={carregar}>Tentar novamente</Btn></div> : !filtered.length ? <Empty icon="⚽" message={chips.length ? 'Nenhuma partida encontrada. Experimente ajustar os filtros.' : 'Nenhuma partida publicada nesta fase.'} /> : <div className="schedule-results">
        {!!live.length && <LiveMatchesCarousel key={filterKey} matches={live} renderMatch={renderMatch} />}
        <ScheduleSection key={'today' + filterKey} title="Hoje" description="Partidas programadas para hoje"
          matches={today} initialOpen renderMatch={renderMatch} list={list} />
        <ScheduleSection key={'upcoming' + filterKey} title="A seguir" description={`Agendadas e preparadas · ${sortCategory ? 'por categoria' : 'por data e horário'}`}
          matches={upcoming} initialOpen renderMatch={renderMatch} list={list} groupDays={!sortCategory} />
        <ScheduleSection key={'overdue' + filterKey} title="Pendentes de atualização" description="Datas anteriores · confira a situação destas partidas"
          matches={overdue} initialOpen={filtroStatus === 'AGENDADA' || filtroStatus === 'PREPARADA'} renderMatch={renderMatch} list={list} groupDays />
        <ScheduleSection key={'finished' + filterKey} title="Finalizadas" description="Resultados mais recentes primeiro" matches={finished}
          initialOpen={!!filtroStatus || period !== 'all' || !!opponent} renderMatch={renderMatch} list={list} groupDays />
        <ScheduleSection key={'cancelled' + filterKey} title="Canceladas" description="Partidas que não serão realizadas" matches={cancelled}
          initialOpen={filtroStatus === 'CANCELADA'} renderMatch={renderMatch} list={list} groupDays />
      </div>}

      {periodOpen && <SchedulePeriodDialog inicio={range.inicio} fim={range.fim} onClose={() => setPeriodOpen(false)}
        onApply={(inicio, fim) => { changeFilters({ periodo: 'custom', de: inicio, ate: fim }); setPeriodOpen(false); }} />}
      <Modal open={moreOpen} title={mobileFilters ? 'Filtrar partidas' : 'Mais filtros'} className={`schedule-more-dialog${mobileFilters ? ' schedule-all-filters-dialog' : ''}`} onClose={() => setMoreOpen(false)}
        footer={<div className="schedule-filter-footer">
          <button type="button" className="schedule-reset-draft" onClick={resetDraft}>Limpar filtros</button>
          <Btn variant="ghost" onClick={() => setMoreOpen(false)}>Cancelar</Btn>
          <Btn onClick={applyFilters}>Aplicar filtros</Btn>
        </div>}>
        <div className="schedule-filter-fields">
        {mobileFilters && <>
          <Input label="Buscar time, adversário ou local" type="search" value={draftSearch} onChange={event => setDraftSearch(event.target.value)} />
          <FilterChoices label="Categoria" value={draftPhase} onChange={setDraftCategory} className="schedule-two-choices" options={[
            { value: 'INICIACAO', label: 'INICIAÇÃO' }, { value: 'BASE', label: 'BASE' },
          ]} />
          {draftPhase && <FilterChoices label="Sub" value={draftCategory} className="schedule-sub-choices"
            onChange={setDraftCategory} options={[{ value: draftPhase, label: 'Todos' }, ...draftSubs.map(category => ({ value: String(category.id), label: category.nome.toUpperCase() }))]} />}
          <FilterChoices label="Período" value={draftPeriod} onChange={setDraftPeriod} options={[
            { value: '', label: 'Todos' }, { value: 'today', label: 'Hoje' }, { value: 'week', label: 'Semana' },
            { value: 'month', label: 'Mês' }, { value: 'custom', label: 'Intervalo', icon: 'calendar' },
          ]} />
          {draftPeriod === 'custom' && <div className="schedule-custom-range">
            <Input label="De" type="date" value={draftStart} onChange={event => setDraftStart(event.target.value)} />
            <Input label="Até" type="date" value={draftEnd} onChange={event => setDraftEnd(event.target.value)} />
          </div>}
        </>}
        {mobileFilters ? <>
          <FilterChoices label="Situação" value={draftStatus} onChange={setDraftStatus} options={[
            { value: '', label: 'Todas' }, { value: 'AO_VIVO', label: 'Ao vivo', icon: 'live' },
            { value: 'PROXIMAS', label: 'Próximas', icon: 'clock' }, { value: 'FINALIZADA', label: 'Finalizadas', icon: 'checkAll' },
            { value: 'AGENDADA', label: 'Agendadas' }, { value: 'PREPARADA', label: 'Preparadas' },
            { value: 'CANCELADA', label: 'Canceladas', icon: 'minus' },
          ]} />
          <FilterChoices label="Mando de campo" value={draftMando} onChange={setDraftMando} options={[
            { value: '', label: 'Casa e fora' }, { value: 'casa', label: 'Em casa', icon: 'home' }, { value: 'fora', label: 'Fora', icon: 'bus' },
          ]} />
        </> : <>
          <FilterSelect label="Situação" emptyLabel="Todas as situações" options={STATUSES} value={draftStatus} onChange={setDraftStatus} inlineOptions />
          <FilterSelect label="Mando de campo" emptyLabel="Casa e fora" options={[{ value: 'casa', label: 'Em casa' }, { value: 'fora', label: 'Fora de casa' }]} value={draftMando} onChange={setDraftMando} inlineOptions />
        </>}
        {mobileFilters && <>
          <FilterChoices label="Ordenar" value={draftSort} onChange={setDraftSort} className="schedule-two-choices" options={[
            { value: '', label: 'Por horário', icon: 'clock' }, { value: 'categoria', label: 'Por categoria' },
          ]} />
        </>}
        {filterError && <p className="notice-error" role="alert">{filterError}</p>}
        </div>
      </Modal>
      <Modal open={modal && !reviewOpen} onClose={() => { if (!salvando) setModal(false); }} title="Organizar partida" className="schedule-create-dialog"
        footer={<div className="schedule-create-actions"><Btn variant="ghost" type="button" onClick={() => setModal(false)}>Cancelar</Btn><Btn type="submit" form="schedule-create-form"><Icon name="checkAll" size={17} />Criar partida</Btn></div>}>
        <form id="schedule-create-form" onSubmit={revisarPartida} className="schedule-create-form" noValidate>
          <div className="schedule-create-top">
            <div className="schedule-create-club"><ClubBadge src={clube?.escudo} name={clube?.nome} size={44} /><strong>{clube?.nome || 'Seu clube'}</strong></div>
            <button className="schedule-create-sub" type="button" aria-label="Selecionar categoria da partida" aria-haspopup="dialog" onClick={() => openPicker('categoria')}>{formCategory?.nome || 'Categoria'}<Icon name="chevronRight" size={17} /></button>
          </div>
          <div className="field"><span className="field-label">Competição</span><button className="schedule-create-competition" type="button" aria-haspopup="dialog" onClick={() => openPicker('competicao')}><Icon name="trophy" size={21} /><span>{formCompetition?.nome || (form.competicao_id === 'amistoso' ? 'Amistoso' : 'Selecionar competição')}</span><Icon name="chevronRight" size={17} /></button></div>
          <section className="schedule-create-matchup" aria-labelledby="matchup-title"><h3 id="matchup-title">Confronto</h3><div>
            {(['mandante', 'visitante'] as const).map(side => {
              const team = side === 'mandante' ? formHome : formAway;
              return <button key={side} className="schedule-create-team" data-selected={!!team} type="button" aria-label={`Selecionar ${side}${team ? `: ${teamName(team.nome)}` : ''}`} aria-haspopup="dialog" onClick={() => { if (!form.categoria_id) { setErro('Selecione a categoria antes de escolher os times.'); openPicker('categoria'); } else openPicker(side); }}>
                {team ? <ClubBadge src={team.escudo || team.clubeRepresentado?.escudo} name={team.nome} size={54} /> : <span className="schedule-create-add"><Icon name="plus" size={28} /></span>}
                <small>{side === 'mandante' ? 'MANDANTE' : 'VISITANTE'}</small><strong>{team ? teamName(team.nome) : 'Selecionar time'}</strong>
                {team && <span className="schedule-create-change"><Icon name="switchClub" size={13} />Trocar</span>}
              </button>;
            })}
            <span className="schedule-create-vs" aria-hidden="true">VS</span>
          </div></section>
          <fieldset className="schedule-create-mando"><legend>Mando de campo</legend><button type="button" aria-pressed={form.emCasa === 'true'} onClick={() => setForm(f => ({ ...f, emCasa: 'true' }))}><Icon name="home" size={17} />Em casa</button><button type="button" aria-pressed={form.emCasa === 'false'} onClick={() => setForm(f => ({ ...f, emCasa: 'false' }))}><Icon name="bus" size={17} />Fora</button></fieldset>
          <div className="schedule-create-date">
            <Input label="Data" type="date" min={minimumDate} value={form.data} onChange={e => { setForm(f => ({ ...f, data: e.target.value })); setErro(''); }} error={erro.includes('data') ? erro : ''} required />
            <Input label="Horário" type="time" value={form.horario} onChange={e => { setForm(f => ({ ...f, horario: e.target.value })); setErro(''); }} error={erro.includes('horário') ? erro : ''} required />
          </div>
          <Input label="Local · opcional" placeholder="Ginásio, campo ou endereço" value={form.local} onChange={e => setForm(f => ({ ...f, local: e.target.value }))} />
          {formCompetition && <Input label="Rodada · opcional" type="number" min="1" step="1" value={form.rodada} onChange={e => { setForm(f => ({ ...f, rodada: e.target.value })); setErro(''); }} />}
          {erro && !erro.includes('data') && !erro.includes('horário') && <p className="schedule-create-error" role="alert">{erro}</p>}
        </form>
      </Modal>
      <Modal open={!!picker && modal} onClose={() => setPicker(null)} title={picker === 'categoria' ? 'Categoria da partida' : picker === 'competicao' ? 'Selecionar competição' : `Selecionar ${picker}`} className="schedule-picker-dialog">
        {picker === 'categoria' ? <div className="schedule-category-options">
          <p>{formHome || formAway ? 'Ao mudar de categoria, selecione novamente os times e a competição.' : 'Selecione a categoria em que a partida será criada.'}</p>
          {(['INICIACAO', 'BASE'] as const).map(tipo => <section key={tipo}><h3>{tipo === 'BASE' ? 'Base' : 'Iniciação'}</h3><div>
            {categorias.filter(category => category.tipo === tipo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })).map(category => <button key={category.id} type="button" aria-pressed={form.categoria_id === String(category.id)} onClick={() => {
              if (form.categoria_id !== String(category.id)) setForm(f => ({ ...f, categoria_id: String(category.id), mandante_id: '', visitante_id: '', competicao_id: '', rodada: '' }));
              setErro(''); setPicker(null);
            }}>{category.nome}{form.categoria_id === String(category.id) && <Icon name="checkAll" size={16} />}</button>)}
          </div></section>)}
          {!categorias.length && <p className="schedule-picker-empty">Nenhuma categoria disponível. Cadastre as categorias do clube antes de organizar uma partida.</p>}
        </div> : <div className="schedule-picker-content">
          <Input label={picker === 'competicao' ? 'Buscar competição ou ano' : 'Buscar time'} type="search" placeholder={picker === 'competicao' ? 'Buscar competição ou ano' : 'Buscar time'} value={pickerSearch} onChange={event => setPickerSearch(event.target.value)} />
          <div className="schedule-picker-options">
            {picker === 'competicao' ? <>
              <button type="button" aria-pressed={form.competicao_id === 'amistoso'} onClick={() => { setForm(f => ({ ...f, competicao_id: 'amistoso', rodada: '' })); setErro(''); setPicker(null); }}><span className="schedule-picker-icon"><Icon name="ball" size={23} /></span><span><strong>Amistoso</strong><small>Sem competição</small></span>{form.competicao_id === 'amistoso' && <Icon name="checkAll" size={18} />}</button>
              {competicoes.filter(item => (!formCategory || item.tipo === formCategory.tipo) && normalizarBusca(`${item.nome} ${item.ano}`).includes(normalizarBusca(pickerSearch))).map(item => (
                <button key={item.id} type="button" aria-pressed={form.competicao_id === String(item.id)} onClick={() => {
                  setForm(f => ({ ...f, competicao_id: String(item.id), rodada: f.competicao_id === String(item.id) ? f.rodada : '' }));
                  setErro('');
                  setPicker(null);
                }}>
                  <span className="schedule-picker-icon"><Icon name="trophy" size={23} /></span>
                  <span><strong>{item.nome}</strong><small>Temporada {item.ano}</small></span>
                  {form.competicao_id === String(item.id) && <Icon name="checkAll" size={18} />}
                </button>
              ))}
            </> : <>
              {times.filter(item => String(item.categoria_id) === form.categoria_id && normalizarBusca(item.nome).includes(normalizarBusca(pickerSearch))).map(item => {
                const alreadySelected = String(item.id) === (picker === 'mandante' ? form.visitante_id : form.mandante_id);
                const selected = String(item.id) === (picker === 'mandante' ? form.mandante_id : form.visitante_id);
                return <button key={item.id} type="button" aria-pressed={selected} disabled={alreadySelected} onClick={() => { setForm(f => ({ ...f, [picker === 'mandante' ? 'mandante_id' : 'visitante_id']: String(item.id) })); setErro(''); setPicker(null); }}><ClubBadge src={item.escudo || item.clubeRepresentado?.escudo} name={item.nome} size={42} /><span><strong>{teamName(item.nome)}</strong><small>{alreadySelected ? 'Já selecionado no outro lado' : formCategory?.nome}</small></span>{selected && <Icon name="checkAll" size={18} />}</button>;
              })}
              {!times.some(item => String(item.categoria_id) === form.categoria_id && normalizarBusca(item.nome).includes(normalizarBusca(pickerSearch))) && <p className="schedule-picker-empty">{pickerSearch ? 'Nenhum time encontrado. Tente outro nome ou limpe a busca.' : 'Nenhum time cadastrado nesta categoria. Escolha outra categoria ou cadastre os times primeiro.'}</p>}
            </>}
          </div>
        </div>}
      </Modal>
      <Modal open={reviewOpen} onClose={() => { if (!salvando) setReviewOpen(false); }} title="Revisar partida" className="schedule-review-dialog">
        <div className="schedule-review"><p>Confira principalmente a categoria antes de confirmar.</p><section className="schedule-review-category"><span>Categoria da partida</span><strong>{formCategory?.nome || 'Não informada'}</strong><small>{formCategory?.tipo === 'BASE' ? 'Base' : 'Iniciação'}</small></section><dl>
          <div><dt>Clube</dt><dd>{clube?.nome || 'Seu clube'}</dd></div><div><dt>Competição</dt><dd>{formCompetition?.nome || 'Amistoso'}</dd></div><div><dt>Mandante</dt><dd>{teamName(formHome?.nome || '')}</dd></div><div><dt>Visitante</dt><dd>{teamName(formAway?.nome || '')}</dd></div><div><dt>Data</dt><dd>{formatMatchDate(form.data)}</dd></div><div><dt>Horário</dt><dd>{form.horario}</dd></div><div><dt>Mando</dt><dd>{form.emCasa === 'true' ? 'Em casa' : 'Fora'}</dd></div><div><dt>Local</dt><dd>{form.local || 'Local não definido'}</dd></div>
        </dl>{erro && <p className="schedule-create-error" role="alert">{erro}</p>}<div className="schedule-review-actions"><Btn onClick={salvar} disabled={salvando}><Icon name="checkAll" size={17} />{salvando ? 'Criando...' : 'Confirmar e criar'}</Btn><Btn variant="ghost" type="button" disabled={salvando} onClick={() => setReviewOpen(false)}>Voltar e editar</Btn></div></div>
      </Modal>
    </div>
  );
}
