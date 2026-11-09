import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchJogadoresPerfis, requestJson, type Competicao, type PerfilJogador } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Modal, Btn, LoadingSkeleton } from './UI';
import { CollectionSearch } from './CollectionToolbar';
import { FilterSelect } from './FilterSelect';
import { Icon } from './Icon';
import { ClubBadge } from './Brand';
import { PositionIcon } from './PositionIcon';
import { formatShirtNumber } from '../utils/lineupShirts';

type Ranking = { grupo: string; times: { key: string; nome: string; pontos: number; jogos: number; vitorias: number; empates: number; derrotas: number; saldo: number }[] };
const COLUNAS = [{ label: 'PTS', name: 'Pontos' }, { label: 'J', name: 'Jogos' }, { label: 'V', name: 'Vitórias' }, { label: 'E', name: 'Empates' }, { label: 'D', name: 'Derrotas' }, { label: 'SG', name: 'Saldo de gols' }];
const PAGE_SIZE = 10;
const normalizar = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export function CompetitionPanel({ competition, onClose }: { competition: Competicao; onClose: () => void }) {
  const { podeGerenciar, clube } = useAuth();
  const navigate = useNavigate();
  const [ranking, setRanking] = useState<Ranking[]>([]), [group, setGroup] = useState('');
  const [players, setPlayers] = useState<PerfilJogador[]>([]), [selected, setSelected] = useState<number[]>([]), [saved, setSaved] = useState<number[]>([]);
  const [loading, setLoading] = useState(true), [registrationLoading, setRegistrationLoading] = useState(false), [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [tab, setTab] = useState('classificacao'), [search, setSearch] = useState(''), [attempt, setAttempt] = useState(0);
  const [category, setCategory] = useState(''), [membership, setMembership] = useState(''), [page, setPage] = useState(0);
  const podeInscrever = podeGerenciar && !competition.arquivada;

  useEffect(() => {
    if (competition.paulista_evento_id) { navigate(`/competicoes/paulista?evento=${competition.paulista_evento_id}`); return; }
    const controller = new AbortController(); setLoading(true); setError('');
    requestJson<Ranking[]>(`/competicoes/${competition.id}/classificacao`, { signal: controller.signal })
      .then(table => { if (!controller.signal.aborted) { setRanking(table); setGroup(''); } })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [competition.id, competition.paulista_evento_id, navigate, attempt]);

  useEffect(() => {
    if (tab !== 'inscricoes' || !podeInscrever || registered) return;
    let active = true; setRegistrationLoading(true); setError('');
    Promise.all([fetchJogadoresPerfis(), requestJson<{ id_jogador: number }[]>(`/competicoes/${competition.id}/jogadores`)])
      .then(([list, registrations]) => {
        if (!active) return;
        const eligible = list.filter(j => j.categoria_tipo === competition.tipo);
        const ids = registrations.map(j => j.id_jogador);
        setPlayers(eligible); setSelected(ids); setSaved(ids); setRegistered(true);
        setCategory([...new Set(eligible.map(j => j.categoria_nome || ''))].sort((a,b) => a.localeCompare(b, 'pt-BR', { numeric: true }))[0] || '');
      })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setRegistrationLoading(false); });
    return () => { active = false; };
  }, [tab, podeInscrever, registered, competition.id, competition.tipo, attempt]);

  const selection = new Set(selected);
  const dirty = selected.length !== saved.length || saved.some(id => !selection.has(id));
  const categories = [...new Set(players.map(j => j.categoria_nome || ''))].filter(Boolean).sort((a,b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  const visiblePlayers = players.filter(j => (!category || j.categoria_nome === category)
    && (!membership || (membership === 'inscritos' ? selection.has(j.id) : !selection.has(j.id)))
    && normalizar(`${j.nome} ${j.numCamisa ?? ''} ${j.categoria_nome}`).includes(normalizar(search)))
    .sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const pages = Math.max(1, Math.ceil(visiblePlayers.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const pagePlayers = visiblePlayers.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const allPageSelected = pagePlayers.length > 0 && pagePlayers.every(j => selection.has(j.id));
  function updateFilter(update: () => void) { update(); setPage(0); }
  function togglePage() {
    const ids = new Set(pagePlayers.map(j => j.id));
    setSelected(previous => allPageSelected ? previous.filter(id => !ids.has(id)) : [...new Set([...previous, ...ids])]);
  }
  async function save() {
    setBusy(true); setError(''); setNotice('');
    try {
      // Keep selections hidden by the current category, search or page.
      await requestJson(`/competicoes/${competition.id}/jogadores`, { method: 'PUT', body: JSON.stringify({ jogador_ids: selected }) });
      setSaved([...selected]); setNotice('Inscrições do seu clube salvas.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (competition.paulista_evento_id) return null;
  const current = ranking[Number(group) || 0];
  return <Modal open title={competition.nome} onClose={() => { if (!busy) onClose(); }} className="competition-panel"
    footer={tab === 'inscricoes' && podeInscrever ? <div className="competition-registration-footer"><span><strong>{selected.length}</strong> inscritos no seu clube{dirty && <small>Alterações não salvas</small>}</span><Btn disabled={busy || registrationLoading || !registered || !dirty} onClick={() => void save()}>{busy ? 'Salvando…' : 'Salvar inscrições'}</Btn></div> : undefined}>
    <div className="competition-panel-intro"><span><Icon name="trophy" size={16}/>{competition.organizador?.nome || clube?.nome}</span><span>{competition.ano} · {competition.tipo === 'BASE' ? 'Base' : 'Iniciação'}</span><span>{competition.titulares_necessarios || 5} titulares · {competition.exigir_inscricao ? 'Inscrição obrigatória' : 'Inscrição não obrigatória'}</span></div>
    <div className="competition-panel-tabs" role="group" aria-label="Informações da competição"><button type="button" aria-pressed={tab === 'classificacao'} onClick={() => setTab('classificacao')}>Classificação</button>{podeInscrever && <button type="button" aria-pressed={tab === 'inscricoes'} onClick={() => setTab('inscricoes')}>Inscrições do meu clube</button>}</div>
    {tab === 'classificacao' ? loading ? <LoadingSkeleton kind="table"/> : current ? <>
      <div className="competition-ranking-heading"><h3>Classificação</h3><FilterSelect overlayInDialog label="Categoria / grupo" value={group} emptyLabel={ranking[0]?.grupo.toUpperCase() || 'Selecionar'} options={ranking.slice(1).map((g,i) => ({ value: String(i+1), label: g.grupo.toUpperCase() }))} onChange={setGroup}/></div>
      <div className="competition-table-scroll" role="region" aria-label={`Classificação ${current.grupo}`} tabIndex={0}><table className="competition-ranking"><caption className="sr-only">Classificação · {current.grupo}</caption><thead><tr><th scope="col">Equipe</th>{COLUNAS.map(c => <th scope="col" key={c.label} title={c.name}><span aria-hidden="true">{c.label}</span><span className="sr-only">{c.name}</span></th>)}</tr></thead><tbody>{current.times.map((t,index) => <tr key={t.key}><th scope="row"><span className="competition-ranking-team"><small aria-label={`${index+1}º lugar`}>{index+1}</small><ClubBadge name={t.nome} size={24}/><strong>{t.nome}</strong></span></th>{[t.pontos,t.jogos,t.vitorias,t.empates,t.derrotas,t.saldo].map((n,i) => <td key={i}>{n}</td>)}</tr>)}</tbody></table></div>
      <p className="competition-help">3 pontos por vitória · 1 por empate. Desempate: vitórias, saldo de gols e gols marcados.</p>
    </> : !error && <div className="competition-empty"><Icon name="table" size={28}/><strong>A classificação ainda não está disponível</strong><p>Ela aparece após a primeira partida finalizada.</p></div> : <>
      <div className="competition-registration-title"><div><h3>Elenco inscrito</h3><p className="competition-help">Escolha uma categoria e marque os atletas que poderão ser convocados.</p></div><Icon name="team" size={22}/></div>
      <div className="competition-registration-filters"><FilterSelect overlayInDialog label="Categoria" value={category} emptyLabel="Todas as categorias" options={categories.map(value => ({ value, label: value.toUpperCase() }))} onChange={value => updateFilter(() => setCategory(value))}/><CollectionSearch label="Buscar atleta para inscrição" value={search} onChange={value => updateFilter(() => setSearch(value))} placeholder="Buscar nome ou camisa"/></div>
      <div className="competition-registration-scope" role="group" aria-label="Filtrar inscrições">{[{value:'',label:'Todos'},{value:'inscritos',label:'Inscritos'},{value:'disponiveis',label:'Não inscritos'}].map(item => <button key={item.value} type="button" aria-pressed={membership === item.value} onClick={() => updateFilter(() => setMembership(item.value))}>{item.label}</button>)}</div>
      {registrationLoading ? <LoadingSkeleton kind="table"/> : <>
        <div className="competition-registration-count"><span>{visiblePlayers.length} atletas{category && ` · ${category.toUpperCase()}`}</span>{!!pagePlayers.length && <button type="button" disabled={busy} onClick={togglePage}>{allPageSelected ? 'Desmarcar página' : 'Selecionar página'}</button>}</div>
        <div className="competition-registration-list">{pagePlayers.map(j => <label key={j.id} data-selected={selection.has(j.id)}><input className="competition-checkbox" type="checkbox" disabled={busy} checked={selection.has(j.id)} onChange={e => { setNotice(''); setSelected(list => e.target.checked ? [...list,j.id] : list.filter(id => id !== j.id)); }}/><span className="competition-shirt" aria-hidden="true">{formatShirtNumber(j.numCamisa)}</span><span className="competition-registration-player"><strong>{j.nome}</strong><small><PositionIcon position={j.posicao} tooltip={false} decorative/>{j.posicao} · {j.categoria_nome?.toUpperCase()}</small></span></label>)}</div>
        {!visiblePlayers.length && !error && <div className="competition-empty"><Icon name="team" size={28}/><p>Nenhum atleta encontrado. Ajuste a categoria ou os filtros.</p></div>}
        {pages > 1 && <nav className="competition-pagination" aria-label="Páginas de atletas"><Btn variant="ghost" disabled={currentPage === 0 || busy} onClick={() => setPage(currentPage - 1)}><Icon name="chevronLeft" size={16}/>Anterior</Btn><span>Página {currentPage + 1} de {pages}</span><Btn variant="ghost" disabled={currentPage === pages - 1 || busy} onClick={() => setPage(currentPage + 1)}>Próxima<Icon name="chevronRight" size={16}/></Btn></nav>}
      </>}
    </>}
    {error && <div className="notice-error" role="alert">{error}<Btn variant="ghost" onClick={() => setAttempt(v => v+1)}>Tentar novamente</Btn></div>}{notice && <p className="competition-notice" role="status">{notice}</p>}
  </Modal>;
}
