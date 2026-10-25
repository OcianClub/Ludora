import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchPartidas, criarPartida, fetchTimes, fetchCategorias, fetchCompeticoes, Partida, Time, Categoria, Competicao } from '../services/api';
import { Btn, Modal, Input, Select, Spinner, Empty } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { MatchCard } from '../components/MatchCard';
import { Icon } from '../components/Icon';
import { sortMatches } from '../utils/matchSchedule';
import './Partidas.css';
import { BlockColumns } from '../components/BlockColumns';
import { FilterSelect } from '../components/FilterSelect';
import { teamKey, teamName } from '../utils/teamIdentity';

const STATUSES = [
  { value: 'AGENDADA', label: 'Agendada' }, { value: 'PREPARADA', label: 'Preparada' },
  { value: 'AO_VIVO', label: 'Ao Vivo' }, { value: 'FINALIZADA', label: 'Finalizada' }, { value: 'CANCELADA', label: 'Cancelada' },
];
function ScheduleSection({ title, description, matches, initialOpen, renderMatch }: {
  title: string;
  description: string;
  matches: Partida[];
  initialOpen: boolean;
  renderMatch: (partida: Partida) => ReactNode;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [limit, setLimit] = useState(12);
  const id = useId();
  if (!matches.length) return null;
  return (
    <section className="schedule-section">
      <h2>
        <button type="button" className="schedule-section-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
          <span className="schedule-section-copy"><strong>{title}<span>{matches.length}</span></strong><small>{description}</small></span>
          <span className="schedule-section-affordance"><span>{open ? 'Recolher' : 'Expandir'}</span><span className="schedule-section-chevron"><Icon name="chevronRight" size={18} /></span></span>
        </button>
      </h2>
      <div id={id} hidden={!open}>
        {open && <>
          <BlockColumns>{matches.slice(0, limit).map(renderMatch)}</BlockColumns>
          {matches.length > limit && <Btn variant="ghost" className="schedule-show-more" onClick={() => setLimit(value => value + 12)}>Mostrar mais partidas ({matches.length - limit})</Btn>}
        </>}
      </div>
    </section>
  );
}

const FORM_VAZIO = { mandante_id: '', visitante_id: '', data: '', horario: '', local: '', categoria_id: '', competicao_id: '', rodada: '', emCasa: 'true' };
const normalizarBusca = (value: string) => teamKey(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export default function PartidasPage() {
  const [searchParams] = useSearchParams();
  const { podeGerenciar, clube } = useAuth();
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [times, setTimes] = useState<Time[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [competicoes, setCompeticoes] = useState<Competicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState(() => STATUSES.some(item => item.value === searchParams.get('status')) ? searchParams.get('status')! : '');
  const [filtroCategoria, setFiltroCategoria] = useState(() => /^\d+$/.test(searchParams.get('categoria_id') || '') ? searchParams.get('categoria_id')! : '');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [loadError, setLoadError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [opponent, setOpponent] = useState('');
  const loadVersion = useRef(0);

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
  function mudarFiltro(status: string, cat: string) {
    setFiltroStatus(status); setFiltroCategoria(cat);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErro(''); setSalvando(true);
    try {
      await criarPartida({
        mandante_id: Number(form.mandante_id), visitante_id: Number(form.visitante_id),
        data: form.data, horario: form.horario, local: form.local || undefined,
        categoria_id: Number(form.categoria_id),
        competicao_id: form.competicao_id ? Number(form.competicao_id) : undefined,
        rodada: form.rodada ? Number(form.rodada) : undefined,
        emCasa: form.emCasa === 'true',
      });
      setModal(false); carregar();
    } catch (err: any) { setErro(err.message); }
    finally { setSalvando(false); }
  }

  const timeOpts = times.filter(t=>String(t.categoria_id)===form.categoria_id).map(t => ({ value: t.id, label: teamName(t.nome) }));
  const catOpts = categorias.map(c => ({ value: c.id, label: c.nome }));
  const compOpts = competicoes.filter(c=>c.tipo===categorias.find(cat=>String(cat.id)===form.categoria_id)?.tipo).map(c => ({ value: c.id, label: `${c.nome} (${c.ano})` }));
  const teamIndex = useMemo(() => new Map(times.map(time => [time.id, time])), [times]);
  const selectedCategory = categorias.find(category => String(category.id) === filtroCategoria);
  const filtered = useMemo(() => partidas.filter(partida => {
    const rival = partida.emCasa ? partida.visitante || teamIndex.get(partida.visitante_id) : partida.mandante || teamIndex.get(partida.mandante_id);
    return (!filtroStatus || partida.status === filtroStatus)
      && (!filtroCategoria || String(partida.categoria_id) === filtroCategoria || (selectedCategory && partida.categoria?.nome.toLowerCase() === selectedCategory.nome.toLowerCase()))
      && (!opponent.trim() || normalizarBusca(rival?.nome || '').includes(normalizarBusca(opponent.trim())))
      && (!year || partida.data.slice(0, 4) === year)
      && (!month || partida.data.slice(5, 7) === month);
  }), [partidas, teamIndex, filtroStatus, filtroCategoria, selectedCategory?.nome, opponent, year, month]);
  const sections = useMemo(() => [
    { id: 'live', title: 'Ao vivo', description: 'Partidas em andamento', initialOpen: true, matches: sortMatches(filtered.filter(p => p.status === 'AO_VIVO'), 'earliest') },
    { id: 'next', title: 'A seguir', description: 'Preparadas e agendadas · por data e horário', initialOpen: true, matches: sortMatches(filtered.filter(p => ['PREPARADA', 'AGENDADA'].includes(p.status)), 'earliest') },
    { id: 'past', title: 'Finalizados', description: 'Resultados mais recentes primeiro', initialOpen: Boolean(filtroStatus || year || month || opponent || filtroCategoria), matches: sortMatches(filtered.filter(p => p.status === 'FINALIZADA'), 'latest') },
    { id: 'cancelled', title: 'Canceladas', description: 'Partidas que não serão realizadas', initialOpen: filtroStatus === 'CANCELADA', matches: sortMatches(filtered.filter(p => p.status === 'CANCELADA'), 'latest') },
  ], [filtered, filtroStatus, year, month, opponent, filtroCategoria]);
  const years = useMemo(() => [...new Set(partidas.map(p => p.data.slice(0, 4)))].filter(Boolean).sort().reverse(), [partidas]);
  const filterCount = [opponent.trim(), filtroStatus, filtroCategoria, year, month].filter(Boolean).length;
  const filterKey = [opponent, filtroStatus, filtroCategoria, year, month].join('|');
  const activeFilters = [
    { label: opponent.trim() ? `Adversário: ${opponent.trim()}` : '', clear: () => setOpponent('') },
    { label: STATUSES.find(status => status.value === filtroStatus)?.label || '', clear: () => setFiltroStatus('') },
    { label: selectedCategory?.nome || '', clear: () => setFiltroCategoria('') },
    { label: year, clear: () => setYear('') },
    { label: month ? new Date(2026, Number(month) - 1, 1).toLocaleDateString('pt-BR', { month: 'long' }) : '', clear: () => setMonth('') },
  ].filter(filter => filter.label);

  function renderMatch(p: Partida) {
    return <MatchCard key={p.id} featured={p.status === 'AO_VIVO'} partida={{ ...p,
      mandante: p.mandante || teamIndex.get(p.mandante_id),
      visitante: p.visitante || teamIndex.get(p.visitante_id),
      categoria: p.categoria || categorias.find(c => c.id === p.categoria_id),
    }} />;
  }

  return (
    <div className="match-schedule">
      <div className="page-header">
        <div><span className="eyebrow">DENTRO DA QUADRA</span><h1 className="page-title">Partidas</h1><p className="page-sub">Agenda, placares e resultados do clube.</p></div>
        {podeGerenciar && <Btn onClick={() => { setForm(FORM_VAZIO); setErro(''); setModal(true); }}>+ Nova partida</Btn>}
      </div>

      <div className="schedule-filters">
        <div className="schedule-filter-primary">
          <div className="schedule-search">
            <Icon name="search" size={18} />
            <label className="sr-only" htmlFor="match-opponent">Buscar adversário</label>
            <input id="match-opponent" type="search" placeholder="Buscar adversário" value={opponent} onChange={event => setOpponent(event.target.value)} />
          </div>
          <FilterSelect label="Categoria" emptyLabel="Todas as categorias" options={catOpts} value={filtroCategoria} onChange={value => mudarFiltro(filtroStatus, value)} />
          <Btn variant="ghost" aria-expanded={filtersOpen} aria-controls="schedule-extra-filters" onClick={() => setFiltersOpen(value => !value)}>
            <Icon name="settings" size={18} />Filtros{filterCount > 0 && <span className="schedule-filter-count">{filterCount}</span>}
          </Btn>
        </div>
        {filtersOpen && <div id="schedule-extra-filters" className="schedule-filter-extra">
          <FilterSelect label="Situação" emptyLabel="Todas as situações" options={STATUSES} value={filtroStatus} onChange={value => mudarFiltro(value, filtroCategoria)} />
          <FilterSelect label="Ano" emptyLabel="Todos os anos" options={years.map(value => ({ value, label: value }))} value={year} onChange={setYear} />
          <FilterSelect label="Mês" emptyLabel="Todos os meses" options={Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1).padStart(2, '0'), label: new Date(2026, index, 1).toLocaleDateString('pt-BR', { month: 'long' }) }))} value={month} onChange={setMonth} />
        </div>}
        {filterCount > 0 && <div className="schedule-active-filters" aria-label="Filtros ativos">
          {activeFilters.map(filter => <button type="button" key={filter.label} onClick={filter.clear} aria-label={`Remover filtro ${filter.label}`}>{filter.label}<Icon name="minus" size={14} /></button>)}
          <button type="button" className="schedule-clear" onClick={() => { setOpponent(''); mudarFiltro('', ''); setMonth(''); setYear(''); }}>Limpar filtros</button>
        </div>}
      </div>

      {loading ? <Spinner /> : loadError ? <div className="notice-error" role="alert"><p>{loadError}</p><Btn variant="ghost" onClick={carregar}>Tentar novamente</Btn></div> : filtered.length === 0 ? <Empty icon="⚽" message={filterCount ? 'Nenhuma partida encontrada. Experimente ajustar os filtros.' : 'Nenhuma partida publicada para este clube.'} /> : <>
        <p className="schedule-result-count" role="status">{filtered.length} partida(s){filterCount ? ' nos filtros selecionados' : ' no clube'}</p>
        <div className="schedule-results">
          {sections.map(section => <ScheduleSection key={section.id + filterKey} {...section} renderMatch={renderMatch} />)}
        </div>
      </>}

      <Modal open={modal} onClose={() => { if (!salvando) setModal(false); }} title="Nova partida">
        <form onSubmit={salvar} className="form-grid">
          <Select label="Categoria" options={catOpts} value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value, mandante_id:'', visitante_id:'', competicao_id:'' }))} required className="full" />
          <Select label="Mandante" options={timeOpts} value={form.mandante_id} onChange={e => setForm(f => ({ ...f, mandante_id: e.target.value }))} required />
          <Select label="Visitante" options={timeOpts} value={form.visitante_id} onChange={e => setForm(f => ({ ...f, visitante_id: e.target.value }))} required />
          <Input label="Data" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} required />
          <Input label="Horário" type="time" value={form.horario} onChange={e => setForm(f => ({ ...f, horario: e.target.value }))} />
          <Input label="Local" value={form.local} onChange={e => setForm(f => ({ ...f, local: e.target.value }))} className="full" />
          <Select label="Competição" options={compOpts} value={form.competicao_id} onChange={e => setForm(f => ({ ...f, competicao_id: e.target.value }))} />
          <Input label="Rodada" type="number" value={form.rodada} onChange={e => setForm(f => ({ ...f, rodada: e.target.value }))} />
          <Select label="Mando" options={[{ value: 'true', label: 'Em casa' }, { value: 'false', label: 'Fora' }]} value={form.emCasa} onChange={e => setForm(f => ({ ...f, emCasa: e.target.value }))} />
          {erro && <div style={{ color: 'var(--titulo-erro)', fontSize: 13, gridColumn: '1/-1' }}>{erro}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', gridColumn: '1/-1' }}>
            <Btn variant="ghost" type="button" disabled={salvando} onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Criar'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
