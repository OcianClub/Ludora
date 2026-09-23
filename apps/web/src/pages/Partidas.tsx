import { useEffect, useState } from 'react';
import { fetchPartidas, criarPartida, deletarPartida, fetchTimes, fetchCategorias, fetchCompeticoes, Partida, Time, Categoria, Competicao } from '../services/api';
import { Btn, Modal, Input, Select, Spinner, Empty } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { MatchCard } from '../components/MatchCard';
import { Icon } from '../components/Icon';
import { groupMatches, matchPeriod, sortMatches, GroupMode, SortMode } from '../utils/matchSchedule';
import './Partidas.css';

const STATUSES = [
  { value: 'AGENDADA', label: 'Agendada' }, { value: 'PREPARADA', label: 'Preparada' },
  { value: 'AO_VIVO', label: 'Ao Vivo' }, { value: 'FINALIZADA', label: 'Finalizada' }, { value: 'CANCELADA', label: 'Cancelada' },
];
const FORM_VAZIO = { mandante_id: '', visitante_id: '', data: '', horario: '', local: '', categoria_id: '', competicao_id: '', rodada: '', emCasa: 'true' };

export default function PartidasPage() {
  const { podeGerenciar } = useAuth();
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [times, setTimes] = useState<Time[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [competicoes, setCompeticoes] = useState<Competicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [loadError, setLoadError] = useState('');
  const [groupMode, setGroupMode] = useState<GroupMode>('month');
  const [sortMode, setSortMode] = useState<SortMode>('priority');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [period, setPeriod] = useState('');

  function carregar() {
    setLoadError('');
    setLoading(true);
    Promise.all([fetchPartidas({ status: filtroStatus || undefined, categoria_id: filtroCategoria ? Number(filtroCategoria) : undefined }), fetchTimes(), fetchCategorias(), fetchCompeticoes()])
      .then(([p, t, c, comp]) => { setPartidas(p); setTimes(t); setCategorias(c); setCompeticoes(comp); })
      .catch(() => setLoadError('Não foi possível carregar as partidas. Tente novamente.')).finally(() => setLoading(false));
  }
  useEffect(carregar, []);

  async function recarregar(status?: string, cat?: string) {
    setLoadError('');
    setLoading(true);
    try {
      const p = await fetchPartidas({ status: status || undefined, categoria_id: cat ? Number(cat) : undefined });
      setPartidas(p);
    } catch { setLoadError('Não foi possível atualizar as partidas. Tente novamente.'); } finally { setLoading(false); }
  }

  function mudarFiltro(status: string, cat: string) {
    setPeriod('');
    setFiltroStatus(status); setFiltroCategoria(cat);
    recarregar(status, cat);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true);
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

  async function excluir(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Excluir partida?')) return;
    try { await deletarPartida(id); carregar(); } catch (err: any) { alert(err.message); }
  }

  const timeOpts = times.map(t => ({ value: t.id, label: t.nome }));
  const catOpts = categorias.map(c => ({ value: c.id, label: c.nome }));
  const compOpts = competicoes.map(c => ({ value: c.id, label: `${c.nome} (${c.ano})` }));
  const periods = groupMatches(partidas, groupMode, 'earliest');
  const visibleMatches = partidas.filter(p => !period || matchPeriod(p.data, groupMode).key === period);
  const liveMatches = sortMode === 'priority' ? sortMatches(visibleMatches.filter(p => p.status === 'AO_VIVO'), 'earliest') : [];
  const groups = groupMatches(visibleMatches.filter(p => sortMode !== 'priority' || p.status !== 'AO_VIVO'), groupMode, sortMode);

  function renderMatch(p: Partida) {
    return <MatchCard key={p.id} featured={p.status === 'AO_VIVO'} partida={{ ...p,
      mandante: p.mandante || times.find(t => t.id === p.mandante_id),
      visitante: p.visitante || times.find(t => t.id === p.visitante_id),
      categoria: p.categoria || categorias.find(c => c.id === p.categoria_id),
    }} actions={podeGerenciar && <Btn variant="danger" size="sm" onClick={e => excluir(p.id, e)} aria-label={`Excluir partida ${p.mandante?.nome || p.id} contra ${p.visitante?.nome || 'visitante'}`}><Icon name="trash" size={16} /></Btn>} />;
  }

  return (
    <div className="match-schedule">
      <div className="page-header">
        <div><span className="eyebrow">DENTRO DE CAMPO</span><h1 className="page-title">Partidas</h1><p className="page-sub">Agenda, placares e resultados do clube.</p></div>
        {podeGerenciar && <Btn onClick={() => { setForm(FORM_VAZIO); setErro(''); setModal(true); }}>+ Nova partida</Btn>}
      </div>

      <div className="filter-bar">
        <Select label="Status" emptyLabel="Todos os status" options={STATUSES} value={filtroStatus} disabled={loading} onChange={e => mudarFiltro(e.target.value, filtroCategoria)} />
        <Select label="Categoria" emptyLabel="Todas as categorias" options={catOpts} value={filtroCategoria} disabled={loading} onChange={e => mudarFiltro(filtroStatus, e.target.value)} />
        <Select label="Período" emptyLabel={groupMode === 'month' ? 'Todos os meses' : 'Todas as semanas'} options={periods.map(p => ({ value: p.key, label: p.label }))} value={period} onChange={e => setPeriod(e.target.value)} />
        <div className="field"><label className="field-label" htmlFor="match-order">Ordenar por</label><select id="match-order" className="field-input" value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)}>
          <option value="priority">Prioridade da partida</option><option value="earliest">Data e horário: mais próximos</option><option value="latest">Data e horário: mais recentes</option>
        </select></div>
        {(filtroStatus || filtroCategoria) && <Btn variant="ghost" size="sm" disabled={loading} onClick={() => mudarFiltro('', '')}>Limpar</Btn>}
      </div>

      <div className="schedule-toolbar">
        <div className="schedule-group-control"><span>Agrupar por</span><div className="segmented-control" data-second={groupMode === 'week'} role="group" aria-label="Agrupamento por período">
          <button aria-pressed={groupMode === 'month'} onClick={() => { setGroupMode('month'); setPeriod(''); }}>Mês</button>
          <button aria-pressed={groupMode === 'week'} onClick={() => { setGroupMode('week'); setPeriod(''); }}>Semana</button>
        </div></div>
        <div className="segmented-control view-control" data-second={viewMode === 'list'} role="group" aria-label="Visualização das partidas">
          <button aria-label="Visualização em cartões" title="Cartões" aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')}><Icon name="grid" /></button>
          <button aria-label="Visualização em lista" title="Lista" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}><Icon name="list" /></button>
        </div>
      </div>
      <p className="schedule-help">{sortMode === 'priority' ? 'Ao vivo em destaque. Em cada dia: preparadas, agendadas, finalizadas e canceladas.' : 'Partidas organizadas por data e horário, independentemente da situação.'}</p>

      {loading ? <Spinner /> : loadError ? <div className="notice-error" role="alert">{loadError}</div> : visibleMatches.length === 0 ? <Empty icon="⚽" message="Nenhuma partida publicada para os filtros selecionados" /> : <div className={`schedule-results schedule-${viewMode}`}>
        {liveMatches.length > 0 && <section className="live-section"><h2 className="section-title"><Icon name="live" size={17} /> Ao vivo agora <span>{liveMatches.length}</span></h2><div className="matches-grid">{liveMatches.map(renderMatch)}</div></section>}
        {groups.map(group => <section className="schedule-period" key={group.key}>
          <h2 className="period-heading"><Icon name="calendar" size={18} />{group.label}</h2>
          {group.days.map(day => <section className="schedule-day" key={day.date}><h3 className="day-heading"><time dateTime={day.date}>{day.label}</time><span>{day.matches.length} partida(s)</span></h3><div className="matches-grid">{day.matches.map(renderMatch)}</div></section>)}
        </section>)}
      </div>}

      <Modal open={modal} onClose={() => setModal(false)} title="Nova partida">
        <form onSubmit={salvar} className="form-grid">
          <Select label="Mandante" options={timeOpts} value={form.mandante_id} onChange={e => setForm(f => ({ ...f, mandante_id: e.target.value }))} required />
          <Select label="Visitante" options={timeOpts} value={form.visitante_id} onChange={e => setForm(f => ({ ...f, visitante_id: e.target.value }))} required />
          <Input label="Data" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} required />
          <Input label="Horário" type="time" value={form.horario} onChange={e => setForm(f => ({ ...f, horario: e.target.value }))} />
          <Input label="Local" value={form.local} onChange={e => setForm(f => ({ ...f, local: e.target.value }))} className="full" />
          <Select label="Categoria" options={catOpts} value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))} required />
          <Select label="Competição" options={compOpts} value={form.competicao_id} onChange={e => setForm(f => ({ ...f, competicao_id: e.target.value }))} />
          <Input label="Rodada" type="number" value={form.rodada} onChange={e => setForm(f => ({ ...f, rodada: e.target.value }))} />
          <Select label="Mando" options={[{ value: 'true', label: 'Em casa' }, { value: 'false', label: 'Fora' }]} value={form.emCasa} onChange={e => setForm(f => ({ ...f, emCasa: e.target.value }))} />
          {erro && <div style={{ color: 'var(--titulo-erro)', fontSize: 13, gridColumn: '1/-1' }}>{erro}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', gridColumn: '1/-1' }}>
            <Btn variant="ghost" type="button" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Criar'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
