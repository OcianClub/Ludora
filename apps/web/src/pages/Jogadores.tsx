import { useEffect, useRef, useState } from 'react';
import { requestJson, criarJogador, fetchCategorias, preverCategoria, ErroJogador,
  type Jogador, type Categoria, type ConflitoCamisa, type DadosJogador } from '../services/api';
import { Btn, Modal, Input, Spinner } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import './Jogadores.css';
import { Choice, PositionBadge, POSITIONS, normalizePosition } from '../components/CollectionControls';
import { BirthDateField } from '../components/BirthDateField';
import { formatCpf, digitsOnly, cleanName } from '../utils/playerForm';
import { Icon } from '../components/Icon';
import { InfoNotice } from '../components/InfoNotice';
import { PlayerShirtButton, PlayerShirtDialog } from '../components/PlayerShirtDialog';
import { Link, useSearchParams } from 'react-router-dom';
import { playerAge } from '../utils/playerAge';
import { CategoryFilter } from '../components/CategoryFilter';
import { useClubCategory } from '../hooks/useClubCategory';
import { CollectionSearch, CollectionFilterButton, CollectionViewToggle, CollectionFilterDialog } from '../components/CollectionToolbar';
import './Dashboard.css';
import '../components/ResponsiveControls.css';


const FORM_VAZIO = { nome: '', cpf: '', dtNasc: '', posicao: 'Alas', numCamisa: '' };
const PAGE_SIZE = 25;
const SORT_FIELDS = [
  { value: 'nome', label: 'Jogador' },
  { value: 'camisa', label: 'Camisa' },
  { value: 'posicao', label: 'Posição' },
  { value: 'idade', label: 'Idade' },
  { value: 'categoria', label: 'Categoria' },
] as const;
type SortField = typeof SORT_FIELDS[number]['value'];
type CategoryRows = { items: Jogador[]; loading: boolean; error: string };

export default function JogadoresPage() {
  const { podeGerenciar, clube } = useAuth();
  const [params, setParams] = useSearchParams();
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState({ position: '', shirt: '', sort: 'default', direction: 'asc' });
  const [smallScreen, setSmallScreen] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const [expandedSubs, setExpandedSubs] = useState<number[]>([]);
  const [categoryRows, setCategoryRows] = useState<Record<number, CategoryRows>>({});
  const categoryRequests = useRef(new Map<number, AbortController>());
  const refreshExpanded = useRef<number[] | null>(null);
  const [shirtPlayer, setShirtPlayer] = useState<Jogador | null>(null);
  const view = smallScreen ? 'lista' : params.get('visualizacao') || 'tabela';
  const listView = view === 'lista';
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const update = () => setSmallScreen(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  function setView(value: string) {
    setParams(current => {
      const next = new URLSearchParams(current);
      next.set('visualizacao', value);
      return next;
    }, { replace: true, preventScrollReset: true });
  }
  const [erroLista, setErroLista] = useState('');
  const changeFilter = (key: string, value: string) => setParams(current => {
    const next = new URLSearchParams(current);
    value ? next.set(key, value) : next.delete(key);
    next.delete('pagina');
    return next;
  }, { replace: true, preventScrollReset: true });
  const busca = params.get('busca') || '';
  const setBusca = (value: string) => changeFilter('busca', value);
  const { phase: tipo, selected: sharedCategory } = useClubCategory(categorias, params.get('categoria'), params.get('fase'));
  const setTipo = (value: string) => setParams(current => {
    const next = new URLSearchParams(current);
    next.set('fase', value);
    ['categoria', 'pagina', 'subs'].forEach(key => next.delete(key));
    return next;
  }, { replace: true, preventScrollReset: true });
  const [modal, setModal] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const savingRef = useRef(false);
  useEffect(() => {
    if ((!modal && !filtersOpen) || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty('--players-viewport-height', `${viewport.height}px`);
      root.style.setProperty('--players-viewport-top', `${viewport.offsetTop}px`);
      root.style.setProperty('--players-viewport-bottom', `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      ['height', 'top', 'bottom'].forEach(part => root.style.removeProperty(`--players-viewport-${part}`));
    };
  }, [modal, filtersOpen]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [conflito, setConflito] = useState<ConflitoCamisa | null>(null);
  const [previsao, setPrevisao] = useState<{ nascimento: string; categoria: Categoria; temporada: number } | null>(null);
  const [erroCategoria, setErroCategoria] = useState('');
  const [versao, setVersao] = useState(0);
  const position = params.get('posicao') || '', shirtFilter = params.get('camisa') || '', order = params.get('ordem') === 'desc' ? 'desc' : 'asc';
  const setPosition = (value: string) => changeFilter('posicao', value);
  const setShirtFilter = (value: string) => changeFilter('camisa', value);
  const sortField: SortField = SORT_FIELDS.some(field => field.value === params.get('ordenar_por')) ? params.get('ordenar_por') as SortField : 'nome';
  const manualSort = params.has('ordenar_por') || params.has('ordem');
  function openFilters() {
    setDraftFilters({ position, shirt: shirtFilter, sort: manualSort ? sortField : 'default', direction: order });
    setFiltersOpen(true);
  }
  function applyFilters() {
    setParams(current => {
      const next = new URLSearchParams(current);
      const changes = {
        posicao: draftFilters.position,
        camisa: draftFilters.shirt,
        ordenar_por: draftFilters.sort === 'default' ? '' : draftFilters.sort,
        ordem: draftFilters.sort === 'default' ? '' : draftFilters.direction,
      };
      Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
      next.delete('pagina');
      return next;
    }, { replace: true, preventScrollReset: true });
    setFiltersOpen(false);
  }
  function resetSort() {
    setParams(current => {
      const next = new URLSearchParams(current);
      ['ordenar_por', 'ordem', 'pagina'].forEach(key => next.delete(key));
      return next;
    }, { replace: true, preventScrollReset: true });
  }
  function setSort(field: string, direction = order) {
    setParams(current => {
      const next = new URLSearchParams(current);
      next.set('ordenar_por', field);
      next.set('ordem', direction);
      next.delete('pagina');
      return next;
    }, { replace: true, preventScrollReset: true });
  }
  const [notice, setNotice] = useState('');
  const [origin, setOrigin] = useState<Categoria | null>(null);
  const [counts, setCounts] = useState<{ categoria_id: number; total: number; semCamisa: number }[]>([]);
  const categoryFilter = sharedCategory ? String(sharedCategory.id) : '';
  const requestedPage = Number(params.get('pagina') || 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const baseQuery = new URLSearchParams({ busca, posicao: position, camisa: shirtFilter, ordem: order, ordenar_por: sortField, ...(!listView ? { fase: tipo } : {}) }).toString();
  const tableScope = `${clube?.id}:${baseQuery}:${versao}`;
  const tableCache = useRef(new Map<string, Jogador[]>());
  const tableMetadata = useRef<{ scope: string; counts: typeof counts; categories: Categoria[] }>();
  const query = new URLSearchParams({
    busca, posicao: position, camisa: shirtFilter, ordem: order, ordenar_por: sortField, ...(!listView ? { fase: tipo } : {}),
    ...(!listView && categoryFilter ? { categoria_id: categoryFilter } : {}),
  }).toString();
  const categoryScope = `${clube?.id}:${query}:${versao}`;
  const currentCategoryScope = useRef(categoryScope);
  currentCategoryScope.current = categoryScope;
  const previousClub = useRef(clube?.id);
  const listHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    tableCache.current.clear();
    tableMetadata.current = undefined;
  }, [tableScope]);

  function cacheTableRows(key: string, items: Jogador[]) {
    tableCache.current.delete(key);
    tableCache.current.set(key, items);
    if (tableCache.current.size > 12) tableCache.current.delete(tableCache.current.keys().next().value!);
  }

  useEffect(() => {
    if (previousClub.current !== clube?.id) {
      previousClub.current = clube?.id;
      setParams({}, { replace: true });
      setModal(false);
      setShirtPlayer(null);
      refreshExpanded.current = null;
      return;
    }
    if (!clube?.id) return;
    try {
      localStorage.setItem(`ludora_jogadores_filtros_${clube.id}`, JSON.stringify({ fase: tipo, categoria: categoryFilter }));
    } catch {}
  }, [clube?.id, tipo, categoryFilter, setParams]);

  useEffect(() => {
    const cached = tableMetadata.current?.scope === tableScope && tableCache.current.get(`${categoryFilter}:${page}`);
    if (!listView && cached && tableMetadata.current) {
      setJogadores(cached);
      setCounts(tableMetadata.current.counts);
      setCategorias(tableMetadata.current.categories);
      setLoading(false);
      setErroLista('');
      return;
    }
    let ativo = true;
    const controller = new AbortController();
    setLoading(true);
    setErroLista('');
    const timer = setTimeout(() => Promise.all([
      requestJson<typeof counts>(`/jogadores?resumo=true&${baseQuery}`, { signal: controller.signal }),
      listView || !categoryFilter ? Promise.resolve([] as Jogador[]) : requestJson<Jogador[]>(`/jogadores?${query}&limite=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}`, { signal: controller.signal }),
      fetchCategorias(),
    ])
      .then(([summary, players, categories]) => { if (ativo) {
        if (!Array.isArray(summary) || summary.some(row => !Number.isInteger(row.total) || !Number.isInteger(row.semCamisa))) throw new Error('Não foi possível carregar os totais dos jogadores. Tente novamente.');
        setCounts(summary);
        setJogadores(players);
        setCategorias(categories);
        tableMetadata.current = { scope: tableScope, counts: summary, categories };
        if (!listView && categoryFilter) cacheTableRows(`${categoryFilter}:${page}`, players);
      } })
      .catch(err => { if (ativo) setErroLista(err instanceof Error ? err.message : 'Não foi possível carregar os jogadores.'); })
      .finally(() => { if (ativo) setLoading(false); }), 200);
    return () => { ativo = false; clearTimeout(timer); controller.abort(); };
  }, [clube?.id, versao, query, page, listView, baseQuery, tableScope]);

  useEffect(() => {
    setCategoryRows({});
    if (!refreshExpanded.current) setExpandedSubs([]);
    const requests = categoryRequests.current;
    return () => {
      requests.forEach(controller => controller.abort());
      requests.clear();
    };
  }, [categoryScope, listView]);

  async function loadSub(id: number, more = false) {
    if (categoryRequests.current.has(id)) return;
    const scope = categoryScope;
    const previous = more ? categoryRows[id]?.items || [] : [];
    const controller = new AbortController();
    categoryRequests.current.set(id, controller);
    setCategoryRows(current => ({ ...current, [id]: { items: previous, loading: true, error: '' } }));
    const search = new URLSearchParams(query);
    search.set('categoria_id', String(id));
    search.set('limite', String(PAGE_SIZE));
    search.set('offset', String(previous.length));
    try {
      const items = await requestJson<Jogador[]>(`/jogadores?${search}`, { signal: controller.signal });
      if (scope !== currentCategoryScope.current || controller.signal.aborted) return;
      setCategoryRows(current => ({ ...current, [id]: { items: [...previous, ...items], loading: false, error: '' } }));
    } catch (error) {
      if (scope !== currentCategoryScope.current || controller.signal.aborted) return;
      setCategoryRows(current => ({ ...current, [id]: { items: previous, loading: false, error: error instanceof Error ? error.message : 'Não foi possível carregar este sub.' } }));
    } finally {
      if (categoryRequests.current.get(id) === controller) categoryRequests.current.delete(id);
    }
  }

  function toggleSub(id: number) {
    setExpandedSubs(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
    if (!expandedSubs.includes(id) && !categoryRows[id]) void loadSub(id);
  }

  function changePage(value: number) {
    setParams(current => {
      const next = new URLSearchParams(current);
      next.set('pagina', String(value));
      return next;
    }, { replace: true, preventScrollReset: true });
    listHeading.current?.focus({ preventScroll: true });
    listHeading.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  useEffect(() => {
    let ativo = true;
    setPrevisao(null); setErroCategoria('');
    if (!modal || !form.dtNasc) return;
    const timer = setTimeout(() => {
      preverCategoria(form.dtNasc).then(resultado => {
        if (ativo) setPrevisao({ ...resultado, nascimento: form.dtNasc });
      }).catch(err => { if (ativo) setErroCategoria(err.message); });
    }, 250);
    return () => { ativo = false; clearTimeout(timer); };
  }, [form.dtNasc, modal, clube?.id]);

  function abrir(categoria: Categoria | null = null) {
    setReviewOpen(false);
    setOrigin(categoria);
    setErro(''); setConflito(null); setPrevisao(null); setForm(FORM_VAZIO);
    setModal(true);
  }
  function alterar(campo: keyof typeof form, valor: string) {
    const sanitized = campo === 'cpf' ? formatCpf(valor) : campo === 'numCamisa' ? digitsOnly(valor).slice(0, 2) : campo === 'nome' ? cleanName(valor) : valor;
    setForm(f => ({ ...f, [campo]: sanitized })); setConflito(null); setErro('');
  }
  const categoriaPronta = previsao?.nascimento === form.dtNasc ? previsao : null;
  function validarAluno() {
    if (!form.nome.trim()) return 'Informe o nome completo do aluno.';
    if (digitsOnly(form.cpf).length !== 11) return 'Informe os 11 dígitos do CPF.';
    if (!categoriaPronta) return erroCategoria || 'Selecione uma data de nascimento válida e aguarde a identificação da categoria.';
    if (form.numCamisa && (Number(form.numCamisa) < 1 || Number(form.numCamisa) > 99)) return 'A camisa deve estar entre 1 e 99.';
    return '';
  }
  function revisarAluno() {
    const validation = validarAluno();
    setErro(validation);
    if (!validation) setReviewOpen(true);
  }
  async function salvar(confirmacao?: ConflitoCamisa) {
    if (savingRef.current) return;
    const validation = validarAluno();
    if (validation || !categoriaPronta) { setErro(validation); setReviewOpen(false); return; }
    savingRef.current = true;
    setErro(''); setSalvando(true);
    try {
      const dados: DadosJogador = { nome: form.nome, dtNasc: form.dtNasc, posicao: form.posicao,
        numCamisa: form.numCamisa === '' ? null : Number(form.numCamisa),
        cpf: form.cpf,
        ...(confirmacao ? { confirmar_camisa: { jogador_id: confirmacao.jogador_id, camisa_anterior: confirmacao.camisa_anterior } } : {}) };
      await criarJogador(dados);
      setNotice('Aluno salvo com sucesso.');
      setReviewOpen(false);
      setParams({ fase: categoriaPronta.categoria.tipo, categoria: String(categoriaPronta.categoria.id) }, { replace: true });
      setModal(false);
      setVersao(v => v + 1);
    } catch (err) {
      if (err instanceof ErroJogador && err.conflito) { setConflito(err.conflito); setReviewOpen(false); }
      else { setConflito(null); setErro(err instanceof Error ? err.message : 'Não foi possível salvar'); }
    } finally { savingRef.current = false; setSalvando(false); }
  }

  const blocos = categorias.filter(c => c.tipo === tipo).sort((a, b) =>
    Number(a.nome.replace(/\D/g, '')) - Number(b.nome.replace(/\D/g, '')));
  const allCategories = [...categorias].sort((a, b) => Number(a.nome.replace(/\D/g, '')) - Number(b.nome.replace(/\D/g, '')));
  const displayed = listView ? allCategories : blocos.filter(category => !categoryFilter || String(category.id) === categoryFilter);
  const totals = counts.filter(count => displayed.some(category => category.id === count.categoria_id));
  const total = totals.reduce((sum, count) => sum + count.total, 0);
  const missingShirts = totals.reduce((sum, count) => sum + count.semCamisa, 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedCategory = blocos.find(category => String(category.id) === categoryFilter);
  const categoryIndex = selectedCategory ? blocos.indexOf(selectedCategory) : 0;
  useEffect(() => {
    if (loading || erroLista) return;
    if ((!selectedCategory && blocos.length > 0) || (!listView && page > pages)) {
      setParams(current => {
        const next = new URLSearchParams(current);
        if (!selectedCategory && blocos[0]) next.set('categoria', String(blocos[0].id));
        next.delete('pagina');
        return next;
      }, { replace: true, preventScrollReset: true });
    }
  }, [loading, erroLista, selectedCategory?.id, blocos[0]?.id, listView, page, pages, setParams]);
  useEffect(() => {
    if (!listView || !selectedCategory || loading || erroLista || tableMetadata.current?.scope !== tableScope) return;
    const ids = refreshExpanded.current ?? [selectedCategory.id];
    refreshExpanded.current = null;
    setExpandedSubs(ids);
    ids.forEach(id => { if (!categoryRows[id]) void loadSub(id); });
  }, [listView, selectedCategory?.id, categoryScope, tableScope, loading, erroLista]);
  const filtered = Boolean(busca || position || shirtFilter);
  const extraFilterCount = [position, shirtFilter].filter(Boolean).length;
  function clearFilters() {
    setParams(current => { const next = new URLSearchParams(current); ['busca', 'posicao', 'camisa', 'pagina'].forEach(key => next.delete(key)); return next; }, { replace: true, preventScrollReset: true });
  }
  function chooseSub(value: string, scroll = true) {
    changeFilter('categoria', value);
    if (listView) {
      const id = Number(value);
      setExpandedSubs([id]);
      if (!categoryRows[id]) void loadSub(id);
      if (scroll) requestAnimationFrame(() => document.getElementById(`alunos-sub-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    }
  }
  function sortHeader(field: SortField, label: string) {
    const active = manualSort && sortField === field;
    const next = active ? order === 'asc' ? 'desc' : 'default' : 'asc';
    const action = next === 'default' ? 'restaurar ordenação padrão' : `ordenar em ordem ${next === 'asc' ? 'crescente' : 'decrescente'}`;
    return <th scope="col" aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button type="button" onClick={() => next === 'default' ? resetSort() : setSort(field, next)} aria-label={`${label}: ${action}`} title={action}>
        {label}
        <svg className="alunos-sort-icon" data-active={active} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {active ? <path d={order === 'asc' ? 'M12 19V5m-5 5 5-5 5 5' : 'M12 5v14m-5-5 5 5 5-5'} /> : <path d="m8 8 4-4 4 4m-8 8 4 4 4-4"/>}
        </svg>
      </button>
    </th>;
  }

  const currentPlayers = jogadores;
  const currentLoading = loading;
  const currentPage = page;
  const openedSubs = expandedSubs;
  function renderCategory(offset: number) {
    const selectedCategory = listView ? allCategories[0] : blocos[categoryIndex + offset];
    if (!selectedCategory) return null;
    const page = offset === 0 ? currentPage : 1;
    const cached = tableMetadata.current?.scope === tableScope ? tableCache.current.get(`${selectedCategory.id}:${page}`) : undefined;
    const jogadores = cached || (offset === 0 ? currentPlayers : []);
    const loading = offset === 0 ? currentLoading && !cached : !listView && !cached;
    const expandedSubs = offset === 0 ? openedSubs : [selectedCategory.id];
    const total = counts.filter(count => count.categoria_id === selectedCategory.id).reduce((sum, count) => sum + count.total, 0);
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    return (
    <section className={`alunos-directory${listView ? ' alunos-directory--list' : ''}`} aria-labelledby={`alunos-list-heading-${selectedCategory.id}`} aria-busy={loading}>
      <h2 id={`alunos-list-heading-${selectedCategory.id}`} className="sr-only" tabIndex={-1} ref={offset === 0 ? listHeading : undefined}>Lista de jogadores</h2>
      {erroLista ? <div role="alert" className="alunos-error">{erroLista}<Btn variant="ghost" onClick={() => setVersao(v => v + 1)}>Tentar novamente</Btn></div> : loading && (!jogadores.length || listView) ? <Spinner /> : listView ? <div className="alunos-sub-list">
        {allCategories.map(category => {
          const rows = categoryRows[category.id];
          const count = counts.find(value => value.categoria_id === category.id)?.total || 0;
          const expanded = expandedSubs.includes(category.id);
          return <section className="alunos-sub-group" key={category.id} id={offset === 0 ? `alunos-sub-${category.id}` : `alunos-preview-${selectedCategory.id}-${category.id}`}>
            <button className="alunos-sub-toggle" type="button" aria-expanded={expanded} aria-controls={`alunos-sub-panel-${selectedCategory.id}-${category.id}`} onClick={() => toggleSub(category.id)}>
              <Icon name="team" size={18}/><strong>{category.nome.toUpperCase()}</strong><span>{count} {count === 1 ? 'jogador' : 'jogadores'}</span><Icon name="chevronRight" size={18}/>
            </button>
            <div id={`alunos-sub-panel-${selectedCategory.id}-${category.id}`} hidden={!expanded}>
              {expanded && !!rows?.items.length && <ul className="alunos-list" aria-label={`Jogadores do ${category.nome.toUpperCase()}`}>
                {rows.items.map(aluno => {
                  const age = playerAge(aluno.dtNasc);
                  return <li key={aluno.id}>
                    <PlayerShirtButton player={aluno} editable={podeGerenciar} onClick={() => setShirtPlayer(aluno)} />
                    <div><Link className="alunos-player-link" to={`/jogadores/${aluno.id}`} state={{ from: `/jogadores?${params}` }}>{aluno.nome}</Link><p>{normalizePosition(aluno.posicao)} · {Number.isFinite(age) ? `${age} anos` : 'Idade não informada'}</p></div>
                    <Link className="student-open" to={`/jogadores/${aluno.id}`} state={{ from: `/jogadores?${params}` }} aria-label={`Abrir perfil de ${aluno.nome}`}><Icon name="chevronRight" size={18}/></Link>
                  </li>;
                })}
              </ul>}
              {rows?.loading && <p className="alunos-sub-message" role="status">Carregando jogadores…</p>}
              {rows?.error && <div className="alunos-error" role="alert">{rows.error}<Btn variant="ghost" onClick={() => void loadSub(category.id, !!rows.items.length)}>Tentar novamente</Btn></div>}
              {rows && !rows.loading && !rows.error && !rows.items.length && <p className="alunos-sub-message">Nenhum jogador encontrado neste sub.</p>}
              {rows && !rows.error && rows.items.length > 0 && rows.items.length < count && <button type="button" className="alunos-sub-more" disabled={rows.loading} onClick={() => void loadSub(category.id, true)}>Carregar mais jogadores<Icon name="chevronRight" size={16}/></button>}
            </div>
          </section>;
        })}
        {!blocos.length && <p className="alunos-sub-message">Nenhuma categoria disponível neste grupo.</p>}
      </div> : jogadores.length ? <>
        <div className="alunos-table-scroll" data-swipe-ignore role="region" aria-label="Tabela de jogadores, role horizontalmente para ver todas as colunas" tabIndex={0}>
        <table className="alunos-table">
          <caption className="sr-only">Jogadores de {selectedCategory?.nome.toUpperCase() || (tipo === 'BASE' ? 'Base' : 'Iniciação')}{!manualSort && '. Ordenação padrão por nome, de A a Z.'}</caption>
          <thead><tr>
            {sortHeader('camisa', 'Camisa')}
            {sortHeader('nome', 'Jogador')}
            {sortHeader('posicao', 'Posição')}
            {sortHeader('idade', 'Idade')}
            <th scope="col"><span className="sr-only">Acessar ficha</span></th>
          </tr></thead>
          <tbody>{jogadores.map(aluno => {
            const age = playerAge(aluno.dtNasc);
            const ageLabel = Number.isFinite(age) ? `${age} anos` : 'Idade não informada';
            return <tr key={aluno.id}>
              <td className="alunos-cell-shirt"><PlayerShirtButton player={aluno} editable={podeGerenciar} onClick={() => setShirtPlayer(aluno)} /></td>
              <td className="alunos-cell-name">
                <Link to={`/jogadores/${aluno.id}`} state={{ from: `/jogadores?${params}` }} className="alunos-player-link">{aluno.nome}</Link>
              </td>
              <td className="alunos-cell-position"><span><PositionBadge position={aluno.posicao}/>{normalizePosition(aluno.posicao)}</span></td>
              <td className="alunos-cell-age">{ageLabel}</td>
              <td className="alunos-cell-open"><Link className="student-open" to={`/jogadores/${aluno.id}`} state={{ from: `/jogadores?${params}` }} aria-label={`Abrir perfil de ${aluno.nome}`}><Icon name="chevronRight" size={18}/></Link></td>
            </tr>;
          })}</tbody>
        </table>
        </div>
        <nav className="alunos-pagination" aria-label="Páginas de jogadores">
          <p>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total} jogadores</p>
          {pages > 1 && <div>
            <Btn variant="ghost" disabled={loading || page <= 1} onClick={() => changePage(page - 1)} aria-label="Página anterior"><Icon name="chevronLeft" size={17}/></Btn>
            <span aria-live="polite">{page} de {pages}</span>
            <Btn variant="ghost" disabled={loading || page >= pages} onClick={() => changePage(page + 1)} aria-label="Próxima página"><Icon name="chevronRight" size={17}/></Btn>
          </div>}
        </nav>
      </> : <div className="alunos-directory-empty">
        <Icon name="team" size={28}/>
        <h3>{filtered ? 'Nenhum jogador encontrado' : 'Nenhum jogador neste grupo'}</h3>
        <p>{filtered ? 'Tente outro nome ou ajuste os filtros para ampliar a busca.' : 'Os jogadores cadastrados nesta faixa aparecerão aqui.'}</p>
        {filtered && <Btn variant="ghost" onClick={clearFilters}>Limpar filtros</Btn>}
      </div>}
    </section>
    );
  }

  return <div className="alunos-page">
    <div className="page-header">
      <div><h1 className="page-title">Jogadores</h1><p className="page-sub">Cadastros, camisas e categorias do {clube?.nome}.</p></div>
      {podeGerenciar && <Btn className="alunos-add" aria-label="+ Adicionar aluno" onClick={() => abrir(selectedCategory)}><Icon name="plus" size={16} /><span className="alunos-add-label">Adicionar aluno</span></Btn>}
    </div>
    {!listView && <CategoryFilter
      categories={categorias}
      phase={tipo}
      selected={selectedCategory || blocos[0]}
      onPhase={setTipo}
      onSelect={name => { const category = categorias.find(category => category.nome === name && category.tipo === tipo); if (category) chooseSub(String(category.id)); }}
      label="Subcategoria"
    />}
    <div className="alunos-filters" data-swipe-ignore>
      <CollectionSearch className="alunos-search" label="Buscar aluno" placeholder="Buscar jogador pelo nome" value={busca} onChange={setBusca} />
      <CollectionFilterButton className="alunos-filter-toggle" count={extraFilterCount} onClick={openFilters} />
      <div className="alunos-extra-filters">
      <Choice label="Posição" value={position} onChange={setPosition} options={[{value:'',label:'Todas'},...POSITIONS.map(value=>({value,label:value}))]} />
      <button className="alunos-missing-chip" type="button" aria-pressed={shirtFilter === 'missing'} onClick={() => setShirtFilter(shirtFilter === 'missing' ? '' : 'missing')}>Sem camisa <span>{missingShirts}</span></button>
      </div>
    </div>
    <div className="alunos-results-bar">
      <p role="status">{loading ? 'Carregando jogadores…' : erroLista ? 'Consulta indisponível' : <><strong>{total} {total === 1 ? 'jogador' : 'jogadores'}</strong><span>{listView ? `${allCategories.length} categorias` : selectedCategory?.nome.toUpperCase()}</span></>}</p>
      {filtered && <button type="button" className="alunos-clear" onClick={clearFilters}>Limpar filtros</button>}
      {!smallScreen && <CollectionViewToggle className="alunos-view-toggle" value={listView ? 'lista' : 'tabela'} onChange={value => setView(value === 'lista' ? 'lista' : 'tabela')}
        options={[{ value: 'tabela', label: 'Tabela', icon: 'table' }, { value: 'lista', label: 'Lista', icon: 'list' }]} />}
    </div>
    {(position || shirtFilter) && <div className="alunos-active-filters" aria-label="Filtros ativos">
      {position && <button type="button" onClick={() => setPosition('')} aria-label={`Remover filtro de posição: ${position}`}>{position}<span aria-hidden="true">×</span></button>}
      {shirtFilter && <button type="button" onClick={() => setShirtFilter('')} aria-label="Remover filtro de camisa">{shirtFilter === 'missing' ? 'Sem camisa' : 'Com camisa'}<span aria-hidden="true">×</span></button>}
    </div>}
    {notice && <div className="collection-notice" role="status">{notice}</div>}
    {renderCategory(0)}
    {shirtPlayer && <PlayerShirtDialog key={`${clube?.id}:${shirtPlayer.id}`} player={shirtPlayer}
      category={categorias.find(category => category.id === shirtPlayer.categoria_id)?.nome}
      onClose={() => setShirtPlayer(null)} onSaved={(updated, swapped) => {
        const patchPlayer = (player: Jogador) => player.id === updated.id ? { ...player, ...updated }
          : swapped && player.id === swapped.jogador_id ? { ...player, numCamisa: swapped.camisa_anterior ?? undefined } : player;
        setJogadores(current => current.map(patchPlayer));
        setCategoryRows(current => Object.fromEntries(Object.entries(current).map(([id, rows]) => [id, { ...rows, items: rows.items.map(patchPlayer) }])));
        setNotice(`Camisa de ${shirtPlayer.nome} atualizada com sucesso.`);
        if (listView) refreshExpanded.current = [...expandedSubs];
        setShirtPlayer(null);
        setVersao(value => value + 1);
      }} />}
    {!blocos.length && (loading ? <Spinner /> : <p className="alunos-sub-message">{erroLista || 'Nenhuma categoria disponível neste grupo.'}</p>)}

    <CollectionFilterDialog open={filtersOpen} className="alunos-filter-dialog" title="Filtrar jogadores" onClose={() => setFiltersOpen(false)}
      onClear={() => setDraftFilters({ position: '', shirt: '', sort: 'default', direction: 'asc' })} onApply={applyFilters} applyLabel="Aplicar filtros">
      {[
        { label: 'Posição', value: draftFilters.position, change: (value: string) => setDraftFilters(current => ({ ...current, position: value })), options: [{ value: '', label: 'Todas' }, ...POSITIONS.map(value => ({ value, label: value }))] },
        { label: 'Camisa', value: draftFilters.shirt, change: (value: string) => setDraftFilters(current => ({ ...current, shirt: value })), options: [{ value: '', label: 'Todas' }, { value: 'missing', label: 'Sem número' }, { value: 'assigned', label: 'Com número' }] },
        { label: 'Ordenar por', value: draftFilters.sort, change: (value: string) => setDraftFilters(current => ({ ...current, sort: value })), options: [{ value: 'default', label: 'Padrão' }, ...SORT_FIELDS.map(field => ({ value: field.value, label: field.label }))] },
        ...(draftFilters.sort === 'default' ? [] : [{ label: 'Direção', value: draftFilters.direction, change: (value: string) => setDraftFilters(current => ({ ...current, direction: value })), options: [{ value: 'asc', label: 'Crescente' }, { value: 'desc', label: 'Decrescente' }] }]),
      ].map(group => <fieldset className="alunos-filter-group" key={group.label}><legend>{group.label}</legend><div>{group.options.map(option => <button key={option.value} type="button" aria-pressed={group.value === option.value} onClick={() => group.change(option.value)}>{option.label}{group.value === option.value && <Icon name="checkAll" size={16}/>}</button>)}</div></fieldset>)}
    </CollectionFilterDialog>

    <Modal open={modal && !reviewOpen} className="alunos-create-dialog" onClose={() => { if (!salvando) setModal(false); }} title="Adicionar aluno" footer={<div className="alunos-footer"><Btn variant="ghost" type="button" disabled={salvando} onClick={() => setModal(false)}>Cancelar</Btn>
      {!conflito && <Btn type="submit" form="alunos-create-form" disabled={salvando || !categoriaPronta}>{salvando ? 'Salvando…' : 'Salvar aluno'}</Btn>}</div>}>
      <p className="alunos-form-intro">Cadastre o aluno no clube. A categoria será definida pela data de nascimento.</p>
      <form id="alunos-create-form" noValidate onSubmit={e => { e.preventDefault(); revisarAluno(); }}>
        <fieldset disabled={salvando || !!conflito} className="form-grid alunos-fields">
          <div className="alunos-form-heading full"><h3>Dados do aluno</h3><span>Campos obrigatórios</span></div>
          <Input label="Nome completo" placeholder="Ex.: João Pedro da Silva" autoComplete="name" value={form.nome} onChange={e => alterar('nome', e.target.value)} required />
          <Input label="CPF" value={form.cpf} onChange={e => alterar('cpf', e.target.value)} required placeholder="000.000.000-00" inputMode="numeric" maxLength={14} pattern="[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}" />
          <BirthDateField value={form.dtNasc} onChange={value => alterar("dtNasc", value)} />
          <InfoNotice title="Categoria do aluno" className="alunos-category-notice">
            {origin && <p>Cadastro aberto pelo {origin.nome.toUpperCase()}. {categoriaPronta && (categoriaPronta.categoria.id === origin.id ? 'O aluno pertence a este sub.' : `Pelo nascimento, será cadastrado no ${categoriaPronta.categoria.nome.toUpperCase()}.`)}</p>}
            <p>{categoriaPronta ? `${categoriaPronta.categoria.nome.toUpperCase()} · ${categoriaPronta.categoria.tipo === 'BASE' ? 'Base' : 'Iniciação'} · Temporada ${categoriaPronta.temporada}` : erroCategoria || (form.dtNasc ? 'Calculando categoria...' : 'Selecione dia, mês e ano para identificar o sub.')}</p>
          </InfoNotice>
          <div className="alunos-form-heading alunos-form-heading--section full"><h3>Dentro de campo</h3></div>
          <div className="full"><span className="field-label">Posição</span><div className="position-options" role="group" aria-label="Posição do aluno">{POSITIONS.map(value => (
            <button type="button" key={value} aria-pressed={form.posicao === value} onClick={() => alterar('posicao', value)}>
              <PositionBadge position={value} showLabel />
              {form.posicao === value && <Icon name="checkAll" size={15}/>}
            </button>
          ))}</div></div>
          <div className="alunos-shirt-field full"><Input label="Camisa (opcional)" placeholder="1 a 99" type="text" inputMode="numeric" pattern="[0-9]{1,2}" maxLength={2} disabled={!categoriaPronta} value={form.numCamisa} onChange={e => alterar('numCamisa', e.target.value)} /><small>Deixe em branco se ainda não houver número definido.</small></div>
        </fieldset>
        {conflito && <div className="alunos-conflict" role="alert">
          <strong>A camisa {conflito.camisa} já pertence a {conflito.nome} no {conflito.categoria.toUpperCase()}.</strong>
          <p>{conflito.camisa_anterior === null ? `${conflito.nome} ficará sem camisa. ${form.nome} receberá a ${conflito.camisa}.` : `${conflito.nome} receberá a camisa ${conflito.camisa_anterior}; ${form.nome} receberá a ${conflito.camisa}.`}</p>
          <div className="actions"><Btn type="button" variant="ghost" disabled={salvando} onClick={() => setConflito(null)}>Cancelar troca</Btn><Btn type="button" disabled={salvando} onClick={() => void salvar(conflito)}>Confirmar {conflito.camisa_anterior === null ? 'transferência' : 'troca'}</Btn></div>
        </div>}
        {erro && <p className="alunos-error" role="alert">{erro}</p>}
      </form>
    </Modal>
    <Modal open={reviewOpen && modal} className="alunos-review-dialog" title="Revisar aluno" onClose={() => { if (!salvando) setReviewOpen(false); }}
      footer={<div className="alunos-footer"><Btn variant="ghost" disabled={salvando} onClick={() => setReviewOpen(false)}>Voltar e editar</Btn><Btn disabled={salvando} onClick={() => void salvar()}><Icon name="checkAll" size={17}/>{salvando ? 'Salvando…' : 'Confirmar e salvar'}</Btn></div>}>
      <p className="alunos-form-intro">Confira os dados e a categoria. O aluno só será cadastrado após sua confirmação.</p>
      <InfoNotice title={categoriaPronta?.categoria.nome.toUpperCase() || 'Categoria do aluno'}>{categoriaPronta?.categoria.tipo === 'BASE' ? 'Base' : 'Iniciação'} · Temporada {categoriaPronta?.temporada}</InfoNotice>
      <dl className="alunos-review-details">
        <div><dt>Clube</dt><dd>{clube?.nome}</dd></div>
        <div><dt>Nome completo</dt><dd>{form.nome}</dd></div>
        <div><dt>CPF</dt><dd>{form.cpf}</dd></div>
        <div><dt>Nascimento</dt><dd>{form.dtNasc.split('-').reverse().join('/')}</dd></div>
        <div><dt>Posição</dt><dd><PositionBadge position={form.posicao} showLabel /></dd></div>
        <div><dt>Camisa</dt><dd>{form.numCamisa || 'Ainda não definida'}</dd></div>
      </dl>
      {erro && <p className="alunos-error" role="alert">{erro}</p>}
    </Modal>
  </div>;
}
