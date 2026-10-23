import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchPartidas, criarPartida, deletarPartida, fetchTimes, fetchCategorias, fetchCompeticoes, Partida, Time, Categoria, Competicao } from '../services/api';
import { Btn, Modal, Input, Select, Spinner, Empty } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { MatchCard } from '../components/MatchCard';
import { Icon } from '../components/Icon';
import { groupMatches, matchPeriod, sortMatches, GroupMode, SortMode } from '../utils/matchSchedule';
import './Partidas.css';
import { ViewToggle, Choice, ConfirmDelete } from '../components/CollectionControls';
import { BlockColumns } from '../components/BlockColumns';
import { teamKey, teamName } from '../utils/teamIdentity';

const STATUSES = [
  { value: 'AGENDADA', label: 'Agendada' }, { value: 'PREPARADA', label: 'Preparada' },
  { value: 'AO_VIVO', label: 'Ao Vivo' }, { value: 'FINALIZADA', label: 'Finalizada' }, { value: 'CANCELADA', label: 'Cancelada' },
];
const FORM_VAZIO = { mandante_id: '', visitante_id: '', data: '', horario: '', local: '', categoria_id: '', competicao_id: '', rodada: '', emCasa: 'true' };

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
  const [groupMode, setGroupMode] = useState<GroupMode>('month');
  const [sortMode, setSortMode] = useState<SortMode>('priority');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [period, setPeriod] = useState('');
  const [opponent, setOpponent] = useState('');
  const [deleting,setDeleting] = useState<Partida|null>(null);
  const [deleteError,setDeleteError] = useState('');
  const [deleteBusy,setDeleteBusy] = useState(false);

  function carregar() {
    setLoadError('');
    setLoading(true);
    Promise.all([fetchPartidas(), fetchTimes(), fetchCategorias(), fetchCompeticoes()])
      .then(([p, t, c, comp]) => { setPartidas(p); setTimes(t); setCategorias(c); setCompeticoes(comp); })
      .catch(() => setLoadError('Não foi possível carregar as partidas. Tente novamente.')).finally(() => setLoading(false));
  }
  useEffect(carregar, [clube?.id]);
  function mudarFiltro(status: string, cat: string) {
    setPeriod(''); setFiltroStatus(status); setFiltroCategoria(cat);
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

  async function excluir() {
    if (!deleting) return; setDeleteBusy(true); setDeleteError('');
    try { await deletarPartida(deleting.id); setDeleting(null); carregar(); }
    catch (e) { setDeleteError((e as Error).message); } finally { setDeleteBusy(false); }
  }

  const timeOpts = times.filter(t=>String(t.categoria_id)===form.categoria_id).map(t => ({ value: t.id, label: teamName(t.nome) }));
  const catOpts = categorias.map(c => ({ value: c.id, label: c.nome }));
  const compOpts = competicoes.filter(c=>c.tipo===categorias.find(cat=>String(cat.id)===form.categoria_id)?.tipo).map(c => ({ value: c.id, label: `${c.nome} (${c.ano})` }));
  const opponentName = (p:Partida) => {
    const team = p.emCasa ? p.visitante || times.find(t=>t.id===p.visitante_id) : p.mandante || times.find(t=>t.id===p.mandante_id);
    return team?.nome || '';
  };
  const opponents = [...new Set(partidas.map(opponentName).map(teamKey).filter(Boolean))].sort();
  const filtered = partidas.filter(p=>(!filtroStatus||p.status===filtroStatus)&&(!filtroCategoria||p.categoria?.nome.toLowerCase()===categorias.find(c=>String(c.id)===filtroCategoria)?.nome.toLowerCase()||String(p.categoria_id)===filtroCategoria)&&(!opponent||teamKey(opponentName(p))===opponent));
  const periods = groupMatches(filtered, groupMode, 'earliest');
  const visibleMatches = filtered.filter(p => !period || matchPeriod(p.data, groupMode).key === period);
  const liveMatches = sortMode === 'priority' ? sortMatches(visibleMatches.filter(p => p.status === 'AO_VIVO'), 'earliest') : [];
  const groups = groupMatches(visibleMatches.filter(p => sortMode !== 'priority' || p.status !== 'AO_VIVO'), groupMode, sortMode);

  function renderMatch(p: Partida) {
    return <MatchCard key={p.id} featured={p.status === 'AO_VIVO'} partida={{ ...p,
      mandante: p.mandante || times.find(t => t.id === p.mandante_id),
      visitante: p.visitante || times.find(t => t.id === p.visitante_id),
      categoria: p.categoria || categorias.find(c => c.id === p.categoria_id),
    }} actions={podeGerenciar && !p.somente_leitura && <Btn variant="danger" size="sm" onClick={()=>{setDeleting(p);setDeleteError('');}} aria-label={`Excluir partida ${p.mandante?.nome || p.id} contra ${p.visitante?.nome || 'visitante'}`}><Icon name="trash" size={16} /></Btn>} />;
  }

  return (
    <div className="match-schedule">
      <div className="page-header">
        <div><span className="eyebrow">DENTRO DA QUADRA</span><h1 className="page-title">Partidas</h1><p className="page-sub">Agenda, placares e resultados do clube.</p></div>
        {podeGerenciar && <Btn onClick={() => { setForm(FORM_VAZIO); setErro(''); setModal(true); }}>+ Nova partida</Btn>}
      </div>

      <div className="collection-toolbar">
        <Choice label="Adversário" value={opponent} onChange={v=>{setOpponent(v);setPeriod('');}} options={[{value:'',label:'Todos os adversários'},...opponents.map(key=>({value:key,label:teamName(partidas.map(opponentName).find(name=>teamKey(name)===key)||key)}))]}/>
        <Choice label="Situação" value={filtroStatus} onChange={v=>mudarFiltro(v,filtroCategoria)} options={[{value:'',label:'Todas'},...STATUSES]}/>
        <Choice label="Categoria" value={filtroCategoria} onChange={v=>mudarFiltro(filtroStatus,v)} options={[{value:'',label:'Todos os subs'},...catOpts.map(c=>({value:String(c.value),label:c.label}))]}/>
        <Choice label="Período" value={period} onChange={setPeriod} options={[{value:'',label:'Todos os períodos'},...periods.map(p=>({value:p.key,label:p.label}))]}/>
        <Choice label="Ordenar" value={sortMode} onChange={v=>setSortMode(v as SortMode)} options={[{value:'priority',label:'Prioridade'},{value:'earliest',label:'Mais antigas'},{value:'latest',label:'Mais recentes'}]}/>
        {(opponent||filtroStatus||filtroCategoria||period)&&<Btn variant="ghost" size="sm" onClick={()=>{setOpponent('');mudarFiltro('','');}}>Limpar filtros</Btn>}
      </div>

      <div className="schedule-toolbar">
        <div className="schedule-group-control"><span>Agrupar por</span><div className="segmented-control" data-second={groupMode === 'week'} role="group" aria-label="Agrupamento por período">
          <button aria-pressed={groupMode === 'month'} onClick={() => { setGroupMode('month'); setPeriod(''); }}>Mês</button>
          <button aria-pressed={groupMode === 'week'} onClick={() => { setGroupMode('week'); setPeriod(''); }}>Semana</button>
        </div></div>
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </div>
      <p className="schedule-help">{sortMode === 'priority' ? 'Ao vivo em destaque. Em cada dia: preparadas, agendadas, finalizadas e canceladas.' : 'Partidas organizadas por data e horário, independentemente da situação.'}</p>

      {loading ? <Spinner /> : loadError ? <div className="notice-error" role="alert">{loadError}</div> : visibleMatches.length === 0 ? <Empty icon="⚽" message="Nenhuma partida publicada para os filtros selecionados" /> : <div className={`schedule-results schedule-${viewMode}`}>
        {liveMatches.length > 0 && <section className="live-section"><h2 className="section-title"><Icon name="live" size={17} /> Ao vivo agora <span>{liveMatches.length}</span></h2><BlockColumns list={viewMode==='list'}>{liveMatches.map(renderMatch)}</BlockColumns></section>}
        {groups.map(group => <section className="schedule-period" key={group.key}>
          <h2 className="period-heading"><Icon name="calendar" size={18} />{group.label}</h2>
          {group.days.map(day => <section className="schedule-day" key={day.date}><h3 className="day-heading"><time dateTime={day.date}>{day.label}</time><span>{day.matches.length} partida(s)</span></h3><BlockColumns list={viewMode==='list'}>{day.matches.map(renderMatch)}</BlockColumns></section>)}
        </section>)}
      </div>}

      <ConfirmDelete name={deleting?`partida ${deleting.id}`:null} busy={deleteBusy} error={deleteError} onClose={()=>setDeleting(null)} onConfirm={()=>void excluir()}/>
      <Modal open={modal} onClose={() => setModal(false)} title="Nova partida">
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
            <Btn variant="ghost" type="button" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Criar'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
