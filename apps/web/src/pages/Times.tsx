import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ClubBadge } from '../components/Brand';
import { CollectionSearch, CollectionViewToggle } from '../components/CollectionToolbar';
import { CategoryFilter } from '../components/CategoryFilter';
import { useClubCategory } from '../hooks/useClubCategory';
import { FilterSelect } from '../components/FilterSelect';
import { Icon } from '../components/Icon';
import { InfoNotice } from '../components/InfoNotice';
import { TeamInsights, shortTeamDate } from '../components/TeamInsights';
import { Btn, Input, Modal, Spinner } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import {
  adicionarCategoriaTime, arquivarTime, atualizarEscudoTime, atualizarTime, criarTime, deletarTime,
  fetchCategorias, fetchClubes, fetchImpactoTime, fetchResumoAdversarios, fetchTimes, renomearTime, type Categoria, type Time, type ResumoAdversario,
} from '../services/api';
import { teamKey, teamName } from '../utils/teamIdentity';
import './Times.css';

type TeamGroup = { key: string; name: string; crest?: string; clubId?: number | null; items: Time[]; archived?: boolean };
type Scope = 'all' | 'linked' | 'external' | 'archived';
const numberOf = (category?: Categoria) => Number(category?.nome.replace(/\D/g, '') || 0);
const message = (error: unknown) => error instanceof Error && !/fetch|network|load failed/i.test(error.message)
  ? error.message : 'Não foi possível conectar ao servidor. Confira sua conexão e tente novamente.';

export default function TimesPage() {
  const { podeGerenciar, clube, definirClube } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const epoch = useRef(0);
  const saving = useRef(false);
  const [times, setTimes] = useState<Time[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [version, setVersion] = useState(0);
  const [scope, setScope] = useState<Scope>('all');
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState('');
  const [view, setView] = useState('cards');
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 760px)').matches);
  const listView = !mobile && view === 'list';
  useEffect(() => {
    const viewport = matchMedia('(max-width: 760px)');
    const update = () => setMobile(viewport.matches);
    update();
    viewport.addEventListener('change', update);
    return () => viewport.removeEventListener('change', update);
  }, []);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [create, setCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [editing, setEditing] = useState<Time | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [adding, setAdding] = useState(false);
  const [addCategory, setAddCategory] = useState('');
  const [crestTeam, setCrestTeam] = useState<TeamGroup | null>(null);
  const [crestUrl, setCrestUrl] = useState('');
  const [deleting, setDeleting] = useState<Time | null>(null);
  const [impact, setImpact] = useState<{ partidas: number; competicoes: number } | null>(null);
  const [impactError, setImpactError] = useState('');
  const [impactVersion, setImpactVersion] = useState(0);
  const [visiting, setVisiting] = useState<TeamGroup | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<TeamGroup | null>(null);
  const [summaries, setSummaries] = useState<ResumoAdversario[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(false);
  const [expandedPreviews, setExpandedPreviews] = useState<string[]>([]);
  const [renameTarget, setRenameTarget] = useState<TeamGroup | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const { phase, selected: selectedCategory } = useClubCategory(categorias, params.get('categoria_id'), params.get('fase'));
  const category = selectedCategory ? String(selectedCategory.id) : '';

  function selectPhase(value: string) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('fase', value);
      next.delete('categoria_id');
      return next;
    }, { replace: true, preventScrollReset: true });
  }

  function selectCategory(name: string) {
    const target = categorias.find(item => item.nome === name);
    if (target) setParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('categoria_id', String(target.id));
      next.delete('fase');
      return next;
    }, { replace: true, preventScrollReset: true });
  }

  function summaryFor(key: string) {
    const all = summaries.find(item => item.key === key);
    return selectedCategory ? all?.categorias?.find(item => item.categoria_id === selectedCategory.id) : all;
  }

  async function loadSummaries() {
    const current = epoch.current;
    setSummaryLoading(true);
    setSummaryError(false);
    try {
      const data = await fetchResumoAdversarios();
      if (current === epoch.current) setSummaries(data);
    } catch {
      if (current === epoch.current) setSummaryError(true);
    } finally {
      if (current === epoch.current) setSummaryLoading(false);
    }
  }

  useEffect(() => {
    const current = ++epoch.current;
    setLoading(true);
    setLoadError('');
    setSelected(null);
    setCreate(false);
    setCrestTeam(null);
    setDeleting(null);
    setVisiting(null);
    setArchiveTarget(null);
    setRenameTarget(null);
    setExpandedPreviews([]);
    setNotice('');
    setError('');
    setBusy(false);
    saving.current = false;
    void loadSummaries();
    Promise.all([fetchTimes(true), fetchCategorias()]).then(([teams, categories]) => {
      if (current !== epoch.current) return;
      setTimes(teams);
      setCategorias([...categories].sort((a, b) => numberOf(a) - numberOf(b)));
    }).catch(cause => {
      if (current === epoch.current) setLoadError(message(cause));
    }).finally(() => {
      if (current === epoch.current) setLoading(false);
    });
    return () => { epoch.current++; };
  }, [clube?.id, version]);

  useEffect(() => {
    if (!deleting) return;
    let active = true;
    setImpact(null);
    setImpactError('');
    fetchImpactoTime(deleting.id).then(data => { if (active) setImpact(data); })
      .catch(cause => { if (active) setImpactError(message(cause)); });
    return () => { active = false; };
  }, [deleting, impactVersion]);

  const groups = useMemo(() => {
    const map = new Map<string, TeamGroup>();
    times.forEach(time => {
      const key = time.clube_representado_id ? `club:${time.clube_representado_id}` : teamKey(time.nome);
      const existing = map.get(key);
      if (existing) {
        existing.items.push(time);
        existing.crest ||= time.escudo;
      } else {
        map.set(key, { key, name: time.clubeRepresentado?.nome || teamName(time.nome),
          crest: time.clubeRepresentado?.escudo || time.escudo,
          clubId: time.clube_representado_id, items: [time] });
      }
    });
    return [...map.values()].map(group => ({ ...group, archived: group.items.every(time => !!time.arquivado) }));
  }, [times]);
  const group = groups.find(item => item.key === selected);
  const scopedGroups = groups.filter(item => !category || item.items.some(time => String(time.categoria_id) === category));
  const activeGroups = scopedGroups.filter(item => !item.archived);
  const counts = { all: activeGroups.length, linked: activeGroups.filter(item => !!item.clubId).length,
    external: activeGroups.filter(item => !item.clubId).length, archived: scopedGroups.filter(item => item.archived).length };
  const visible = scopedGroups.filter(item => (scope === 'archived' ? item.archived : !item.archived && (scope === 'all' || (scope === 'linked' ? !!item.clubId : !item.clubId)))
    && item.name.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))
    && (!category || item.items.some(time => String(time.categoria_id) === category)))
    .sort((a, b) => (order === 'categories' ? b.items.length - a.items.length : 0)
      || a.name.localeCompare(b.name, 'pt-BR') * (order === 'desc' ? -1 : 1));
  const own = visible.filter(item => item.clubId === clube?.id);
  const others = visible.filter(item => item.clubId !== clube?.id);
  const missing = categorias.filter(cat => !group?.items.some(time => time.categoria_id === cat.id));
  const categoryName = (id?: number) => categorias.find(cat => cat.id === id)?.nome.toUpperCase() || 'Sem categoria';

  function newMatchUrl(item: TeamGroup) {
    if (item.clubId === clube?.id) return selectedCategory && item.items.some(time => time.categoria_id === selectedCategory.id && !time.arquivado)
      ? `/partidas?organizar=1&categoria_id=${selectedCategory.id}` : null;
    const next = selectedCategory?.id || summaryFor(item.key)?.proxima?.categoria_id;
    const candidates = item.items.filter(time => !time.arquivado && (!selectedCategory || time.categoria_id === selectedCategory.id)
      && times.some(own => own.clube_representado_id === clube?.id && own.categoria_id === time.categoria_id && !own.arquivado));
    const target = candidates.find(time => time.categoria_id === next) || [...candidates].sort((a, b) => numberOf(categorias.find(cat => cat.id === a.categoria_id)) - numberOf(categorias.find(cat => cat.id === b.categoria_id)))[0];
    return target ? `/partidas?organizar=1&adversario_id=${target.id}&categoria_id=${target.categoria_id}` : null;
  }

  async function changeArchive(item: TeamGroup, archived: boolean) {
    const current = epoch.current;
    await mutate(async () => {
      const result = await arquivarTime(item.items[0].id, archived);
      if (current !== epoch.current) return;
      setTimes(rows => rows.map(time => result.ids.includes(time.id) ? { ...time, arquivado: result.arquivado } : time));
      setSelected(null);
      setArchiveTarget(null);
      setNotice(archived ? 'Time arquivado. Partidas, competições e resultados foram preservados.' : 'Time restaurado e disponível para novas partidas.');
    });
  }

  async function saveName(event: FormEvent) {
    event.preventDefault();
    if (!renameTarget) return;
    if (renameValue.trim().length < 2) { setError('Informe pelo menos 2 caracteres para o nome do time.'); return; }
    const current = epoch.current;
    await mutate(async () => {
      const result = await renomearTime(renameTarget.items[0].id, renameValue.trim());
      if (current !== epoch.current) return;
      setTimes(rows => rows.map(time => result.items.find(updated => updated.id === time.id) || time));
      setSelected(result.clubeId ? `club:${result.clubeId}` : teamKey(result.nome));
      if (result.clubeId === clube?.id && clube) definirClube({ ...clube, nome: result.nome });
      setRenameTarget(null);
      setNotice('Nome atualizado em todas as categorias. O histórico foi preservado.');
      void loadSummaries();
    });
  }

  function openCrest(item: TeamGroup) {
    setCrestTeam(item);
    setCrestUrl(item.crest || '');
    setError('');
  }

  function renderHeaderMenu(item: TeamGroup) {
    const editable = !item.clubId || item.clubId === clube?.id && clube.meuPapel === 'ADMIN';
    return <details className="teams-menu teams-header-menu" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}
      onKeyDown={event => {
        if (event.key === 'Escape' && event.currentTarget.open) {
          event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false;
          event.currentTarget.querySelector('summary')?.focus();
        }
      }}>
      <summary aria-label={`Opções de ${item.name}`}>···</summary><div onClick={event => {
        const menu = event.currentTarget.closest('details');
        menu?.removeAttribute('open');
        menu?.querySelector('summary')?.focus();
      }}>
        {editable && <><button type="button" onClick={() => { setRenameTarget(item); setRenameValue(item.name); setError(''); }}><Icon name="edit" size={16}/>Editar nome</button>
          <button type="button" onClick={() => openCrest(item)}><Icon name="shield" size={16}/>Alterar escudo</button></>}
        {item.clubId && item.clubId !== clube?.id && <button type="button" onClick={() => { setVisiting(item); setError(''); }}><Icon name="switchClub" size={16}/>Visitar clube</button>}
        {item.clubId !== clube?.id && <button type="button" disabled={busy} onClick={() => {
          setError('');
          if (item.archived) void changeArchive(item, false); else setArchiveTarget(item);
        }}><Icon name="archive" size={16}/>{item.archived ? 'Restaurar time' : 'Arquivar time'}</button>}
      </div>
    </details>;
  }

  async function mutate(action: () => Promise<void>) {
    if (saving.current) return;
    const current = epoch.current;
    saving.current = true;
    setBusy(true);
    setError('');
    try { await action(); }
    catch (cause) { if (current === epoch.current) setError(message(cause)); }
    finally {
      if (current === epoch.current) { saving.current = false; setBusy(false); }
    }
  }

  function edit(time: Time) {
    setAdding(false);
    setEditing(time);
    setEditName(time.nome);
    setEditCategory(String(time.categoria_id || ''));
    setError('');
  }

  function openGroup(key: string) {
    setSelected(key);
    setEditing(null);
    setAdding(false);
    setError('');
  }

  async function saveCategory(event: FormEvent) {
    event.preventDefault();
    if (!editing || !editName.trim() || !editCategory) return;
    const current = epoch.current;
    await mutate(async () => {
      const result: Time = await atualizarTime(editing.id, { nome: editName.trim(), categorias_ids: [Number(editCategory)] });
      if (current !== epoch.current) return;
      setTimes(rows => rows.map(time => time.id === result.id ? result : time));
      setSelected(result.clube_representado_id ? `club:${result.clube_representado_id}` : teamKey(result.nome));
      setEditing(null);
      setNotice('Categoria atualizada.');
      void loadSummaries();
    });
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!group || !addCategory) return;
    const current = epoch.current;
    await mutate(async () => {
      const result = await adicionarCategoriaTime(group.items[0].id, Number(addCategory));
      if (current !== epoch.current) return;
      setTimes(rows => [...rows, result]);
      setAdding(false);
      setAddCategory('');
      setNotice('Categoria adicionada ao time.');
    });
  }

  async function saveNew(event: FormEvent) {
    event.preventDefault();
    if (newName.trim().length < 2 || !newCategory) { setError('Informe um nome com pelo menos 2 caracteres e selecione a categoria.'); return; }
    const existing = groups.find(item => teamKey(item.name) === teamKey(newName));
    if (existing) {
      setError(existing.archived ? 'Este time está arquivado. Restaure-o pela aba Arquivados.' : 'Este time já está cadastrado. Abra suas categorias para adicionar outro sub.'); return;
    }
    const current = epoch.current;
    await mutate(async () => {
      const result: Time = await criarTime({ nome: newName.trim(), categorias_ids: [Number(newCategory)] });
      if (current !== epoch.current) return;
      setTimes(rows => [...rows, result]);
      setCreate(false);
      setNotice('Time criado. Você já pode adicionar seu escudo e outras categorias.');
    });
  }

  async function saveCrest(event: FormEvent) {
    event.preventDefault();
    if (!crestTeam) return;
    if (crestUrl.trim()) {
      try { if (!['http:', 'https:'].includes(new URL(crestUrl.trim()).protocol)) throw new Error(); }
      catch { setError('Informe uma URL iniciada por https:// ou http://.'); return; }
    }
    const current = epoch.current;
    await mutate(async () => {
      const result = await atualizarEscudoTime(crestTeam.items[0].id, crestUrl.trim());
      if (current !== epoch.current) return;
      setTimes(rows => rows.map(time => result.ids.includes(time.id) ? {
        ...time, escudo: result.escudo || undefined,
        clubeRepresentado: time.clubeRepresentado ? { ...time.clubeRepresentado, escudo: result.escudo || undefined } : time.clubeRepresentado,
      } : time));
      if (result.clubeId === clube?.id && clube) definirClube({ ...clube, escudo: result.escudo || undefined });
      setCrestTeam(null);
      setNotice('Escudo atualizado em todas as categorias do time.');
    });
  }

  async function remove() {
    if (!deleting || !impact || impact.partidas || impact.competicoes) return;
    const current = epoch.current;
    await mutate(async () => {
      await deletarTime(deleting.id);
      if (current !== epoch.current) return;
      setTimes(rows => rows.filter(time => time.id !== deleting.id));
      setDeleting(null);
      setNotice('Categoria excluída. As demais categorias foram mantidas.');
    });
  }

  function renderTeam(item: TeamGroup) {
    const cats = [...item.items].sort((a, b) => numberOf(categorias.find(c => c.id === a.categoria_id)) - numberOf(categorias.find(c => c.id === b.categoria_id)));
    const summary = summaryFor(item.key);
    const isOwn = item.clubId === clube?.id;
    const matchUrl = !item.archived ? newMatchUrl(item) : null;
    const expanded = expandedPreviews.includes(item.key);
    return <article key={item.key} className={`teams-card${item.clubId === clube?.id ? ' is-own' : ''}`}>
      <div className="teams-card-identity">
        {podeGerenciar && (!item.clubId || item.clubId === clube?.id && clube.meuPapel === 'ADMIN') ? <button type="button" className="teams-edit-crest" aria-label={`Alterar escudo de ${item.name}`}
          onClick={() => openCrest(item)}>
          <ClubBadge src={item.crest} name={item.name} size={48}/><span><Icon name="edit" size={12}/></span>
        </button> : <ClubBadge src={item.crest} name={item.name} size={48}/>}
        <div className="teams-card-name"><div className="teams-name-line"><h3>{item.name}</h3>
          {(item.clubId || item.archived) && <span className={`teams-membership${!item.archived ? ' is-club' : ''}`}>{item.archived ? 'Arquivado' : isOwn ? 'Seu clube' : 'No Ludora'}</span>}
        </div><p>{item.items.length} {item.items.length === 1 ? 'categoria' : 'categorias'}</p></div>
      </div>
      <div className="teams-preview" aria-label="Categorias do time">
        {(expanded ? cats : cats.slice(0, 3)).map(time => <span key={time.id}>{categoryName(time.categoria_id)}</span>)}
        {cats.length > 3 && <button type="button" aria-label={`${expanded ? 'Recolher' : 'Mostrar todas as'} categorias de ${item.name}`} aria-expanded={expanded}
          onClick={() => setExpandedPreviews(values => expanded ? values.filter(key => key !== item.key) : [...values, item.key])}>{expanded ? 'Menos' : `+${cats.length - 3}`}</button>}
      </div>
      <div className="teams-card-context">
        <p className="teams-context-label">{isOwn ? 'Retrospecto do clube' : `Contra ${clube?.nome}`} <span>· {selectedCategory?.nome.toUpperCase() || 'Todas as categorias'}</span></p>
        {summaryLoading ? <p className="teams-context-placeholder">Carregando retrospecto…</p> : summaryError ? <p className="teams-context-placeholder">Retrospecto indisponível</p> : <p className="teams-record">
          <span className="teams-record-stat is-win"><strong>{summary?.vitorias || 0}</strong><abbr title="Vitórias">V</abbr></span>
          <span className="teams-record-stat is-draw"><strong>{summary?.empates || 0}</strong><abbr title="Empates">E</abbr></span>
          <span className="teams-record-stat is-loss"><strong>{summary?.derrotas || 0}</strong><abbr title="Derrotas">D</abbr></span>
          <small>{(summary?.vitorias || 0) + (summary?.empates || 0) + (summary?.derrotas || 0) ? `${(summary?.vitorias || 0) + (summary?.empates || 0) + (summary?.derrotas || 0)} jogos finalizados` : 'Sem confrontos finalizados'}</small>
        </p>}
        {summary?.proxima && <p className="teams-card-next"><Icon name="calendar" size={15}/><span>Próximo: <strong>{shortTeamDate(summary.proxima.data)}</strong> · {categoryName(summary.proxima.categoria_id)}</span></p>}
      </div>
      <div className="teams-card-actions">{podeGerenciar && matchUrl && <Link className="btn btn-ghost btn-sm teams-quick-match" to={matchUrl}><Icon name="plus" size={15}/>Nova partida</Link>}
        <button type="button" className="teams-open" onClick={() => openGroup(item.key)} aria-label={`Ver time ${item.name}`}>
        Ver time <Icon name="chevronRight" size={16}/>
      </button></div>
    </article>;
  }

  return <div className="teams-page">
    <header className="page-header"><div><h1 className="page-title">Times</h1><p className="page-sub">Organize os times e as categorias dos seus confrontos.</p></div>
      {podeGerenciar && <Btn className="teams-add" aria-label="Adicionar time" title="Adicionar time" onClick={() => { setCreate(true); setNewName(''); setNewCategory(''); setError(''); }}><Icon name="plus" size={20}/><span>Adicionar time</span></Btn>}
    </header>
    <CategoryFilter categories={categorias} phase={phase} selected={selectedCategory} onPhase={selectPhase} onSelect={selectCategory}/>
    <div className="teams-tabs" role="group" aria-label="Vínculo dos times">
      {([['all', 'Todos'], ['linked', 'No Ludora'], ['external', 'Fora do Ludora'], ['archived', 'Arquivados']] as const).filter(([value]) => value !== 'archived' || podeGerenciar).map(([value, label]) =>
        <button type="button" key={value} aria-pressed={scope === value} onClick={() => setScope(value)}>{label}<span>{counts[value]}</span></button>)}
    </div>
    <div className="teams-toolbar">
      <CollectionSearch label="Buscar time" placeholder="Buscar time pelo nome…" value={search} onChange={setSearch}/>
      <div className="teams-sort"><FilterSelect label="Ordenar times" emptyLabel="Nome A–Z" value={order} onChange={setOrder}
        compactLabel={order === 'desc' ? 'Z–A' : order === 'categories' ? 'Qtd.' : 'A–Z'}
        options={[{ value: 'desc', label: 'Nome Z–A' }, { value: 'categories', label: 'Mais categorias' }]}/></div>
    </div>
    <div className="teams-results"><span role="status">{loading ? 'Carregando times…' : `${visible.length} ${visible.length === 1 ? 'time' : 'times'}`}</span>
      {!mobile && <CollectionViewToggle value={view} onChange={setView} options={[{ value: 'cards', label: 'Cards', icon: 'grid' }, { value: 'list', label: 'Lista', icon: 'list' }]}/>}
    </div>
    {notice && <p role="status" className="teams-notice">{notice}</p>}
    {loading ? <Spinner/> : loadError ? <div className="teams-empty" role="alert"><Icon name="alert" size={26}/><p>{loadError}</p><Btn variant="ghost" onClick={() => setVersion(v => v + 1)}>Tentar novamente</Btn></div> : <>
      {!!own.length && <section className="teams-section"><h2>Seu clube</h2><div className={`teams-grid ${listView ? 'is-list' : ''}`}>{own.map(renderTeam)}</div></section>}
      {!!others.length && <section className="teams-section"><h2>{own.length ? 'Outros times' : 'Times cadastrados'}</h2><div className={`teams-grid ${listView ? 'is-list' : ''}`}>{others.map(renderTeam)}</div></section>}
      {!visible.length && <div className="teams-empty"><Icon name="search" size={26}/><h2>Nenhum time encontrado</h2><p>{groups.length ? 'Tente outro nome ou remova os filtros.' : 'Os times cadastrados aparecerão aqui com suas categorias.'}</p>
        {!!groups.length && <Btn variant="ghost" onClick={() => { setSearch(''); setScope('all'); }}>Limpar busca</Btn>}</div>}
    </>}

    <Modal open={!!group} title={group?.name || 'Time'} className="teams-drawer" onClose={() => { if (!busy) setSelected(null); }}
      heading={group && <span className="teams-drawer-identity"><ClubBadge src={group.crest} name={group.name} size={44}/><span><strong>{group.name}</strong><small>{group.items.length} categorias{group.clubId && <span className="teams-membership is-club">{group.clubId === clube?.id ? 'Seu clube' : 'No Ludora'}</span>}</small></span></span>}
      headerActions={podeGerenciar && group ? renderHeaderMenu(group) : undefined}>
      {group && <>
        <>
          {podeGerenciar && !group.archived && newMatchUrl(group) && <Link className="btn btn-primary teams-panel-create" to={newMatchUrl(group)!}><Icon name="plus" size={17}/>{group.clubId === clube?.id ? 'Organizar partida' : `Nova partida contra ${group.name}`}</Link>}
          {podeGerenciar && !group.archived && !newMatchUrl(group) && <p className="teams-notice">Os dois times precisam estar cadastrados no {selectedCategory?.nome.toUpperCase() || 'mesmo sub'} para organizar uma partida nesta categoria.</p>}
          <TeamInsights teamId={group.items[0].id} clubeId={clube!.id} clubeName={clube!.nome} summary={summaryFor(group.key)} summaryLoading={summaryLoading}
            summaryError={summaryError} retrySummary={() => void loadSummaries()} categoria={selectedCategory} opponentName={group.name} ownClub={group.clubId === clube?.id}/>
        </>
        {notice && <p role="status" className="teams-panel-notice">{notice}</p>}
        <details className="teams-management">
          <summary><span><Icon name="team" size={17}/>Categorias <small>{group.items.length}</small></span><span>Gerenciar<Icon name="chevronRight" size={15}/></span></summary>
        {(['INICIACAO', 'BASE'] as const).map(phase => {
          const rows = group.items.filter(time => categorias.find(cat => cat.id === time.categoria_id)?.tipo === phase)
            .sort((a, b) => numberOf(categorias.find(cat => cat.id === a.categoria_id)) - numberOf(categorias.find(cat => cat.id === b.categoria_id)));
          if (!rows.length) return null;
          return <section className="teams-panel-section" key={phase}><h3>{phase === 'BASE' ? 'Base' : 'Iniciação'} <span>· {rows.length}</span></h3>
            {rows.map(time => editing?.id === time.id ? <form className="teams-inline-edit" key={time.id} onSubmit={saveCategory} onKeyDown={event => {
              if (event.key === 'Escape' && !busy) { event.preventDefault(); event.stopPropagation(); setEditing(null); setError(''); }
            }}>
              <Input label="Nome nesta categoria" value={editName} onChange={event => setEditName(event.target.value)} maxLength={120} required/>
              <FilterSelect label="Categoria" value={editCategory} emptyLabel="Selecionar sub" onChange={setEditCategory} inlineOptions
                options={categorias.filter(cat => cat.id === time.categoria_id || missing.some(item => item.id === cat.id)).map(cat => ({ value: cat.id, label: cat.nome.toUpperCase() }))}/>
              <div className="teams-inline-actions"><Btn type="submit" size="sm" disabled={busy || !editName.trim() || !editCategory}>{busy ? 'Salvando…' : 'Salvar'}</Btn><Btn variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(null)}>Cancelar</Btn></div>
            </form> : <div className="teams-category-row" key={time.id}>
              <strong>{categoryName(time.categoria_id)}</strong>
              {podeGerenciar && !group.archived && <div className="teams-category-actions"><button type="button" className="teams-quick-edit" onClick={() => edit(time)}>Editar</button>
                <details className="teams-menu" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }} onKeyDown={event => {
                  if (event.key === 'Escape' && event.currentTarget.open) {
                    event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false;
                    event.currentTarget.querySelector('summary')?.focus();
                  }
                }}><summary aria-label={`Opções de ${categoryName(time.categoria_id)}`}>···</summary><div>
                  <button type="button" onClick={() => edit(time)}><Icon name="edit" size={16}/>Editar</button>
                  <button type="button" onClick={() => { setDeleting(time); setError(''); }}><Icon name="trash" size={16}/>Excluir</button>
                </div></details></div>}
            </div>)}
          </section>;
        })}
        {group.items.filter(time => !categorias.some(cat => cat.id === time.categoria_id)).map(time => <p key={time.id} className="text-muted">{time.nome} · Categoria indisponível</p>)}
        {error && !deleting && <p role="alert" className="notice-error">{error}</p>}
        {podeGerenciar && !group.archived && <div className="teams-panel-add">
          {adding ? <form onSubmit={add} className="teams-add-category"><FilterSelect label="Adicionar categoria" emptyLabel="Escolher sub" value={addCategory} onChange={setAddCategory} inlineOptions
            options={missing.map(cat => ({ value: cat.id, label: cat.nome.toUpperCase() }))}/><div className="teams-inline-actions"><Btn size="sm" type="submit" disabled={busy || !addCategory}>Adicionar</Btn><Btn size="sm" variant="ghost" disabled={busy} onClick={() => setAdding(false)}>Cancelar</Btn></div></form>
            : <Btn variant="ghost" disabled={!missing.length || busy} onClick={() => { setAdding(true); setEditing(null); setAddCategory(''); setError(''); }}><Icon name="plus" size={16}/>{missing.length ? 'Adicionar categoria' : 'Todas as categorias cadastradas'}</Btn>}
        </div>}
        </details>
        {group.archived && <p className="teams-notice">Time arquivado. Use o menu de opções para restaurá-lo.</p>}
      </>}
    </Modal>

    <Modal open={!!archiveTarget} title={`Arquivar ${archiveTarget?.name || 'time'}?`} onClose={() => { if (!busy) setArchiveTarget(null); }}>
      <p>O time sairá da lista de adversários disponíveis para novas partidas. Todos os resultados, partidas e vínculos com competições serão preservados.</p>
      <p className="text-muted">Você poderá restaurá-lo pela aba Arquivados.</p>
      {error && <p role="alert" className="notice-error">{error}</p>}
      <div className="teams-inline-actions"><Btn variant="ghost" disabled={busy} onClick={() => setArchiveTarget(null)}>Cancelar</Btn><Btn disabled={busy} onClick={() => { if (archiveTarget) void changeArchive(archiveTarget, true); }}>{busy ? 'Arquivando…' : 'Arquivar time'}</Btn></div>
    </Modal>

    <Modal open={!!visiting} title={`Visitar ${visiting?.name || 'clube'}?`} onClose={() => { if (!busy) setVisiting(null); }}>
      <p>O clube ativo será alterado. Você terá as permissões do seu vínculo nesse clube.</p>
      {error && <p role="alert" className="notice-error">{error}</p>}
      <div className="teams-inline-actions"><Btn variant="ghost" disabled={busy} onClick={() => setVisiting(null)}>Cancelar</Btn><Btn disabled={busy} onClick={() => void mutate(async () => {
        const current = epoch.current;
        const clubs = await fetchClubes();
        if (current !== epoch.current) return;
        const target = clubs.find(item => item.id === visiting?.clubId);
        if (!target) throw new Error('Clube não encontrado. Atualize a página e tente novamente.');
        definirClube(target);
        navigate('/dashboard');
      })}>{busy ? 'Abrindo…' : 'Ir para o clube'}</Btn></div>
    </Modal>

    <Modal open={!!renameTarget} title="Editar nome do time" onClose={() => { if (!busy) setRenameTarget(null); }}>
      <form className="teams-form" noValidate onSubmit={saveName}>
        <Input label="Nome do time" value={renameValue} maxLength={120} placeholder="Ex.: Aurora FC" onChange={event => setRenameValue(event.target.value)}/>
        <p className="text-muted">O nome será alterado em todas as categorias do time, mantendo seus vínculos e o histórico de partidas.</p>
        {error && <p role="alert" className="notice-error">{error}</p>}
        <Btn type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar nome'}</Btn>
      </form>
    </Modal>
    <Modal open={create} title="Adicionar time" onClose={() => { if (!busy) setCreate(false); }}>
      <form className="teams-form" onSubmit={saveNew} noValidate><Input label="Nome do time" placeholder="Ex.: Aurora FC" value={newName} onChange={event => setNewName(event.target.value)} maxLength={120}/>
        <FilterSelect label="Primeira categoria" emptyLabel="Selecionar sub" value={newCategory} onChange={setNewCategory} inlineOptions options={categorias.map(cat => ({ value: cat.id, label: cat.nome.toUpperCase() }))}/>
        <InfoNotice title="Depois, adicione o escudo pelo card e as outras categorias pelo painel do time." />
        {error && <p role="alert" className="notice-error">{error}</p>}<Btn type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Adicionar time'}</Btn>
      </form>
    </Modal>
    <Modal open={!!crestTeam} title="Escudo do time" onClose={() => { if (!busy) setCrestTeam(null); }}>
      <form className="teams-form" onSubmit={saveCrest} noValidate><div className="teams-panel-identity"><ClubBadge src={crestUrl} name={crestTeam?.name} size={58}/><strong>{crestTeam?.name}</strong></div>
        <Input label="URL do escudo" placeholder="https://…" value={crestUrl} maxLength={2048} onChange={event => setCrestUrl(event.target.value)}/>
        <p className="text-muted">{crestTeam?.clubId ? 'O escudo oficial do seu clube será atualizado, inclusive nas outras telas.' : 'O escudo será usado em todas as categorias deste time.'} Deixe vazio para mostrar a inicial do nome.</p>
        {error && <p role="alert" className="notice-error">{error}</p>}<Btn type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar escudo'}</Btn>
      </form>
    </Modal>
    <Modal open={!!deleting} title={`Excluir ${categoryName(deleting?.categoria_id)}?`} onClose={() => { if (!busy) setDeleting(null); }}>
      <p>Somente esta categoria de {group?.name} será removida. As outras categorias serão mantidas. Esta ação não pode ser desfeita.</p>
      {!impact && !impactError && <p role="status">Verificando partidas e competições vinculadas…</p>}
      {impact && <p className="teams-delete-impact"><Icon name="info" size={18}/>{impact.partidas} partidas e {impact.competicoes} competições vinculadas.{!!(impact.partidas || impact.competicoes) && ' A exclusão está bloqueada para preservar esses registros.'}</p>}
      {impactError && <div role="alert"><p>{impactError}</p><Btn variant="ghost" onClick={() => setImpactVersion(value => value + 1)}>Tentar novamente</Btn></div>}
      {error && <p role="alert" className="notice-error">{error}</p>}
      <div className="teams-inline-actions"><Btn variant="ghost" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</Btn><Btn variant="danger" disabled={busy || !impact || !!(impact.partidas || impact.competicoes)} onClick={() => void remove()}>{busy ? 'Excluindo…' : 'Excluir categoria'}</Btn></div>
    </Modal>
  </div>;
}
