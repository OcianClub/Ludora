import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useListState } from '../hooks/listMemory';
import { gerenciaCategoria } from '../utils/homeDashboard';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { BASE_URL, ApiResponseError, cachedJson, criarPartida, fetchTimes, fetchCategorias, fetchCompeticoes, type Partida, type Categoria, type GrupoAgendaWeb, type PartidaAgendaWeb } from '../services/api';
import { useWebAgenda } from '../hooks/useWebAgenda';
import { useMaintenance } from '../contexts/MaintenanceContext';
import { readLocal, writeLocal } from '../services/localState';
import { Btn, Modal, Input, LoadingSkeleton } from '../components/UI';
import { ClubBadge } from '../components/Brand';
import { MatchCompetitionPicker } from '../components/MatchCompetitionPicker';
import { MatchCreationReview } from '../components/MatchCreationReview';
import { MatchOpponentPicker } from '../components/MatchOpponentPicker';
import { ResponsivePanel } from '../components/ResponsivePanel';
import { useAuth } from '../contexts/AuthContext';
import { MatchCard, formatMatchDate } from '../components/MatchCard';
import { MatchActionsMenu } from '../components/MatchActionsMenu';
import { MatchListRow } from '../components/MatchListRow';
import { Icon, type IconName } from '../components/Icon';
import { BlockColumns } from '../components/BlockColumns';
import { FilterTabs } from '../components/FilterTabs';
import { FilterSelect } from '../components/FilterSelect';
import { Toggle } from '../components/Toggle';
import { SchedulePeriodDialog } from '../components/SchedulePeriodDialog';
import { intervaloAgenda, rotuloDiaAgenda, type PeriodoAgenda } from '../utils/scheduleFilters';
import { teamName } from '../utils/teamIdentity';
import { matchHasOwnTeam, selectMatchTeam } from '../utils/matchTeams';
import { CategoryFilter as HomeCategories } from '../components/CategoryFilter';
import { useClubCategory } from '../hooks/useClubCategory';
import { MatchDateField, MatchTimeField } from '../components/MatchDateTime';
import { LocationInput } from '../components/LocationInput';
import { InfoNotice } from '../components/InfoNotice';
import { CollectionSearch, CollectionFilterButton, CollectionViewToggle, CollectionFilterDialog, FilterRadioGroup } from '../components/CollectionToolbar';
import { useMatchRequests } from '../hooks/useMatchRequests';
import { agoraPartida, horarioPassado } from '../../../../packages/shared-types/src/matchSchedule';
import { useMatchOrganization } from '../hooks/useMatchOrganization';
import { adversariosRecentes, repetirConfronto } from '../utils/matchOrganization';
import './Partidas.css';
import './ScheduleCreate.css';
import './Dashboard.css';
import '../components/ResponsiveControls.css';

const STATUSES = [
  { value: 'TODAS', label: 'Todos' },
  { value: 'PROXIMAS', label: 'Próximas (agendadas e preparadas)' },
  { value: 'ATRASADAS', label: 'Atrasadas' },
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
type MatchDraft = { form: typeof FORM_VAZIO; savedAt: number };

function readMatchDraft(key: string) {
  const draft = readLocal<MatchDraft>(key);
  if (!draft) return;
  if (!Number.isFinite(draft.savedAt) || Date.now() - draft.savedAt > 7 * 24 * 60 * 60 * 1000 || !draft.form ||
      Object.keys(FORM_VAZIO).some(field => typeof draft.form[field as keyof typeof FORM_VAZIO] !== 'string')) {
    writeLocal(key, undefined);
    return;
  }
  return draft.form;
}
const normalizarBusca = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

function ScheduleResults({ matches, renderMatch, list, grouped, total, carregarMais, carregandoMais }: {
  matches: Partida[];
  renderMatch: (match: Partida) => ReactNode;
  list: boolean;
  grouped: boolean;
  total: number;
  carregarMais: () => void;
  carregandoMais: boolean;
}) {
  const showList = list && matches.some(match => match.status !== 'AO_VIVO');
  const groups = new Map<string, Partida[]>();
  matches.forEach(match => {
    const key = grouped ? match.data.slice(0, 7) : 'live';
    const games = groups.get(key);
    if (games) games.push(match);
    else groups.set(key, [match]);
  });
  return <div className={`schedule-results${showList ? ' schedule-list' : ''}`}>
    {[...groups].map(([day, games]) => <section className="schedule-date-group" key={day}>
      {grouped && <h2>{new Date(`${day}-01T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2>}
      <div className={`schedule-match-grid${showList ? ' is-list' : ''}`}>{games.map(renderMatch)}</div>
    </section>)}
    {total > matches.length && <Btn variant="ghost" className="schedule-show-more" loading={carregandoMais} onClick={carregarMais}>Mostrar mais partidas ({total - matches.length})</Btn>}
  </div>;
}

function ScheduleAccordion({ title, description, icon, matches, initialOpen = false, renderMatch, list, memoryKey, total, carregarMais, carregandoMais }: {
  memoryKey: string;
  title: string;
  description?: string;
  icon: IconName;
  matches: Partida[];
  initialOpen?: boolean;
  renderMatch: (match: Partida) => ReactNode;
  list: boolean;
  total: number;
  carregarMais: () => void;
  carregandoMais: boolean;
}) {
  const [open, setOpen] = useListState(`${memoryKey}:open`, initialOpen);
  const id = useId();
  if (!total) return null;
  return <section className="schedule-section schedule-status-section">
    <h2>
      <button id={`${id}-heading`} className="schedule-section-toggle" type="button" data-live={icon === 'live' || undefined}
        aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
        <span className="schedule-section-copy"><strong>
          <Icon name={icon} size={18} />
          <span className="schedule-section-title">{title}</span>
          <span className="schedule-section-count">{total}</span>
        </strong></span>
        <span className="schedule-section-chevron"><Icon name="chevronRight" size={17} /></span>
      </button>
    </h2>
    <div id={id} hidden={!open} role="region" aria-labelledby={`${id}-heading`}>
      {open && description && <p className="schedule-status-description">{description}</p>}
      {open && <ScheduleResults matches={matches} renderMatch={renderMatch} list={list} grouped={title !== 'Ao vivo'}
        total={total} carregarMais={carregarMais} carregandoMais={carregandoMais} />}
    </div>
  </section>;
}

export default function PartidasPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.pathname + location.search;
  const [searchParams, setSearchParams] = useSearchParams();
  const [compactViewport, setCompactViewport] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    const viewport = window.matchMedia('(max-width: 760px)');
    const update = () => setCompactViewport(viewport.matches);
    update();
    viewport.addEventListener('change', update);
    return () => viewport.removeEventListener('change', update);
  }, []);
  const { podeGerenciar, clube, token, modo, usuario } = useAuth();
  const { pauseFor, checking: checkingMaintenance, refresh: refreshMaintenance } = useMaintenance();
  const matchPause = pauseFor('CRIAR_PARTIDAS');
  const draftKey = podeGerenciar && usuario && clube ? `ludora:partida:${BASE_URL}:${usuario.id}:${clube.id}` : '';
  const requests = useMatchRequests();
  const escopoAgenda = JSON.stringify([clube?.id, usuario?.id, modo, token]);
  type Opcoes = { times: Awaited<ReturnType<typeof fetchTimes>>; competicoes: Awaited<ReturnType<typeof fetchCompeticoes>> };
  const [opcoes, setOpcoes] = useState<{ escopo: string; valor: Opcoes }>();
  const [categoriasEstado, setCategoriasEstado] = useState<{ escopo: string; valor: Categoria[]; erro?: string }>();
  const categorias = categoriasEstado?.escopo === escopoAgenda ? categoriasEstado.valor : [];
  const times = opcoes?.escopo === escopoAgenda ? opcoes.valor.times : [];
  const competicoes = opcoes?.escopo === escopoAgenda ? opcoes.valor.competicoes : [];
  const [opcoesCarregando, setOpcoesCarregando] = useState(false);
  const opcoesPedido = useRef<{ escopo: string; promise: Promise<Opcoes> }>();
  const escopoAtual = useRef(escopoAgenda);
  escopoAtual.current = escopoAgenda;
  const [modal, setModal] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [picker, setPicker] = useState<'categoria' | 'competicao' | 'visitante' | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null);
  const categoryValueId = useId();
  const [pickerSearch, setPickerSearch] = useState('');
  const [draftCategoryId, setDraftCategoryId] = useState('');
  const [form, setForm] = useState(FORM_VAZIO);
  const [repeatSource, setRepeatSource] = useState('');
  const organization = useMatchOrganization(modal && podeGerenciar, clube?.id, form.categoria_id, {
    mandante_id: form.mandante_id, visitante_id: form.visitante_id, data: form.data, horario: form.horario,
  });
  const [draftSaved, setDraftSaved] = useState(false);
  const initialForm = useRef(FORM_VAZIO);
  const previousDraft = useRef<typeof FORM_VAZIO>();
  const alternativeDraftKey = draftKey ? `${draftKey}:alternativo` : '';
  const activeDraftKey = useRef(draftKey);
  useEffect(() => {
    if (!modal || form === initialForm.current || !draftKey || ![draftKey, alternativeDraftKey].includes(activeDraftKey.current)) return;
    if (!form.visitante_id && !form.mandante_id && !form.data && !form.horario && !form.local && !form.competicao_id && !form.rodada) return;
    setDraftSaved(writeLocal(activeDraftKey.current, { form, savedAt: Date.now() }));
  }, [draftKey, alternativeDraftKey, form, modal]);

  function startDraft(next: typeof FORM_VAZIO, restored = false) {
    setRepeatSource('');
    initialForm.current = next;
    setForm(next);
    setDraftSaved(restored);
  }

  function discardDraft() {
    const own = ownTeam(filtroCategoria);
    writeLocal(activeDraftKey.current, undefined);
    previousDraft.current = undefined;
    setErro('');
    startDraft({ ...FORM_VAZIO, categoria_id: filtroCategoria, mandante_id: own ? String(own.id) : '' });
  }
  const [salvando, setSalvando] = useState(false);
  const savingRef = useRef(false);
  const [erro, setErro] = useState('');
  const [optionsWarning, setOptionsWarning] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [periodAnchor, setPeriodAnchor] = useState<HTMLButtonElement | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<HTMLButtonElement | null>(null);
  const [draftStatus, setDraftStatus] = useState('');
  const [draftMando, setDraftMando] = useState('');
  const [draftOrganizer, setDraftOrganizer] = useState('');
  const [mobileFilters, setMobileFilters] = useState(false);
  const [draftSearch, setDraftSearch] = useState('');
  const [draftPeriod, setDraftPeriod] = useState('');
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [draftSort, setDraftSort] = useState('');
  const [filterError, setFilterError] = useState('');
  const handledOpponent = useRef('');
  const requestedStatus = STATUSES.some(item => item.value === searchParams.get('status')) ? searchParams.get('status')! : '';
  const { phase, selected: selectedCategory } = useClubCategory(categorias, searchParams.get('categoria_id'), searchParams.get('fase'));
  const phaseCategories = useMemo(() => categorias.filter(category => category.tipo === phase)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })), [categorias, phase]);
  const filtroCategoria = selectedCategory ? String(selectedCategory.id) : '';
  const categoryIndex = Math.max(0, phaseCategories.indexOf(selectedCategory!));
  const opponent = searchParams.get('busca') || '';
  const mando = searchParams.get('mando') || '';
  const onlyOrganized = searchParams.get('organizadas') === 'clube';
  const period = ['today', 'week', 'month', 'custom'].includes(searchParams.get('periodo') || '') ? searchParams.get('periodo') as PeriodoAgenda : 'all';
  const start = searchParams.get('de') || '';
  const end = searchParams.get('ate') || '';
  const list = !compactViewport && searchParams.get('visualizacao') === 'lista';
  const sortCategory = searchParams.get('ordem') === 'categoria';
  const range = intervaloAgenda(period, start, end);
  const filtroStatus = requestedStatus || 'TODAS';
  const query = new URLSearchParams({ formato: 'web', por_situacao: 'true' });
  if (range.inicio && range.fim) {
    query.set('periodo', 'personalizado');
    query.set('de', range.inicio);
    query.set('ate', range.fim);
  } else query.set('todos_periodos', 'true');
  if (selectedCategory) query.set('categoria_exibida', selectedCategory.nome);
  if (opponent.trim()) query.set('busca', opponent.trim().slice(0, 100));
  if (mando === 'casa' || mando === 'fora') query.set('mando', mando);
  if (onlyOrganized) query.set('organizadas', 'true');
  if (filtroStatus === 'AGENDADA' || filtroStatus === 'PREPARADA') query.set('preparacao', filtroStatus);
  const agenda = useWebAgenda(clube?.id, token, modo, categoriasEstado?.escopo === escopoAgenda ? query.toString() : undefined);
  const loading = !!clube && (categoriasEstado?.escopo !== escopoAgenda || agenda.carregando);
  const loadError = agenda.erro;
  const loadWarning = agenda.aviso || categoriasEstado?.erro;

  function changeFilters(changes: Record<string, string>) {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
      return next;
    }, { replace: true, preventScrollReset: true });
  }

  function openFilters(anchor: HTMLButtonElement, mobile = false) {
    if (filterAnchor === anchor) { setFilterAnchor(null); return; }
    setMobileFilters(mobile);
    setDraftStatus(filtroStatus);
    setDraftMando(mando);
    setDraftOrganizer(onlyOrganized ? 'clube' : '');
    setDraftSearch(opponent);
    setDraftPeriod(period === 'all' ? '' : period);
    setDraftStart(range.inicio);
    setDraftEnd(range.fim);
    setDraftSort(sortCategory ? 'categoria' : '');
    setFilterError('');
    setFilterAnchor(anchor);
  }

  function applyFilters() {
    if (mobileFilters && draftPeriod === 'custom' && (!draftStart || !draftEnd || draftStart > draftEnd)) {
      setFilterError('Informe as duas datas. A data final deve ser igual ou posterior à inicial.');
      return;
    }
    changeFilters({ status: draftStatus, mando: draftMando, organizadas: draftOrganizer, ...(mobileFilters ? {
      busca: draftSearch,
      periodo: draftPeriod, de: draftPeriod === 'custom' ? draftStart : '',
      ate: draftPeriod === 'custom' ? draftEnd : '', ordem: draftSort,
    } : {}) });
    setFilterAnchor(null);
  }

  function resetDraft() {
    setDraftSearch('');
    setDraftPeriod('');
    setDraftStart('');
    setDraftEnd('');
    setDraftStatus(['AGENDADA', 'PREPARADA'].includes(filtroStatus) ? 'PROXIMAS' : filtroStatus);
    setDraftMando('');
    setDraftOrganizer('');
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

  async function carregarCategorias(signal?: AbortSignal) {
    if (!clube) return;
    const salvo = cachedJson<Categoria[]>('/categorias');
    if (salvo) setCategoriasEstado({ escopo: escopoAgenda, valor: salvo });
    try {
      const valor = await fetchCategorias(signal);
      if (!signal?.aborted && escopoAtual.current === escopoAgenda) setCategoriasEstado({ escopo: escopoAgenda, valor });
    } catch {
      if (!signal?.aborted && escopoAtual.current === escopoAgenda) setCategoriasEstado({ escopo: escopoAgenda,
        valor: salvo ?? [], erro: 'Os filtros de categoria estão temporariamente indisponíveis.' });
    }
  }
  async function carregarOpcoes() {
    if (!podeGerenciar || !clube) return;
    if (opcoes?.escopo === escopoAgenda) return opcoes.valor;
    if (opcoesPedido.current?.escopo !== escopoAgenda) {
      opcoesPedido.current = { escopo: escopoAgenda, promise: Promise.all([fetchTimes(), fetchCompeticoes()])
        .then(([times, competicoes]) => ({ times, competicoes })) };
    }
    const pedido = opcoesPedido.current;
    setOpcoesCarregando(true);
    setOptionsWarning(false);
    try {
      const valor = await pedido.promise;
      if (escopoAtual.current !== escopoAgenda) return;
      setOpcoes({ escopo: escopoAgenda, valor });
      return valor;
    } catch {
      if (escopoAtual.current === escopoAgenda) setOptionsWarning(true);
    } finally {
      if (opcoesPedido.current === pedido) opcoesPedido.current = undefined;
      if (escopoAtual.current === escopoAgenda) setOpcoesCarregando(false);
    }
  }
  async function retrySchedule() {
    if (retrying) return;
    setRetrying(true);
    try { await Promise.all([carregarCategorias(), agenda.recarregar(), optionsWarning ? carregarOpcoes() : undefined]); }
    finally { setRetrying(false); }
  }
  useEffect(() => {
    const controller = new AbortController();
    setOptionsWarning(false);
    setOpcoesCarregando(false);
    void carregarCategorias(controller.signal);
    return () => controller.abort();
  }, [escopoAgenda, token]);

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
    if (horarioPassado(form.data, form.horario)) return 'Este horário já passou. Escolha um horário futuro para a partida.';
    if (organization.conflito?.conflito) return organization.conflito.mensagem;
    if (form.competicao_id && form.competicao_id !== 'amistoso' && !competicoes.some(item => String(item.id) === form.competicao_id && item.tipo === categorias.find(category => String(category.id) === form.categoria_id)?.tipo)) return 'Escolha uma competição compatível com a categoria da partida.';
    if (form.competicao_id && form.competicao_id !== 'amistoso' && form.rodada && (!Number.isSafeInteger(Number(form.rodada)) || Number(form.rodada) < 1)) return 'Informe uma rodada inteira a partir de 1 ou deixe o campo vazio.';
    return '';
  }

  function revisarPartida(event: React.FormEvent) {
    event.preventDefault();
    if (matchPause) return;
    const validation = validarPartida();
    setErro(validation);
    if (!validation) setReviewOpen(true);
    else requestAnimationFrame(() => document.querySelector<HTMLElement>('.schedule-create-dialog [aria-invalid="true"], .schedule-create-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }

  async function salvar() {
    if (savingRef.current || matchPause) return;
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
      writeLocal(activeDraftKey.current, undefined);
      setReviewOpen(false); setModal(false);
      navigate(criada.solicitacao ? `/partidas/solicitacoes?id=${criada.solicitacao.id}` : `/partidas/${criada.id}`);
    } catch (error) {
      if (error instanceof ApiResponseError && error.status === 423) refreshMaintenance();
      setErro(error instanceof Error ? error.message : 'Não foi possível criar a partida.');
    } finally { savingRef.current = false; setSalvando(false); }
  }

  function openPicker(value: typeof picker, anchor?: HTMLElement) {
    const target = anchor ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    if (picker === value && pickerAnchor === target) { setPicker(null); return; }
    setPickerSearch('');
    if (value === 'categoria') setDraftCategoryId(form.categoria_id);
    setPickerAnchor(target);
    setPicker(value);
  }
  function ownTeam(categoryId: string, opcoesTimes = times) {
    const own = opcoesTimes.filter(team => String(team.categoria_id) === categoryId && team.clube_representado_id === clube?.id);
    return own.length === 1 ? own[0] : undefined;
  }
  async function openCreate() {
    if (matchPause || checkingMaintenance) return;
    const disponiveis = await carregarOpcoes();
    if (!disponiveis) return;
    const own = ownTeam(filtroCategoria, disponiveis.times);
    const draft = readMatchDraft(draftKey);
    activeDraftKey.current = draft ? draftKey : readMatchDraft(alternativeDraftKey) ? alternativeDraftKey : draftKey;
    const saved = draft ?? readMatchDraft(alternativeDraftKey);
    previousDraft.current = undefined;
    startDraft(saved ?? { ...FORM_VAZIO, categoria_id: filtroCategoria, mandante_id: own ? String(own.id) : '' }, !!saved);
    setErro('');
    setReviewOpen(false);
    setPicker(null);
    setModal(true);
  }
  async function organizeAgain(match: Partida) {
    if (!podeGerenciar || !clube || matchPause || checkingMaintenance) return;
    const disponiveis = await carregarOpcoes();
    if (!disponiveis) return;
    const next = repetirConfronto(match, disponiveis.times, categorias, disponiveis.competicoes, clube.id);
    if (!next) {
      await openCreate();
      setErro('O confronto anterior não está mais disponível. Selecione outro adversário.');
      return;
    }
    previousDraft.current = readMatchDraft(draftKey);
    activeDraftKey.current = previousDraft.current ? alternativeDraftKey : draftKey;
    startDraft(next);
    // This shortcut is already a useful draft, even before the first edit.
    setDraftSaved(writeLocal(activeDraftKey.current, { form: next, savedAt: Date.now() }));
    setRepeatSource(`${teamName(match.mandante?.nome || 'Mandante')} × ${teamName(match.visitante?.nome || 'Visitante')}`);
    setErro(''); setReviewOpen(false); setPicker(null); setModal(true);
  }
  useEffect(() => {
    const opponentId = searchParams.get('adversario_id');
    if (searchParams.get('organizar') !== '1' || checkingMaintenance || !podeGerenciar || !filtroCategoria) return;
    if (matchPause) {
      changeFilters({ organizar: '', adversario_id: '' });
      return;
    }
    const key = `${clube?.id}:${opponentId || 'own'}:${filtroCategoria}`;
    if (handledOpponent.current === key) return;
    if (opcoes?.escopo !== escopoAgenda) {
      void carregarOpcoes();
      return;
    }
    handledOpponent.current = key;
    const target = times.find(time => String(time.id) === opponentId && time.clube_representado_id !== clube?.id && !time.arquivado);
    const own = target ? ownTeam(String(target.categoria_id)) : undefined;
    previousDraft.current = readMatchDraft(draftKey);
    activeDraftKey.current = previousDraft.current ? alternativeDraftKey : draftKey;
    if (target && own) {
      const draft = previousDraft.current;
      if (draft && [draft.visitante_id, draft.mandante_id].includes(String(target.id))) {
        activeDraftKey.current = draftKey;
        startDraft(draft, true);
        previousDraft.current = undefined;
      } else {
        const alternative = readMatchDraft(alternativeDraftKey);
        const existing = alternative && [alternative.mandante_id, alternative.visitante_id].includes(String(target.id)) ? alternative : undefined;
        startDraft(existing ?? { ...FORM_VAZIO, categoria_id: String(target.categoria_id), mandante_id: String(own.id), visitante_id: String(target.id) }, !!existing);
      }
      setErro('');
    } else {
      startDraft({ ...FORM_VAZIO, categoria_id: filtroCategoria, mandante_id: ownTeam(filtroCategoria) ? String(ownTeam(filtroCategoria)!.id) : '' });
      setErro(opponentId ? 'O adversário não está mais disponível nesta categoria. Confira os times e selecione outro adversário.' : '');
    }
    setReviewOpen(false);
    setPicker(null);
    setModal(true);
    changeFilters({ organizar: '', adversario_id: '' });
    handledOpponent.current = '';
  }, [searchParams, opcoes, escopoAgenda, podeGerenciar, filtroCategoria, draftKey, matchPause, checkingMaintenance]);
  function chooseCategory(categoryId = draftCategoryId) {
    const category = categorias.find(c => String(c.id) === categoryId);
    if (category && String(category.id) !== form.categoria_id) {
      const own = ownTeam(String(category.id));
      setForm(f => ({ ...f, categoria_id: String(category.id), mandante_id: f.emCasa === 'true' && own ? String(own.id) : '', visitante_id: f.emCasa !== 'true' && own ? String(own.id) : '', competicao_id: '', rodada: '' }));
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
  const categoryHasDependencies = !!selectedOpponent || !!form.competicao_id;
  const confirmCategoryChange = categoryHasDependencies && !!draftCategoryId && draftCategoryId !== form.categoria_id;
  const draftCategory = categorias.find(category => String(category.id) === draftCategoryId);
  const availableOpponents = times.filter(team => !team.arquivado && String(team.categoria_id) === form.categoria_id && team.clube_representado_id !== clube?.id);
  const recentOpponentIds = adversariosRecentes(organization.contexto, times, Number(form.categoria_id), clube?.id || 0);
  const visibleOpponents = availableOpponents.filter(team => normalizarBusca(team.nome).includes(normalizarBusca(pickerSearch)))
    .sort((a, b) => Number(!!b.clube_representado_id) - Number(!!a.clube_representado_id)
      || a.nome.localeCompare(b.nome, 'pt-BR'));
  const minimumDate = agoraPartida().slice(0,10);
  const grupoSelecionado: GrupoAgendaWeb | undefined = ({
    AO_VIVO: 'ao_vivo', ATRASADAS: 'pendentes', PROXIMAS: 'agenda', FINALIZADA: 'finalizadas',
    CANCELADA: 'canceladas', AGENDADA: 'preparacao', PREPARADA: 'preparacao',
  } as const)[filtroStatus as 'AO_VIVO' | 'ATRASADAS' | 'PROXIMAS' | 'FINALIZADA' | 'CANCELADA' | 'AGENDADA' | 'PREPARADA'];
  function resumoDaCategoria(category?: Categoria) {
    const grupos = new Map<GrupoAgendaWeb, PartidaAgendaWeb[]>();
    const nome = (valor?: string) => valor?.trim().toUpperCase().replace(/ /g, '-');
    for (const partida of agenda.linhas) {
      if (category && partida.categoria_id !== category.id && nome(partida.categoria?.nome) !== nome(category.nome)) continue;
      const linhas = grupos.get(partida.grupo_agenda);
      if (linhas) linhas.push(partida);
      else grupos.set(partida.grupo_agenda, [partida]);
    }
    const total = (grupo: GrupoAgendaWeb) => {
      const porCategoria = new Map((grupos.get(grupo) ?? []).map(p => [nome(p.categoria?.nome), p.total_grupo]));
      return [...porCategoria.values()].reduce((soma, quantidade) => soma + quantidade, 0);
    };
    const live = total('ao_vivo'), overdue = total('pendentes'), next = total('agenda'), past = total('finalizadas'), cancelled = total('canceladas');
    const all = live + overdue + next + past + cancelled;
    return { grupos, total, selecionadas: grupoSelecionado ? total(grupoSelecionado) : all, counts: { all, live, overdue, next, past, cancelled } };
  }
  const resultado = resumoDaCategoria(selectedCategory);
  const counts = resultado.counts;
  const managesCurrentCategory = podeGerenciar && !!selectedCategory && gerenciaCategoria(clube,selectedCategory);
  const overdueTab = {id:'overdue' as const,value:'ATRASADAS',label:'Atrasadas'};
  const statusTabs = managesCurrentCategory
    ? [...LEGEND.slice(0,2),overdueTab,...LEGEND.slice(2)]
    : [...LEGEND.slice(0,4),overdueTab,...LEGEND.slice(4)];
  const customLabel = start && end ? `${formatMatchDate(start)} — ${formatMatchDate(end)}` : 'Escolher período';
  const filterKey = [phase, filtroCategoria, filtroStatus, period, start, end, opponent, mando, onlyOrganized, sortCategory].join('|');
  const chips = [
    { id: 'organizer', label: onlyOrganized ? 'Organizadas pelo meu clube' : '', clear: () => changeFilters({ organizadas: '' }) },
    { id: 'search', label: opponent ? `Busca: ${opponent}` : '', clear: () => changeFilters({ busca: '' }) },
    { id: 'preparation', label: ['AGENDADA', 'PREPARADA'].includes(filtroStatus) ? (filtroStatus === 'AGENDADA' ? 'Agendadas' : 'Preparadas') : '', clear: () => changeFilters({ status: 'PROXIMAS' }) },
    { id: 'period', label: period === 'custom' ? customLabel : period !== 'all' ? PERIODS.find(item => item.value === period)?.label || '' : '', clear: () => changeFilters({ periodo: '', de: '', ate: '' }) },
    { id: 'mando', label: mando === 'casa' ? 'Em casa' : mando === 'fora' ? 'Fora de casa' : '', clear: () => changeFilters({ mando: '' }) },
  ].filter(chip => chip.label);
  function renderMatch(match: Partida) {
    const oficialId = competicoes.find(c => c.id === match.competicao_id)?.paulista_evento_id;
    if (oficialId) match = { ...match, paulista_evento_id: oficialId };
    const canRepeat = podeGerenciar && clube && match.status !== 'AO_VIVO' && !match.semPerspectiva && !matchPause && !checkingMaintenance
      && (opcoes?.escopo !== escopoAgenda || repetirConfronto(match, times, categorias, competicoes, clube.id));
    const repeatAction = canRepeat ? <button type="button" className="schedule-repeat-action" disabled={opcoesCarregando} data-tooltip={list ? 'Organizar novo confronto' : undefined} onClick={() => void organizeAgain(match)}><Icon name="copy" size={15}/><span>Organizar novo confronto</span></button> : undefined;
    if (list && match.status !== 'AO_VIVO') return <MatchListRow key={match.id} partida={match} returnTo={returnTo} actions={canRepeat ? <MatchActionsMenu disabled={opcoesCarregando} onRepeat={() => void organizeAgain(match)} /> : undefined}/>;
    return <MatchCard key={match.id} partida={match} returnTo={returnTo} featured={match.status === 'AO_VIVO'} actions={repeatAction}/>;
  }

  function clearFilters() {
    changeFilters({ busca: '', status: ['AGENDADA', 'PREPARADA'].includes(filtroStatus) ? 'PROXIMAS' : filtroStatus, periodo: '', de: '', ate: '', local: '', mando: '', organizadas: '', ordem: '' });
  }

  function renderSchedule(offset: number) {
    if (loading || loadError) return null;
    const category = phaseCategories[categoryIndex + offset];
    if (!category && (offset !== 0 || selectedCategory)) return null;
    const result = resultado;
    const otherSubs = offset === 0 && !!opponent.trim() && !result.selecionadas
      ? categorias.filter(other => other.id !== category?.id).map(other => ({ other, total: resumoDaCategoria(other).selecionadas })).filter(item => item.total > 0)
      : [];
    if (!result.selecionadas) return <div className="schedule-empty">
      <span><Icon name="calendar" size={28} /></span>
      <div><h2>{chips.length ? 'Nenhuma partida com estes filtros' : 'Nenhuma partida nesta categoria'}</h2>
        <p>{chips.length ? 'Remova algum filtro ou altere a busca para ver outros jogos.' : 'Escolha outro sub ou aguarde as próximas partidas do clube.'}</p></div>
      {otherSubs.length > 0 && <div className="collection-suggestions" aria-label="Partidas em outros SUBs">
        {otherSubs.map(({ other, total }) => <Btn key={other.id} variant="ghost" size="sm" onClick={() => changeFilters({ fase: other.tipo, categoria_id: String(other.id) })}>{other.nome.toUpperCase()} ({total})</Btn>)}
      </div>}
      {!!chips.length && <Btn variant="ghost" onClick={clearFilters}>Limpar filtros</Btn>}
    </div>;
    const managesCategory = podeGerenciar && !!category && gerenciaCategoria(clube, category);
    const pageKey = `partidas:${usuario?.id ?? 'visitante'}:${clube?.id}:${category?.id ?? 0}:${managesCategory ? 'gestao' : 'publico'}:${filterKey}`;
    const propsGrupo = (grupo: GrupoAgendaWeb) => {
      const matches = result.grupos.get(grupo) ?? [];
      return {
        matches,
        total: result.total(grupo),
        carregarMais: () => {
          const categorias = new Map<string, { posicao: number; total: number }>();
          for (const partida of matches) {
            const nome = partida.categoria?.nome;
            if (!nome) continue;
            const posicao = Math.max(partida.posicao, categorias.get(nome)?.posicao ?? 0);
            categorias.set(nome, { posicao, total: partida.total_grupo });
          }
          const proxima = [...categorias].find(([, dado]) => dado.posicao < dado.total);
          if (proxima) agenda.carregarMais(grupo, proxima[0], proxima[1].posicao);
        },
        carregandoMais: agenda.carregandoMais,
        renderMatch,
        list,
      };
    };
    const toolbar = <div className="schedule-results-toolbar schedule-presentation-toolbar">
      <p className="schedule-result-count" role="status">{result.selecionadas} {result.selecionadas === 1 ? 'partida' : 'partidas'}</p>
      {!compactViewport && filtroStatus !== 'AO_VIVO' && <CollectionViewToggle label="Visualização das partidas" value={list ? 'lista' : 'cards'} onChange={value => changeFilters({ visualizacao: value === 'lista' ? 'lista' : '' })} options={[{ value: 'cards', label: 'Cards', icon: 'grid' }, { value: 'lista', label: 'Lista', icon: 'list' }]} />}
    </div>;
    if (filtroStatus === 'TODAS') return <div className="schedule-results">
      <ScheduleAccordion key={`live:${pageKey}`} memoryKey={`live:${pageKey}`} title="Ao vivo" icon="live" {...propsGrupo('ao_vivo')} initialOpen />
      {toolbar}
      {managesCategory && <ScheduleAccordion key={`overdue:${pageKey}`} memoryKey={`overdue:${pageKey}`} title="Atrasadas" icon="alert" {...propsGrupo('pendentes')} initialOpen />}
      <ScheduleAccordion key={`next:${pageKey}`} memoryKey={`next:${pageKey}`} title="Próximas" icon="clock" {...propsGrupo('agenda')} initialOpen />
      <ScheduleAccordion key={`past:${pageKey}`} memoryKey={`past:${pageKey}`} title="Finalizadas" icon="checkAll" {...propsGrupo('finalizadas')} />
      {!managesCategory && <ScheduleAccordion key={`overdue:${pageKey}`} memoryKey={`overdue:${pageKey}`} title="Atrasadas" description="O horário previsto passou, mas o início ainda não foi registrado." icon="clock" {...propsGrupo('pendentes')} />}
      <ScheduleAccordion key={`cancelled:${pageKey}`} memoryKey={`cancelled:${pageKey}`} title="Canceladas" icon="minus" {...propsGrupo('canceladas')} />
    </div>;
    return <>{toolbar}<ScheduleResults key={pageKey} {...propsGrupo(grupoSelecionado!)} grouped={filtroStatus !== 'AO_VIVO'} /></>;
  }

  return (
    <div className="match-schedule" data-status={filtroStatus}>
      <div className="page-header">
        <div><span className="eyebrow">DENTRO DA QUADRA</span><h1 className="page-title">Partidas</h1><p className="page-sub">{podeGerenciar ? 'Gerencie, acompanhe e consulte os resultados das partidas do clube.' : 'Acompanhe a agenda, os placares e os resultados do clube.'}</p></div>
        {podeGerenciar && <div className="schedule-header-actions"><Link className="btn btn-ghost btn-md" to="/partidas/solicitacoes"><Icon name="emailFill" size={18}/>Solicitações{requests > 0 && <span className="schedule-request-badge" aria-label={`${requests} solicitações aguardando resposta`}>{requests}</span>}</Link><Btn className="schedule-desktop-new" aria-label="Nova partida" data-tooltip="Nova partida" data-tooltip-icon-only loading={checkingMaintenance || opcoesCarregando} disabled={!!matchPause} aria-describedby={matchPause ? "schedule-maintenance" : undefined} onClick={openCreate}>{!checkingMaintenance && !opcoesCarregando && <Icon name="plus" size={18} />}Nova partida</Btn></div>}
      </div>

      <HomeCategories categories={phaseCategories} phase={phase} selected={selectedCategory}
        label="Subcategoria das partidas"
        onPhase={value => changeFilters({ fase: value, categoria_id: '' })}
        onSelect={name => {
          const next = phaseCategories.find(category => category.nome === name);
          if (next) changeFilters({ categoria_id: String(next.id) });
        }} />
      {podeGerenciar && matchPause && <p id="schedule-maintenance" className="maintenance-inline" role="status"><Icon name="alert" size={17} /><span>Criação de partidas em manutenção. {matchPause.motivo}</span></p>}
      <FilterTabs className="schedule-status-summary" label="Filtrar por situação"
        value={['AGENDADA', 'PREPARADA'].includes(filtroStatus) ? 'PROXIMAS' : filtroStatus}
        options={statusTabs.map(item => ({ ...item, count: counts[item.id], icon: item.id === 'live' && <i className="schedule-live-dot" aria-hidden="true" /> }))}
        onChange={status => changeFilters({ status })} />

      <div className="schedule-filters">
        <div className="schedule-mobile-actions">
          {podeGerenciar && <Link className="btn btn-ghost schedule-mobile-requests" aria-label="Solicitações de partidas" to="/partidas/solicitacoes"><Icon name="emailFill" size={18}/>{requests > 0 && <span className="schedule-request-badge">{requests}</span>}</Link>}
          <CollectionSearch className="schedule-mobile-search" label="Buscar partidas" placeholder="Time ou adversário" value={opponent} onChange={value => changeFilters({ busca: value })} />
          <CollectionFilterButton className="schedule-mobile-filter-button" count={chips.length} expanded={!!filterAnchor} onClick={event => openFilters(event.currentTarget, true)} />
          {podeGerenciar && <Btn className="schedule-mobile-new" aria-label="Nova partida" data-tooltip="Nova partida" data-tooltip-icon-only loading={checkingMaintenance || opcoesCarregando} disabled={!!matchPause} aria-describedby={matchPause ? "schedule-maintenance" : undefined} onClick={openCreate}>{!checkingMaintenance && !opcoesCarregando && <Icon name="plus" size={22}/>}<span className="schedule-mobile-new-label">Nova partida</span></Btn>}
        </div>
        <div className="schedule-filter-primary">
          <CollectionSearch className="schedule-search" id="match-search" label="Buscar time, adversário ou local" placeholder="Buscar time, adversário ou local…" value={opponent} onChange={value => changeFilters({ busca: value })} />
          <FilterSelect label="Período" emptyLabel="Todos os períodos" options={[...PERIODS.filter(item => item.value !== 'all'), { value: 'custom', label: period === 'custom' ? customLabel : 'Personalizado…' }]}
            value={period === 'all' ? '' : period} onChange={(value, trigger) => value === 'custom' ? setPeriodAnchor(trigger) : changeFilters({ periodo: value, de: '', ate: '' })} />
        <FilterSelect label="Ordenar por" emptyLabel="Por horário" options={[{ value: 'categoria', label: 'Por categoria' }]} value={sortCategory ? 'categoria' : ''} onChange={value => changeFilters({ ordem: value })} />
          <CollectionFilterButton label="Mais filtros" count={Number(['AGENDADA', 'PREPARADA'].includes(filtroStatus)) + Number(!!mando) + Number(onlyOrganized)} expanded={!!filterAnchor} onClick={event => openFilters(event.currentTarget)} />
        </div>
      </div>

        <div className="schedule-active-filters" data-empty={!chips.length} aria-label="Filtros ativos" aria-hidden={!chips.length || undefined}>
          {chips.map(chip => <button type="button" key={chip.id} onClick={chip.clear} aria-label={`Remover filtro ${chip.label}`}><span>{chip.label}</span><Icon name="minus" size={14} /></button>)}
          <button type="button" className="schedule-clear" onClick={clearFilters}>Limpar tudo</button>
        </div>

      {(loadWarning || optionsWarning) && <div className="schedule-load-warning" role="status"><Icon name="filters" size={20} /><div><strong>Algumas opções não carregaram</strong><p>{loadWarning || 'Algumas opções de criação estão temporariamente indisponíveis. A agenda continua disponível.'}</p></div><Btn variant="ghost" size="sm" loading={retrying} onClick={() => void retrySchedule()}>Atualizar</Btn></div>}
      {loading ? <LoadingSkeleton kind={list ? "table" : "cards"} label="Carregando partidas" /> : loadError ? <div className="schedule-load-error" role="alert"><span><Icon name="ball" size={26} /></span><div><strong>Não foi possível carregar a agenda</strong><p>{loadError}</p></div><Btn loading={retrying} onClick={() => void retrySchedule()}>Tentar novamente</Btn></div> : null}
      {renderSchedule(0)}

      {periodAnchor && <SchedulePeriodDialog anchor={periodAnchor} inicio={range.inicio} fim={range.fim} onClose={() => setPeriodAnchor(null)}
        onApply={(inicio, fim) => { changeFilters({ periodo: 'custom', de: inicio, ate: fim }); setPeriodAnchor(null); }} />}
      <CollectionFilterDialog open={!!filterAnchor} anchor={filterAnchor} title={mobileFilters ? 'Filtrar partidas' : 'Mais filtros'} className={`schedule-more-dialog${mobileFilters ? ' schedule-all-filters-dialog' : ''}`} onClose={() => setFilterAnchor(null)}
        onClear={resetDraft} onApply={applyFilters}>
        <div className="schedule-filter-fields">
        {mobileFilters && <>
          <CollectionSearch label="Buscar time, adversário ou local" placeholder="Buscar time, adversário ou local…" value={draftSearch} onChange={setDraftSearch} />
          <FilterRadioGroup label="Período" value={draftPeriod} onChange={setDraftPeriod} options={[
            { value: '', label: 'Todos' }, { value: 'today', label: 'Hoje' }, { value: 'week', label: 'Semana' },
            { value: 'month', label: 'Mês' }, { value: 'custom', label: 'Intervalo', icon: 'calendar' },
          ]} />
          {draftPeriod === 'custom' && <div className="schedule-custom-range">
            <Input label="De" type="date" value={draftStart} onChange={event => setDraftStart(event.target.value)} />
            <Input label="Até" type="date" value={draftEnd} onChange={event => setDraftEnd(event.target.value)} />
          </div>}
        </>}
        {podeGerenciar && <div className="filter-switch-row">
          <span>Somente partidas organizadas pelo meu clube</span>
          <Toggle label="Somente partidas organizadas pelo meu clube" checked={draftOrganizer === 'clube'}
            onChange={checked => setDraftOrganizer(checked ? 'clube' : '')} />
        </div>}
        {<FilterRadioGroup label="Preparação" value={draftStatus} onChange={setDraftStatus} options={[
          { value: 'TODAS', label: 'Todas as situações' }, { value: 'AGENDADA', label: 'Agendadas' }, { value: 'PREPARADA', label: 'Preparadas' },
        ]} />}
        <FilterRadioGroup label="Mando de campo" value={draftMando} onChange={setDraftMando} options={[
          { value: '', label: 'Casa e fora' }, { value: 'casa', label: 'Em casa', icon: 'home' }, { value: 'fora', label: 'Fora', icon: 'bus' },
        ]} />
        {mobileFilters && <>
          <FilterRadioGroup label="Ordenar" value={draftSort} onChange={setDraftSort} options={[
            { value: '', label: 'Por horário', icon: 'clock' }, { value: 'categoria', label: 'Por categoria' },
          ]} />
        </>}
        {filterError && <p className="schedule-filter-error" role="alert">{filterError}</p>}
        </div>
      </CollectionFilterDialog>
      <Modal open={modal && !reviewOpen} onClose={() => { if (!salvando) setModal(false); }} title="Organizar partida" className="schedule-create-dialog"
        footer={<div className="schedule-create-actions"><Btn variant="ghost" type="button" onClick={() => setModal(false)}>Cancelar</Btn><Btn type="submit" form="schedule-create-form" disabled={!!matchPause || !!organization.conflito?.conflito}><Icon name="checkAll" size={17} />Revisar partida</Btn></div>}>
        <form id="schedule-create-form" onSubmit={revisarPartida} className="schedule-create-form" noValidate>
          {matchPause && <p className="maintenance-inline" role="status">Criação de partidas em manutenção. {matchPause.motivo}</p>}
          {repeatSource && <p className="schedule-repeat-note" role="note">Novo confronto a partir de {repeatSource}. Escolha uma nova data e revise os dados.</p>}
          {draftSaved && <div className="schedule-draft"><span role="status">Rascunho salvo neste dispositivo</span><button type="button" onClick={discardDraft}>Descartar rascunho</button></div>}
          {previousDraft.current && <div className="schedule-draft"><span>Você tem outro rascunho salvo</span><button type="button" onClick={() => {
            const draft = previousDraft.current;
            if (!draft) return;
            previousDraft.current = undefined;
            setErro('');
            activeDraftKey.current = draftKey;
            startDraft(draft, true);
          }}>Retomar rascunho</button></div>}
          <section className="schedule-create-matchup" aria-labelledby="matchup-title">
          <header className="schedule-matchup-header">
            <h3 id="matchup-title">Confronto</h3>
            <div className="schedule-create-category"><button className="schedule-create-sub" type="button" aria-label="Selecionar categoria da partida" aria-describedby={categoryValueId} aria-haspopup="dialog" aria-expanded={picker === 'categoria'} onClick={event => openPicker('categoria', event.currentTarget)}><span id={categoryValueId}>{formCategory?.nome.toUpperCase() || 'Selecionar'}</span><Icon name="chevronRight" size={17} /></button></div>
          </header>
          <div>
            <div className="schedule-create-team schedule-fixed-team" data-selected={!!fixedTeam} aria-label={`Seu clube: ${clube?.nome || 'Clube atual'}`}>
              <ClubBadge src={fixedTeam?.escudo || fixedTeam?.clubeRepresentado?.escudo || clube?.escudo} name={fixedTeam?.nome || clube?.nome} size={48} />
              <small>Seu clube</small>
              <strong>{teamName(fixedTeam?.nome || clube?.nome || 'Seu clube')}</strong>
              <span className="schedule-create-fixed">{form.emCasa === 'true' ? 'Mandante' : 'Visitante'}</span>
            </div>
            <button className="schedule-create-team" data-selected={!!selectedOpponent} type="button" aria-label={`Selecionar adversário${selectedOpponent ? `: ${teamName(selectedOpponent.nome)}` : ''}`} aria-haspopup="dialog" aria-expanded={picker === 'visitante'} onClick={event => {
              if (!form.categoria_id) { openPicker('categoria', event.currentTarget); return; }
              if (!fixedTeam) { setErro('Cadastre um time do seu clube nesta categoria antes de escolher o adversário.'); return; }
              openPicker('visitante', event.currentTarget);
            }}>
              {selectedOpponent ? <ClubBadge src={selectedOpponent.escudo || selectedOpponent.clubeRepresentado?.escudo} name={selectedOpponent.nome} size={48} /> : <span className="schedule-create-add"><Icon name="plus" size={26} /></span>}
              <small>Adversário</small><strong>{selectedOpponent ? teamName(selectedOpponent.nome) : 'Selecionar time'}</strong>
              <span className="schedule-create-fixed">{form.emCasa === 'true' ? 'Visitante' : 'Mandante'}</span>
            </button>
            <span className="schedule-create-vs" aria-hidden="true">VS</span>
          </div></section>
          {!fixedTeam && form.categoria_id && <InfoNotice title="Time do clube indisponível">Vincule exatamente um time do {clube?.nome} a esta categoria em Times para organizar a partida.</InfoNotice>}
          <div className="schedule-match-settings">
          <div className="field"><span className="field-label">Competição</span><button className="schedule-create-competition" type="button" aria-haspopup="dialog" aria-expanded={picker === 'competicao'} onClick={event => openPicker('competicao', event.currentTarget)}><Icon name="trophy" size={21} /><span>{formCompetition?.nome || (form.competicao_id === 'amistoso' ? 'Amistoso' : 'Selecionar competição')}</span><Icon name="chevronRight" size={17} /></button></div>
          <fieldset className="schedule-venue-choice"><legend>Mando de campo</legend><div>
            <button type="button" aria-pressed={form.emCasa === 'true'} onClick={() => changeVenue(true)}><Icon name="home" size={17} />Em casa</button>
            <button type="button" aria-pressed={form.emCasa !== 'true'} onClick={() => changeVenue(false)}><Icon name="bus" size={17} />Fora</button>
          </div></fieldset>
          </div>
          {formCompetition && <Input label="Rodada · opcional" type="number" min="1" step="1" value={form.rodada} onChange={e => { setForm(f => ({ ...f, rodada: e.target.value })); setErro(''); }} />}
          <section className="schedule-match-agenda" aria-labelledby="match-agenda-title">
          <h3 id="match-agenda-title">Data e local</h3>
          <div className="schedule-create-date">
            <MatchDateField quickDates min={minimumDate} value={form.data} onChange={data => { setForm(f => ({ ...f, data })); setErro(''); }}/>
            <MatchTimeField value={form.horario} onChange={horario => { setForm(f => ({ ...f, horario })); setErro(''); }}/>
          </div>
          {(organization.verificando || organization.erro || organization.conflito?.conflito) && <div className="schedule-availability" role="status" data-conflict={!!organization.conflito?.conflito}>
            <Icon name={organization.conflito?.conflito ? 'maintenanceAlert' : 'clock'} size={16}/><span>{organization.verificando ? 'Conferindo o horário…' : organization.erro ? 'Não foi possível conferir agora. O horário será validado no envio.' : organization.conflito?.mensagem}
            {organization.conflito?.partidaId && <Link to={`/partidas/${organization.conflito.partidaId}`}>Ver partida</Link>}
            {organization.conflito?.propostaId && <Link to={`/partidas/solicitacoes?id=${encodeURIComponent(organization.conflito.propostaId)}`}>Ver proposta</Link>}</span>
          </div>}
          <LocationInput value={form.local} onChange={local => setForm(f => ({ ...f, local }))}/>
          {form.emCasa === 'true' && organization.contexto?.ultimoLocalCasa && form.local.trim() !== organization.contexto.ultimoLocalCasa.local && <button className="schedule-location-shortcut" type="button" onClick={() => setForm(f => ({ ...f, local: organization.contexto!.ultimoLocalCasa!.local }))}><Icon name="location" size={16}/><span>Usar local do último jogo em casa<small>{organization.contexto.ultimoLocalCasa.local}</small></span></button>}
          </section>
          {erro && <p className="schedule-create-error" role="alert">{erro}</p>}
        </form>
      </Modal>
      <ResponsivePanel anchor={picker && modal && !reviewOpen ? pickerAnchor : null} onClose={() => setPicker(null)} title={picker === 'categoria' ? 'Categoria da partida' : picker === 'competicao' ? 'Selecionar competição' : 'Selecionar adversário'}
        desktopModal={picker === 'visitante'} matchAnchorWidth={picker === 'competicao'}
        className={`schedule-selection-panel schedule-selection-${picker}`}
        footer={picker === 'categoria' && confirmCategoryChange ? <Btn type="button" disabled={!draftCategory} onClick={() => chooseCategory()}>Trocar para {draftCategory?.nome.toUpperCase()}</Btn> : undefined}>
        {picker === 'categoria' ? <div className="schedule-category-options">
          <div className="schedule-category-groups" role="radiogroup" aria-label="Categoria da partida"
            onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
              const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? buttons.length - 1 : 1)) % buttons.length;
              if (buttons[next]) setDraftCategoryId(buttons[next].dataset.categoryId || '');
              buttons[next]?.focus();
            }}>
            {['INICIACAO', 'BASE'].filter(phase => categoryChoices.some(category => category.tipo === phase)).map(phase => <section className="schedule-category-group" key={phase}>
              <h3>{phase === 'BASE' ? 'Base' : 'Iniciação'}</h3>
              <div>{categoryChoices.filter(category => category.tipo === phase).map(category => <button
                type="button" role="radio" key={category.id} data-category-id={category.id} aria-checked={draftCategoryId === String(category.id)}
                tabIndex={draftCategoryId === String(category.id) || !categoryChoices.some(item => String(item.id) === draftCategoryId) && category.id === categoryChoices[0]?.id ? 0 : -1}
                onClick={() => {
                  const value = String(category.id); setDraftCategoryId(value);
                  if (!categoryHasDependencies || value === form.categoria_id) chooseCategory(value);
                }}>
                {category.nome.toUpperCase()}{draftCategoryId === String(category.id) && <Icon name="checkAll" size={16} />}
              </button>)}</div>
            </section>)}
          </div>
          {confirmCategoryChange && <p className="schedule-category-warning" role="note">Trocar a categoria limpa o adversário e a competição. Data, horário, local e mando serão mantidos.</p>}
          {!categorias.length && <p className="schedule-picker-empty">Nenhuma categoria disponível. Cadastre as categorias do clube antes de organizar uma partida.</p>}
        </div> : picker === 'visitante' ? <MatchOpponentPicker key={form.categoria_id} clubName={clube?.nome || 'Seu clube'} categoryName={formCategory?.nome || ''} teams={visibleOpponents} recentIds={recentOpponentIds} selectedId={selectedOpponent?.id} search={pickerSearch} onSearch={setPickerSearch} onSelect={chooseTeam}/> : <MatchCompetitionPicker items={competicoes.filter(item=>!item.arquivada && !item.paulista_evento_id && (!formCategory || item.tipo===formCategory.tipo))} value={form.competicao_id} search={pickerSearch} onSearch={setPickerSearch} onSelect={value=>{setForm(f=>({...f,competicao_id:value,rodada:f.competicao_id===value ? f.rodada : ''}));setErro('');setPicker(null);}}/>}

      </ResponsivePanel>
      <MatchCreationReview open={reviewOpen} onClose={()=>setReviewOpen(false)} onConfirm={salvar}
        home={formHome} away={formAway} category={formCategory?.nome} phase={formCategory?.tipo}
        date={form.data} time={form.horario} competition={formCompetition?.nome || 'Amistoso'} local={form.local} atHome={form.emCasa==='true'}
        requiresApproval={!!selectedOpponent?.clube_representado_id && selectedOpponent.clube_representado_id!==clube?.id}
        opponent={teamName(selectedOpponent?.nome || 'outro clube')} busy={salvando} error={erro}
        conflict={organization.conflito?.conflito ? organization.conflito.mensagem : undefined} maintenance={matchPause?.motivo}/>

    </div>
  );
}
