import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchPartidas, criarPartida, fetchTimes, fetchCategorias, fetchCompeticoes, type Partida, type Time, type Categoria, type Competicao } from '../services/api';
import { Btn, Modal, Input, Spinner } from '../components/UI';
import { ClubBadge } from '../components/Brand';
import { useAuth } from '../contexts/AuthContext';
import { MatchCard, formatMatchDate } from '../components/MatchCard';
import { MatchListRow } from '../components/MatchListRow';
import { Icon, type IconName } from '../components/Icon';
import { BlockColumns } from '../components/BlockColumns';
import { FilterSelect } from '../components/FilterSelect';
import { SchedulePeriodDialog } from '../components/SchedulePeriodDialog';
import { intervaloAgenda, grupoSituacao, ordenarAgenda, rotuloDiaAgenda, agruparAgenda, type PeriodoAgenda } from '../utils/scheduleFilters';
import { teamName } from '../utils/teamIdentity';
import { matchHasOwnTeam, selectMatchTeam } from '../utils/matchTeams';
import { CategoryFilter as HomeCategories } from '../components/CategoryFilter';
import { useClubCategory } from '../hooks/useClubCategory';
import { MatchDateField, MatchTimeField } from '../components/MatchDateTime';
import { LocationInput } from '../components/LocationInput';
import { InfoNotice } from '../components/InfoNotice';
import { CollectionSearch, CollectionFilterButton, CollectionViewToggle, CollectionFilterDialog } from '../components/CollectionToolbar';
import './Partidas.css';
import './ScheduleCreate.css';
import './Dashboard.css';
import '../components/ResponsiveControls.css';

const STATUSES = [
  { value: 'TODAS', label: 'Todos' },
  { value: 'PROXIMAS', label: 'Próximas (agendadas e preparadas)' },
  { value: 'AGENDADA', label: 'Agendada' },
  { value: 'PREPARADA', label: 'Preparada' },
  { value: 'AO_VIVO', label: 'Ao vivo' },
  { value: 'FINALIZADA', label: 'Finalizada' },
  { value: 'CANCELADA', label: 'Cancelada' },
];
const LEGEND = [
  { id: 'all', value: 'TODAS', label: 'Todos', icon: 'ball' },
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

function ScheduleResults({ matches, renderMatch, list, grouped }: {
  matches: Partida[];
  renderMatch: (match: Partida) => ReactNode;
  list: boolean;
  grouped: boolean;
}) {
  const [limit, setLimit] = useState(48);
  const showList = list && matches.some(match => match.status !== 'AO_VIVO');
  const groups = new Map<string, Partida[]>();
  matches.slice(0, limit).forEach(match => {
    const key = grouped ? match.data.slice(0, 7) : 'live';
    groups.set(key, [...(groups.get(key) || []), match]);
  });
  return <div className={`schedule-results${showList ? ' schedule-list' : ''}`}>
    {[...groups].map(([day, games]) => <section className="schedule-date-group" key={day}>
      {grouped && <h2>{new Date(`${day}-01T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2>}
      <div className={`schedule-match-grid${showList ? ' is-list' : ''}`}>{games.map(renderMatch)}</div>
    </section>)}
    {matches.length > limit && <Btn variant="ghost" className="schedule-show-more" onClick={() => setLimit(value => value + 48)}>Mostrar mais partidas ({matches.length - limit})</Btn>}
  </div>;
}

function ScheduleAccordion({ title, icon, matches, initialOpen = false, renderMatch, list }: {
  title: string;
  icon: IconName;
  matches: Partida[];
  initialOpen?: boolean;
  renderMatch: (match: Partida) => ReactNode;
  list: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const id = useId();
  if (!matches.length) return null;
  return <section className="schedule-section schedule-status-section">
    <h2>
      <button id={`${id}-heading`} className="schedule-section-toggle" type="button"
        aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
        <span className="schedule-section-copy"><strong>
          <Icon name={icon} size={18} />
          <span className="schedule-section-title">{title}</span>
          <span className="schedule-section-count">{matches.length}</span>
        </strong></span>
        <span className="schedule-section-chevron"><Icon name="chevronRight" size={17} /></span>
      </button>
    </h2>
    <div id={id} hidden={!open} role="region" aria-labelledby={`${id}-heading`}>
      {open && <ScheduleResults matches={matches} renderMatch={renderMatch} list={list} grouped={title !== 'Ao vivo'} />}
    </div>
  </section>;
}

export default function PartidasPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [compactViewport, setCompactViewport] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    const viewport = window.matchMedia('(max-width: 760px)');
    const update = () => setCompactViewport(viewport.matches);
    update();
    viewport.addEventListener('change', update);
    return () => viewport.removeEventListener('change', update);
  }, []);
  const { podeGerenciar, clube } = useAuth();
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [times, setTimes] = useState<Time[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [competicoes, setCompeticoes] = useState<Competicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [picker, setPicker] = useState<'categoria' | 'competicao' | 'visitante' | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [draftCategoryId, setDraftCategoryId] = useState('');
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const savingRef = useRef(false);
  const [erro, setErro] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loadWarning, setLoadWarning] = useState('');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
  const [draftMando, setDraftMando] = useState('');
  const [mobileFilters, setMobileFilters] = useState(false);
  const [draftSearch, setDraftSearch] = useState('');
  const [draftPeriod, setDraftPeriod] = useState('');
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [draftSort, setDraftSort] = useState('');
  const [filterError, setFilterError] = useState('');
  const loadVersion = useRef(0);
  const handledOpponent = useRef('');
  const requestedStatus = STATUSES.some(item => item.value === searchParams.get('status')) ? searchParams.get('status')! : '';
  const { phase, selected: selectedCategory } = useClubCategory(categorias, searchParams.get('categoria_id'), searchParams.get('fase'));
  const phaseCategories = useMemo(() => categorias.filter(category => category.tipo === phase)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })), [categorias, phase]);
  const filtroCategoria = selectedCategory ? String(selectedCategory.id) : '';
  const categoryIndex = Math.max(0, phaseCategories.indexOf(selectedCategory!));
  const opponent = searchParams.get('busca') || '';
  const mando = searchParams.get('mando') || '';
  const period = ['today', 'week', 'month', 'custom'].includes(searchParams.get('periodo') || '') ? searchParams.get('periodo') as PeriodoAgenda : 'all';
  const start = searchParams.get('de') || '';
  const end = searchParams.get('ate') || '';
  const list = !compactViewport && searchParams.get('visualizacao') === 'lista';
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
      busca: draftSearch,
      periodo: draftPeriod, de: draftPeriod === 'custom' ? draftStart : '',
      ate: draftPeriod === 'custom' ? draftEnd : '', ordem: draftSort,
    } : {}) });
    setMoreOpen(false);
  }

  function resetDraft() {
    setDraftSearch('');
    setDraftPeriod('');
    setDraftStart('');
    setDraftEnd('');
    setDraftStatus(['AGENDADA', 'PREPARADA'].includes(filtroStatus) ? 'PROXIMAS' : filtroStatus);
    setDraftMando('');
    setDraftSort('');
    setFilterError('');
  }

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
    setLoadWarning('');
    setLoading(true);
    Promise.allSettled([fetchPartidas(), fetchTimes(), fetchCategorias(), fetchCompeticoes()])
      .then(([p, t, c, comp]) => {
        if (version !== loadVersion.current) return;
        if (p.status === 'rejected') throw p.reason;
        setPartidas(p.value);
        setTimes(t.status === 'fulfilled' ? t.value : []);
        setCategorias(c.status === 'fulfilled' ? c.value : []);
        setCompeticoes(comp.status === 'fulfilled' ? comp.value : []);
        const indisponiveis = [t.status === 'rejected' && 'times', c.status === 'rejected' && 'categorias', comp.status === 'rejected' && 'competições'].filter(Boolean);
        if (indisponiveis.length) setLoadWarning('As partidas foram carregadas, mas alguns filtros e opções de criação estão temporariamente indisponíveis.');
      })
      .catch(() => {
        if (version !== loadVersion.current) return;
        setPartidas([]);
        setLoadError(navigator.onLine
          ? 'Não foi possível buscar as partidas agora. O servidor pode estar temporariamente indisponível.'
          : 'Você está sem conexão. Reconecte-se à internet e tente novamente.');
      })
      .finally(() => { if (version === loadVersion.current) setLoading(false); });
  }
  useEffect(() => {
    carregar();
    return () => { loadVersion.current++; };
  }, [clube?.id]);

  function validarPartida() {
    if (!form.categoria_id) return 'Selecione a categoria da partida.';
    if (!categorias.some(category => String(category.id) === form.categoria_id)) return 'Esta categoria não está mais disponível. Selecione outra categoria.';
    if (!ownTeam(form.categoria_id)) return 'Esta categoria precisa ter exatamente um time vinculado ao seu clube. Confira o cadastro em Times.';
    if (!form.mandante_id || !form.visitante_id) return 'Selecione o adversário da partida.';
    if (form.mandante_id === form.visitante_id) return 'Mandante e visitante precisam ser times diferentes.';
    if (!clube || !matchHasOwnTeam(times.find(t => String(t.id) === form.mandante_id), times.find(t => String(t.id) === form.visitante_id), clube.id)) return 'O confronto precisa ter um time do seu clube e um adversário.';
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
      const criada = await criarPartida({
        mandante_id: Number(form.mandante_id), visitante_id: Number(form.visitante_id),
        data: form.data, horario: form.horario, local: form.local.trim() || undefined,
        categoria_id: Number(form.categoria_id),
        competicao_id: form.competicao_id && form.competicao_id !== 'amistoso' ? Number(form.competicao_id) : undefined,
        rodada: form.competicao_id && form.competicao_id !== 'amistoso' && form.rodada ? Number(form.rodada) : undefined,
        emCasa: form.emCasa === 'true',
      });
      setReviewOpen(false); setModal(false);
      navigate(criada.solicitacao ? `/partidas/solicitacoes?id=${criada.solicitacao.id}` : `/partidas/${criada.id}`);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível criar a partida.');
    } finally { savingRef.current = false; setSalvando(false); }
  }

  function openPicker(value: typeof picker) {
    setPickerSearch('');
    if (value === 'categoria') setDraftCategoryId(form.categoria_id);
    setPicker(value);
  }
  function ownTeam(categoryId: string) {
    const own = times.filter(team => String(team.categoria_id) === categoryId && team.clube_representado_id === clube?.id);
    return own.length === 1 ? own[0] : undefined;
  }
  function openCreate() {
    const own = ownTeam(filtroCategoria);
    setForm({ ...FORM_VAZIO, categoria_id: filtroCategoria, mandante_id: own ? String(own.id) : '' });
    setErro('');
    setReviewOpen(false);
    setPicker(null);
    setModal(true);
  }
  useEffect(() => {
    const opponentId = searchParams.get('adversario_id');
    if (searchParams.get('organizar') !== '1' || loading || !podeGerenciar || !filtroCategoria) return;
    const key = `${clube?.id}:${opponentId || 'own'}:${filtroCategoria}`;
    if (handledOpponent.current === key) return;
    handledOpponent.current = key;
    const target = times.find(time => String(time.id) === opponentId && time.clube_representado_id !== clube?.id && !time.arquivado);
    const own = target ? ownTeam(String(target.categoria_id)) : undefined;
    if (target && own) {
      setForm({ ...FORM_VAZIO, categoria_id: String(target.categoria_id), mandante_id: String(own.id), visitante_id: String(target.id) });
      setErro('');
    } else {
      setForm({ ...FORM_VAZIO, categoria_id: filtroCategoria, mandante_id: ownTeam(filtroCategoria) ? String(ownTeam(filtroCategoria)!.id) : '' });
      setErro(opponentId ? 'O adversário não está mais disponível nesta categoria. Confira os times e selecione outro adversário.' : '');
    }
    setReviewOpen(false);
    setPicker(null);
    setModal(true);
    changeFilters({ organizar: '', adversario_id: '' });
  }, [searchParams, loading, times, clube?.id, podeGerenciar, filtroCategoria]);
  function chooseCategory() {
    const category = categorias.find(c => String(c.id) === draftCategoryId);
    if (category && String(category.id) !== form.categoria_id) {
      const own = ownTeam(String(category.id));
      setForm(f => ({ ...f, categoria_id: String(category.id), mandante_id: own ? String(own.id) : '', visitante_id: '', emCasa: 'true', competicao_id: '', rodada: '' }));
    }
    setErro('');
    setPicker(null);
  }
  function chooseTeam(teamId: number) {
    if (!clube || !ownTeam(form.categoria_id)) return;
    const team = times.find(item => item.id === teamId && String(item.categoria_id) === form.categoria_id);
    if (!team || team.clube_representado_id === clube.id) return;
    try {
      const selection = selectMatchTeam(times, clube.id, Number(form.categoria_id), form.emCasa === 'true' ? 'visitante' : 'mandante', teamId, form);
      setForm(f => ({ ...f, ...selection }));
      setErro('');
      setPicker(null);
    } catch (error) { setErro(error instanceof Error ? error.message : 'Não foi possível selecionar o adversário.'); }
  }
  function changeVenue(atHome: boolean) {
    if ((form.emCasa === 'true') === atHome) return;
    setForm(f => ({ ...f, mandante_id: f.visitante_id, visitante_id: f.mandante_id, emCasa: String(atHome) }));
    setErro('');
  }
  const formCategory = categorias.find(category => String(category.id) === form.categoria_id);
  const categoryChoices = useMemo(() => [...categorias].sort((a, b) =>
    Number(a.tipo === 'BASE') - Number(b.tipo === 'BASE') || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })), [categorias]);
  const formCompetition = competicoes.find(competition => String(competition.id) === form.competicao_id);
  const formHome = times.find(time => String(time.id) === form.mandante_id);
  const formAway = times.find(time => String(time.id) === form.visitante_id);
  const fixedTeam = ownTeam(form.categoria_id);
  const selectedOpponent = form.emCasa === 'true' ? formAway : formHome;
  const availableOpponents = times.filter(team => String(team.categoria_id) === form.categoria_id && team.clube_representado_id !== clube?.id);
  const visibleOpponents = availableOpponents.filter(team => normalizarBusca(team.nome).includes(normalizarBusca(pickerSearch)))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
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
  const contextualMatches = useMemo(() => matches.filter(match => {
    const day = match.data.slice(0, 10);
    return (!phase || !match.categoria || match.categoria.tipo === phase)
      && (!opponent.trim() || normalizarBusca(`${match.mandante?.nome || ''} ${match.visitante?.nome || ''} ${match.local || ''}`).includes(normalizarBusca(opponent)))
      && (!mando || match.emCasa === (mando === 'casa'))
      && (!range.inicio || day >= range.inicio)
      && (!range.fim || day <= range.fim);
  }), [matches, phase, opponent, mando, range.inicio, range.fim]);
  const hasLive = contextualMatches.some(match => match.status === 'AO_VIVO' && (!selectedCategory || match.categoria_id === selectedCategory.id));
  const filtroStatus = requestedStatus || (hasLive ? 'AO_VIVO' : 'PROXIMAS');
  const resultsByCategory = useMemo(() => new Map((phaseCategories.length ? phaseCategories : [undefined]).map(category => {
    const scoped = contextualMatches.filter(match => !category || match.categoria_id === category.id
      || match.categoria?.nome.toLowerCase() === category.nome.toLowerCase());
    const filtered = scoped.filter(match => filtroStatus === 'TODAS' || !filtroStatus || (filtroStatus === 'PROXIMAS'
      ? grupoSituacao(match.status) === 'next' : match.status === filtroStatus));
    const counts = scoped.reduce((total, match) => {
      total[grupoSituacao(match.status)]++;
      return total;
    }, { all: scoped.length, live: 0, next: 0, past: 0, cancelled: 0 });
    const groups = agruparAgenda(filtered);
    return [category?.id ?? 0, {
      filtered, counts,
      live: ordenarAgenda(groups.live, sortCategory),
      today: ordenarAgenda(groups.today, sortCategory),
      upcoming: ordenarAgenda(groups.upcoming, sortCategory),
      overdue: ordenarAgenda(groups.overdue, sortCategory, true),
      finished: ordenarAgenda(groups.finished, sortCategory, true),
      cancelled: ordenarAgenda(groups.cancelled, sortCategory, true),
    }];
  })), [contextualMatches, phaseCategories, filtroStatus, sortCategory]);
  const { filtered, counts } = resultsByCategory.get(selectedCategory?.id ?? 0)!;
  const customLabel = start && end ? `${formatMatchDate(start)} — ${formatMatchDate(end)}` : 'Escolher período';
  const filterKey = [phase, filtroCategoria, filtroStatus, period, start, end, opponent, mando, sortCategory].join('|');
  const chips = [
    { id: 'search', label: opponent ? `Busca: ${opponent}` : '', clear: () => changeFilters({ busca: '' }) },
    { id: 'preparation', label: ['AGENDADA', 'PREPARADA'].includes(filtroStatus) ? (filtroStatus === 'AGENDADA' ? 'Agendadas' : 'Preparadas') : '', clear: () => changeFilters({ status: 'PROXIMAS' }) },
    { id: 'period', label: period === 'custom' ? customLabel : period !== 'all' ? PERIODS.find(item => item.value === period)?.label || '' : '', clear: () => changeFilters({ periodo: '', de: '', ate: '' }) },
    { id: 'mando', label: mando === 'casa' ? 'Em casa' : mando === 'fora' ? 'Fora de casa' : '', clear: () => changeFilters({ mando: '' }) },
  ].filter(chip => chip.label);
  function renderMatch(match: Partida) {
    if (list && match.status !== 'AO_VIVO') return <MatchListRow key={match.id} partida={match} />;
    return <MatchCard key={match.id} partida={match} featured={match.status === 'AO_VIVO'} />;
  }

  function clearFilters() {
    changeFilters({ busca: '', status: ['AGENDADA', 'PREPARADA'].includes(filtroStatus) ? 'PROXIMAS' : filtroStatus, periodo: '', de: '', ate: '', local: '', mando: '', ordem: '' });
  }

  function renderSchedule(offset: number) {
    if (loading || loadError) return null;
    const category = phaseCategories[categoryIndex + offset];
    if (!category && (offset !== 0 || selectedCategory)) return null;
    const result = resultsByCategory.get(category?.id ?? 0);
    if (!result) return null;
    if (!result.filtered.length) return <div className="schedule-empty">
      <span><Icon name="calendar" size={28} /></span>
      <div><h2>{chips.length ? 'Nenhuma partida com estes filtros' : 'Nenhuma partida nesta categoria'}</h2>
        <p>{chips.length ? 'Remova algum filtro ou altere a busca para ver outros jogos.' : 'Escolha outro sub ou aguarde as próximas partidas do clube.'}</p></div>
      {!!chips.length && <Btn variant="ghost" onClick={clearFilters}>Limpar filtros</Btn>}
    </div>;
    const pageKey = `${category?.id ?? 0}:${filterKey}`;
    if (filtroStatus === 'TODAS') return <div className="schedule-results">
      <ScheduleAccordion key={`live:${pageKey}`} title="Ao vivo" icon="live" matches={result.live} initialOpen renderMatch={renderMatch} list={list} />
      <ScheduleAccordion key={`next:${pageKey}`} title="Próximas" icon="clock" matches={[...result.overdue, ...result.today, ...result.upcoming]} initialOpen renderMatch={renderMatch} list={list} />
      <ScheduleAccordion key={`past:${pageKey}`} title="Finalizadas" icon="checkAll" matches={result.finished} renderMatch={renderMatch} list={list} />
      <ScheduleAccordion key={`cancelled:${pageKey}`} title="Canceladas" icon="minus" matches={result.cancelled} renderMatch={renderMatch} list={list} />
    </div>;
    const ordered = filtroStatus === 'AO_VIVO' ? result.live
      : filtroStatus === 'FINALIZADA' ? result.finished
      : filtroStatus === 'CANCELADA' ? result.cancelled
      : [...result.overdue, ...result.today, ...result.upcoming];
    return <ScheduleResults key={pageKey} matches={ordered} renderMatch={renderMatch} list={list} grouped={filtroStatus !== 'AO_VIVO'} />;
  }

  return (
    <div className="match-schedule">
      <div className="page-header">
        <div><span className="eyebrow">DENTRO DA QUADRA</span><h1 className="page-title">Partidas</h1><p className="page-sub">{podeGerenciar ? 'Gerencie, acompanhe e consulte os resultados das partidas do clube.' : 'Acompanhe a agenda, os placares e os resultados do clube.'}</p></div>
        {podeGerenciar && <div className="schedule-header-actions"><Link className="btn btn-ghost btn-md" to="/partidas/solicitacoes"><Icon name="email" size={18}/>Solicitações</Link><Btn className="schedule-desktop-new" aria-label="Nova partida" title="Nova partida" onClick={openCreate}><Icon name="plus" size={18} />Nova partida</Btn></div>}
      </div>

      <HomeCategories categories={phaseCategories} phase={phase} selected={selectedCategory}
        label="Subcategoria das partidas"
        onPhase={value => changeFilters({ fase: value, categoria_id: '' })}
        onSelect={name => {
          const next = phaseCategories.find(category => category.nome === name);
          if (next) changeFilters({ categoria_id: String(next.id) });
        }} />
      <div className="schedule-status-summary" role="tablist" aria-label="Filtrar por situação">
        {LEGEND.map(item => <button type="button" key={item.id}
          role="tab" aria-selected={item.value === 'PROXIMAS' ? ['PROXIMAS', 'AGENDADA', 'PREPARADA'].includes(filtroStatus) : filtroStatus === item.value}
          tabIndex={(item.value === 'PROXIMAS' ? ['PROXIMAS', 'AGENDADA', 'PREPARADA'].includes(filtroStatus) : filtroStatus === item.value) ? 0 : -1}
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const index = LEGEND.indexOf(item);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? LEGEND.length - 1 : (index + (event.key === 'ArrowLeft' ? LEGEND.length - 1 : 1)) % LEGEND.length;
            changeFilters({ status: LEGEND[next].value });
            event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
          }}
          onClick={() => changeFilters({ status: item.value })}>
          {item.id === 'live' && <i className="schedule-live-dot" aria-hidden="true" />}{item.label}<span>{counts[item.id]}</span>
        </button>)}
      </div>

      <div className="schedule-filters">
        <div className="schedule-mobile-actions">
          {podeGerenciar && <Link className="btn btn-ghost schedule-mobile-requests" aria-label="Solicitações de partidas" to="/partidas/solicitacoes"><Icon name="email" size={18}/></Link>}
          <CollectionSearch className="schedule-mobile-search" label="Buscar partidas" placeholder="Time ou adversário" value={opponent} onChange={value => changeFilters({ busca: value })} />
          <CollectionFilterButton className="schedule-mobile-filter-button" count={chips.length} onClick={() => openFilters(true)} />
          <CollectionViewToggle className="schedule-view-toggle" label="Visualização das partidas" value={list ? 'lista' : 'cards'} onChange={value => changeFilters({ visualizacao: value === 'lista' ? 'lista' : '' })}
            options={[{ value: 'cards', label: 'Cards', icon: 'grid' }, { value: 'lista', label: 'Lista', icon: 'list' }]} />
          {podeGerenciar && <Btn className="schedule-mobile-new" aria-label="Nova partida" title="Nova partida" onClick={openCreate}><Icon name="plus" size={18}/><span>Nova partida</span></Btn>}
        </div>
        <div className="schedule-filter-primary">
          <CollectionSearch className="schedule-search" id="match-search" label="Buscar time, adversário ou local" placeholder="Buscar time, adversário ou local…" value={opponent} onChange={value => changeFilters({ busca: value })} />
          <FilterSelect label="Período" emptyLabel="Todos os períodos" options={[...PERIODS.filter(item => item.value !== 'all'), { value: 'custom', label: period === 'custom' ? customLabel : 'Personalizado…' }]}
            value={period === 'all' ? '' : period} onChange={value => value === 'custom' ? setPeriodOpen(true) : changeFilters({ periodo: value, de: '', ate: '' })} />
        <FilterSelect label="Ordenar por" emptyLabel="Por horário" options={[{ value: 'categoria', label: 'Por categoria' }]} value={sortCategory ? 'categoria' : ''} onChange={value => changeFilters({ ordem: value })} />
          <CollectionFilterButton label="Mais filtros" count={Number(['AGENDADA', 'PREPARADA'].includes(filtroStatus)) + Number(!!mando)} onClick={() => openFilters()} />
        </div>
      </div>

      <div className="schedule-results-toolbar">
        <p className="schedule-result-count" role="status">{loading ? 'Carregando partidas…' : `${filtered.length} ${filtered.length === 1 ? 'partida' : 'partidas'}`}</p>
        <div className="schedule-active-filters" data-empty={!chips.length} aria-label="Filtros ativos" aria-hidden={!chips.length || undefined}>
          {chips.map(chip => <button type="button" key={chip.id} onClick={chip.clear} title={chip.label} aria-label={`Remover filtro ${chip.label}`}><span>{chip.label}</span><Icon name="minus" size={14} /></button>)}
          <button type="button" className="schedule-clear" onClick={clearFilters}>Limpar tudo</button>
        </div>
        {!compactViewport && <CollectionViewToggle className="schedule-view-toggle" label="Visualização das partidas" value={list ? 'lista' : 'cards'} onChange={value => changeFilters({ visualizacao: value === 'lista' ? 'lista' : '' })}
          options={[{ value: 'cards', label: 'Cards', icon: 'grid' }, { value: 'lista', label: 'Lista', icon: 'list' }]} />}
      </div>

      {loadWarning && <div className="schedule-load-warning" role="status"><Icon name="filters" size={20} /><div><strong>Algumas opções não carregaram</strong><p>{loadWarning}</p></div><Btn variant="ghost" size="sm" onClick={carregar}>Atualizar</Btn></div>}
      {loading ? <Spinner /> : loadError ? <div className="schedule-load-error" role="alert"><span><Icon name="ball" size={26} /></span><div><strong>Não foi possível carregar a agenda</strong><p>{loadError}</p></div><Btn onClick={carregar}>Tentar novamente</Btn></div> : null}
      {renderSchedule(0)}

      {periodOpen && <SchedulePeriodDialog inicio={range.inicio} fim={range.fim} onClose={() => setPeriodOpen(false)}
        onApply={(inicio, fim) => { changeFilters({ periodo: 'custom', de: inicio, ate: fim }); setPeriodOpen(false); }} />}
      <CollectionFilterDialog open={moreOpen} title={mobileFilters ? 'Filtrar partidas' : 'Mais filtros'} className={`schedule-more-dialog${mobileFilters ? ' schedule-all-filters-dialog' : ''}`} onClose={() => setMoreOpen(false)}
        onClear={resetDraft} onApply={applyFilters}>
        <div className="schedule-filter-fields">
        {mobileFilters && <>
          <CollectionSearch label="Buscar time, adversário ou local" placeholder="Buscar time, adversário ou local…" value={draftSearch} onChange={setDraftSearch} />
          <FilterChoices label="Período" value={draftPeriod} onChange={setDraftPeriod} options={[
            { value: '', label: 'Todos' }, { value: 'today', label: 'Hoje' }, { value: 'week', label: 'Semana' },
            { value: 'month', label: 'Mês' }, { value: 'custom', label: 'Intervalo', icon: 'calendar' },
          ]} />
          {draftPeriod === 'custom' && <div className="schedule-custom-range">
            <Input label="De" type="date" value={draftStart} onChange={event => setDraftStart(event.target.value)} />
            <Input label="Até" type="date" value={draftEnd} onChange={event => setDraftEnd(event.target.value)} />
          </div>}
        </>}
        {['TODAS', 'PROXIMAS', 'AGENDADA', 'PREPARADA'].includes(filtroStatus) && <FilterChoices label="Preparação" value={draftStatus} onChange={setDraftStatus} options={[
          { value: filtroStatus === 'TODAS' ? 'TODAS' : 'PROXIMAS', label: filtroStatus === 'TODAS' ? 'Todas as situações' : 'Todas as próximas' }, { value: 'AGENDADA', label: 'Agendadas' }, { value: 'PREPARADA', label: 'Preparadas' },
        ]} />}
        <FilterChoices label="Mando de campo" value={draftMando} onChange={setDraftMando} options={[
          { value: '', label: 'Casa e fora' }, { value: 'casa', label: 'Em casa', icon: 'home' }, { value: 'fora', label: 'Fora', icon: 'bus' },
        ]} />
        {mobileFilters && <>
          <FilterChoices label="Ordenar" value={draftSort} onChange={setDraftSort} options={[
            { value: '', label: 'Por horário', icon: 'clock' }, { value: 'categoria', label: 'Por categoria' },
          ]} />
        </>}
        {filterError && <p className="schedule-filter-error" role="alert">{filterError}</p>}
        </div>
      </CollectionFilterDialog>
      <Modal open={modal && !reviewOpen} onClose={() => { if (!salvando) setModal(false); }} title="Organizar partida" className="schedule-create-dialog"
        footer={<div className="schedule-create-actions"><Btn variant="ghost" type="button" onClick={() => setModal(false)}>Cancelar</Btn><Btn type="submit" form="schedule-create-form"><Icon name="checkAll" size={17} />Organizar partida</Btn></div>}>
        <form id="schedule-create-form" onSubmit={revisarPartida} className="schedule-create-form" noValidate>
          <div className="schedule-create-top">
            <div className="schedule-create-club"><ClubBadge src={clube?.escudo} name={clube?.nome} size={44} /><strong>{clube?.nome || 'Seu clube'}</strong></div>
            <button className="schedule-create-sub" type="button" aria-label="Selecionar categoria da partida" aria-haspopup="dialog" onClick={() => openPicker('categoria')}>{formCategory?.nome || 'Categoria'}<Icon name="chevronRight" size={17} /></button>
          </div>
          <div className="field"><span className="field-label">Competição</span><button className="schedule-create-competition" type="button" aria-haspopup="dialog" onClick={() => openPicker('competicao')}><Icon name="trophy" size={21} /><span>{formCompetition?.nome || (form.competicao_id === 'amistoso' ? 'Amistoso' : 'Selecionar competição')}</span><Icon name="chevronRight" size={17} /></button></div>
          <section className="schedule-create-matchup" aria-labelledby="matchup-title"><h3 id="matchup-title">Confronto</h3><div>
            <div className="schedule-create-team schedule-fixed-team" data-selected={!!fixedTeam} aria-label={`Seu clube: ${clube?.nome || 'Clube atual'}`}>
              <ClubBadge src={fixedTeam?.escudo || fixedTeam?.clubeRepresentado?.escudo || clube?.escudo} name={fixedTeam?.nome || clube?.nome} size={48} />
              <small>SEU CLUBE</small>
              <strong>{teamName(fixedTeam?.nome || clube?.nome || 'Seu clube')}</strong>
              <span className="schedule-create-fixed"><Icon name="shield" size={13} />{form.emCasa === 'true' ? 'Mandante' : 'Visitante'} · fixo</span>
            </div>
            <button className="schedule-create-team" data-selected={!!selectedOpponent} type="button" aria-label={`Selecionar adversário${selectedOpponent ? `: ${teamName(selectedOpponent.nome)}` : ''}`} aria-haspopup="dialog" onClick={() => {
              if (!form.categoria_id) { openPicker('categoria'); return; }
              if (!fixedTeam) { setErro('Cadastre um time do seu clube nesta categoria antes de escolher o adversário.'); return; }
              openPicker('visitante');
            }}>
              {selectedOpponent ? <ClubBadge src={selectedOpponent.escudo || selectedOpponent.clubeRepresentado?.escudo} name={selectedOpponent.nome} size={48} /> : <span className="schedule-create-add"><Icon name="plus" size={26} /></span>}
              <small>ADVERSÁRIO</small><strong>{selectedOpponent ? teamName(selectedOpponent.nome) : 'Selecionar time'}</strong>
              {selectedOpponent && <span className="schedule-create-change"><Icon name="switchClub" size={13} />Trocar adversário</span>}
            </button>
            <span className="schedule-create-vs" aria-hidden="true">VS</span>
          </div></section>
          {!fixedTeam && form.categoria_id && <InfoNotice title="Time do clube indisponível">Vincule exatamente um time do {clube?.nome} a esta categoria em Times para organizar a partida.</InfoNotice>}
          <fieldset className="schedule-venue-choice"><legend>Mando de campo</legend><div>
            <button type="button" aria-pressed={form.emCasa === 'true'} onClick={() => changeVenue(true)}><Icon name="home" size={17} />Em casa</button>
            <button type="button" aria-pressed={form.emCasa !== 'true'} onClick={() => changeVenue(false)}><Icon name="bus" size={17} />Fora</button>
          </div></fieldset>
          <InfoNotice title={form.emCasa === 'true' ? 'Seu clube é o mandante' : 'Seu clube é o visitante'}>{form.emCasa === 'true' ? 'O adversário será o visitante. Para jogar na casa dele, escolha Fora.' : 'O adversário será o mandante. Seu clube continua selecionado à esquerda.'}</InfoNotice>
          <div className="schedule-create-date">
            <MatchDateField min={minimumDate} value={form.data} onChange={data => { setForm(f => ({ ...f, data })); setErro(''); }}/>
            <MatchTimeField value={form.horario} onChange={horario => { setForm(f => ({ ...f, horario })); setErro(''); }}/>
          </div>
          <LocationInput value={form.local} onChange={local => setForm(f => ({ ...f, local }))}/>
          {formCompetition && <Input label="Rodada · opcional" type="number" min="1" step="1" value={form.rodada} onChange={e => { setForm(f => ({ ...f, rodada: e.target.value })); setErro(''); }} />}
          {erro && <p className="schedule-create-error" role="alert">{erro}</p>}
        </form>
      </Modal>
      <Modal open={!!picker && modal} onClose={() => setPicker(null)} title={picker === 'categoria' ? 'Categoria da partida' : picker === 'competicao' ? 'Selecionar competição' : 'Selecionar adversário'}
        className={`schedule-picker-dialog${picker === 'categoria' ? ' schedule-category-dialog' : ''}`}
        footer={picker === 'categoria' ? <Btn type="button" disabled={!categorias.some(category => String(category.id) === draftCategoryId)} onClick={chooseCategory}>Usar categoria</Btn> : undefined}>
        {picker === 'categoria' ? <div className="schedule-category-options">
          <p>{formHome || formAway ? 'Ao mudar de categoria, o time do seu clube será atualizado. Escolha novamente o adversário e a competição.' : 'Selecione a categoria em que a partida será criada.'}</p>
          <div className="schedule-category-groups" role="radiogroup" aria-label="Categoria da partida"
            onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
              const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? buttons.length - 1 : 1)) % buttons.length;
              buttons[next]?.click();
              buttons[next]?.focus();
            }}>
            {['INICIACAO', 'BASE'].filter(phase => categoryChoices.some(category => category.tipo === phase)).map(phase => <section className="schedule-category-group" key={phase}>
              <h3>{phase === 'BASE' ? 'Base' : 'Iniciação'}</h3>
              <div>{categoryChoices.filter(category => category.tipo === phase).map(category => <button
                type="button" role="radio" key={category.id} aria-checked={draftCategoryId === String(category.id)}
                tabIndex={draftCategoryId === String(category.id) || !categoryChoices.some(item => String(item.id) === draftCategoryId) && category.id === categoryChoices[0]?.id ? 0 : -1}
                onClick={() => setDraftCategoryId(String(category.id))}>
                {category.nome.toUpperCase()}{draftCategoryId === String(category.id) && <Icon name="checkAll" size={16} />}
              </button>)}</div>
            </section>)}
          </div>
          {!categorias.length && <p className="schedule-picker-empty">Nenhuma categoria disponível. Cadastre as categorias do clube antes de organizar uma partida.</p>}
        </div> : <div className="schedule-picker-content">
          <p className="schedule-picker-intro">{picker === 'competicao' ? 'Vincule uma competição ou escolha Amistoso para jogar sem competição.' : <>Escolha quem enfrenta o <strong>{clube?.nome}</strong> no <strong>{formCategory?.nome.toUpperCase()}</strong>. Seu clube já está incluído no confronto.</>}</p>
          <CollectionSearch label={picker === 'competicao' ? 'Buscar competição ou ano' : 'Buscar adversário'} placeholder={picker === 'competicao' ? 'Nome da competição ou ano' : 'Nome do adversário'} value={pickerSearch} onChange={setPickerSearch} />
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
              {erro && <p className="notice-error" role="alert">{erro}</p>}
              {visibleOpponents.map(item => {
                const selected = item.id === selectedOpponent?.id;
                return <button key={item.id} type="button" aria-pressed={selected} onClick={() => chooseTeam(item.id)}>
                  <ClubBadge src={item.escudo || item.clubeRepresentado?.escudo} name={item.nome} size={42} />
                  <span><strong>{teamName(item.nome)}</strong><small><Icon name={item.clube_representado_id ? 'shield' : 'team'} size={13} />{item.clube_representado_id ? 'Clube Ludora' : 'Adversário cadastrado'} · {formCategory?.nome.toUpperCase()}</small></span>
                  <Icon name={selected ? 'checkAll' : 'chevronRight'} size={18} />
                </button>;
              })}
              {!visibleOpponents.length && <p className="schedule-picker-empty"><Icon name="search" size={22} />{pickerSearch ? 'Nenhum adversário encontrado. Tente outro nome ou limpe a busca.' : 'Nenhum adversário cadastrado nesta categoria. Cadastre um time em Times para continuar.'}</p>}
            </>}
          </div>
        </div>}
      </Modal>
      <Modal open={reviewOpen} onClose={() => { if (!salvando) setReviewOpen(false); }} title="Revisar partida" className="schedule-review-dialog">
        <div className="schedule-review">{selectedOpponent?.clube_representado_id && selectedOpponent.clube_representado_id !== clube?.id && <p role="note">O adversário está no Ludora. O confronto será criado após o aceite do outro clube.</p>}<p>Confira principalmente a categoria antes de confirmar.</p><section className="schedule-review-category"><span>Categoria da partida</span><strong>{formCategory?.nome || 'Não informada'}</strong><small>{formCategory?.tipo === 'BASE' ? 'Base' : 'Iniciação'}</small></section><dl>
          <div><dt>Clube</dt><dd>{clube?.nome || 'Seu clube'}</dd></div><div><dt>Competição</dt><dd>{formCompetition?.nome || 'Amistoso'}</dd></div><div><dt>Mandante</dt><dd>{teamName(formHome?.nome || '')}</dd></div><div><dt>Visitante</dt><dd>{teamName(formAway?.nome || '')}</dd></div><div><dt>Data</dt><dd>{formatMatchDate(form.data)}</dd></div><div><dt>Horário</dt><dd>{form.horario}</dd></div><div><dt>Mando</dt><dd>{form.emCasa === 'true' ? 'Em casa' : 'Fora'}</dd></div><div><dt>Local</dt><dd>{form.local || 'Local não definido'}</dd></div>
        </dl>{erro && <p className="schedule-create-error" role="alert">{erro}</p>}<div className="schedule-review-actions"><Btn onClick={salvar} disabled={salvando}><Icon name="checkAll" size={17} />{salvando ? 'Salvando…' : selectedOpponent?.clube_representado_id && selectedOpponent.clube_representado_id !== clube?.id ? 'Enviar proposta' : 'Confirmar e criar'}</Btn><Btn variant="ghost" type="button" disabled={salvando} onClick={() => setReviewOpen(false)}>Voltar e editar</Btn></div></div>
      </Modal>
    </div>
  );
}
