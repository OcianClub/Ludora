import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { requestJson, type PerfilJogador } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Btn, LoadingSkeleton, Modal, StatusBadge } from '../components/UI';
import { Icon, type IconName } from '../components/Icon';
import { PositionBadge } from '../components/CollectionControls';
import { PlayerEditDialog, type EditablePlayer } from '../components/PlayerEditDialog';
import { ScoutPlayerDetail } from '../components/ScoutPlayerDetail';
import { formatCpf } from '../utils/playerForm';
import { playerAge } from '../utils/playerAge';
import { FilterSelect } from '../components/FilterSelect';
import { ClubBadge } from '../components/Brand';
import { formatShirtNumber } from '../utils/lineupShirts';
import type { FiltroContextoScout } from '../../../mobile/src/utils/contextoScout';
import './JogadorPerfil.css';

type Registers = { gols: number; assistencias: number; defesas: number; faltas: number; cartoes: number; golsContra: number };
type PlayerMatch = {
  id: number; data: string; horario?: string; status: string; gols_mandante: number; gols_visitante: number;
  mandante: { nome: string; escudo?: string }; visitante: { nome: string; escudo?: string };
  competicao?: { id: number; nome: string } | null; equipe_id?: number; mandante_id?: number;
  resultado?: 'VITORIA' | 'DERROTA' | 'EMPATE' | null; registros?: Registers; convocado?: boolean; titularInicial?: boolean | null;
};
type Championship = { id: number; nome: string; ano: number; tipo: string; inscrito?: boolean; partidasFinalizadas?: number; convocacoes?: number; registros?: Registers };
type Profile = EditablePlayer & {
  categoria: { id: number; nome: string; tipo: string }; ativo: boolean; categoria_id: number; podeEditar: boolean; totalPartidas: number; totalCompeticoes: number;
  resumo?: Registers & { convocacoes: number }; temporadas?: number[]; opcoesCampeonatos?: { id: number; nome: string; ano: number }[];
  partidas: PlayerMatch[]; campeonatos: Championship[];
};
type History = { items: (PlayerMatch | Championship)[]; total: number; pagina: number; porPagina: number };
type Analyze = (filter: FiltroContextoScout) => void;
const RESULTS = { VITORIA: 'Vitória', DERROTA: 'Derrota', EMPATE: 'Empate' };

function Empty({ championships = false }: { championships?: boolean }) {
  return <div className="player-empty" role="status"><Icon name={championships ? 'trophy' : 'ball'} size={27}/><p>{championships ? 'Nenhum campeonato neste período.' : 'Nenhuma partida neste filtro.'}</p></div>;
}

function MatchList({ items, analyze }: { items: PlayerMatch[]; analyze: Analyze }) {
  return <div className="player-match-table-wrap"><table className="player-match-table"><thead><tr><th>Data</th><th>Confronto</th><th>Resultado</th><th>Registros do atleta</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{items.map(match => {
    const final = match.status === 'FINALIZADA', registers = match.registros;
    return <tr key={match.id}>
      <td className="player-game-date"><b>{match.data.slice(8,10)}</b><span>{new Date(`${match.data.slice(0,10)}T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '')}</span></td>
      <td className="player-game-match"><Link to={`/partidas/${match.id}`} aria-label={`Ver súmula: ${match.mandante.nome} ${match.gols_mandante} a ${match.gols_visitante} ${match.visitante.nome}`}>
        <span className="player-game-teams">{[match.mandante, match.visitante].map((team, index) => <span key={index} className={`player-game-team${index === 1 ? ' player-game-away' : ''}${match.equipe_id != null && (index === 0 ? match.equipe_id === match.mandante_id : match.equipe_id !== match.mandante_id) ? ' is-player-team' : ''}`}><ClubBadge name={team.nome} src={team.escudo} size={24}/><strong title={team.nome}>{team.nome}</strong><b>{index === 0 ? match.gols_mandante : match.gols_visitante}</b></span>)}<span className="player-game-score" aria-hidden="true"><b>{match.gols_mandante}</b><i>–</i><b>{match.gols_visitante}</b></span></span>
      </Link><small title={match.competicao?.nome}>{match.competicao?.nome || 'Sem competição informada'}{match.horario && ` · ${match.horario.slice(0,5)}`}</small></td>
      <td className="player-game-result">{final && match.resultado ? <span className={`player-result player-result-${match.resultado.toLowerCase()}`}>{RESULTS[match.resultado]}</span> : <StatusBadge status={match.status}/>}</td>
      <td className="player-game-registers">{registers ? <><div className="player-individual-numbers"><span><b>{registers.gols}</b> gols</span><span><b>{registers.assistencias}</b> assist.</span><span><b>{registers.defesas}</b> defesas</span></div><small>{!match.convocado ? 'Evento registrado' : match.titularInicial === true ? 'Titular inicial' : match.titularInicial === false ? 'Reserva inicial' : 'Convocado'}{!final && ' · provisório'}</small></> : <small>Registros indisponíveis</small>}</td>
      <td className="player-game-action"><button type="button" onClick={() => analyze({ partida_id: match.id })} aria-label={`Ver análise da partida de ${match.data.slice(0,10).split('-').reverse().join('/')}`}><Icon name="radar" size={15}/><span>Ver análise</span><Icon name="chevronRight" size={14}/></button></td>
    </tr>;
  })}</tbody></table></div>;
}

function ChampionshipList({ items, analyze }: { items: Championship[]; analyze: Analyze }) {
  return <ul className="player-championships">{items.map(item => <li key={item.id}>
    <div className="player-championship-title"><span className="player-competition-icon"><Icon name="trophy" size={21}/></span><div><h3>{item.nome}</h3><p>{item.ano} · {item.tipo === 'BASE' ? 'Base' : 'Iniciação'}</p></div></div>
    {item.partidasFinalizadas ? <><dl className="player-competition-numbers"><div><dt>Convocações</dt><dd>{item.convocacoes ?? 0}</dd></div><div><dt>Gols</dt><dd>{item.registros?.gols ?? 0}</dd></div><div><dt>Assistências</dt><dd>{item.registros?.assistencias ?? 0}</dd></div><div><dt>Defesas</dt><dd>{item.registros?.defesas ?? 0}</dd></div></dl><button type="button" className="player-analysis-link" onClick={() => analyze({ competicao_id: item.id })}>Ver análise do campeonato <Icon name="chevronRight" size={15}/></button></> : <p className="player-competition-pending"><Icon name="info" size={15}/>{item.inscrito ? 'Inscrito · ainda sem registros em partidas finalizadas' : 'Ainda sem registros em partidas finalizadas'}</p>}
  </li>)}</ul>;
}

function HistoryPanel({ id, kind, query, analyze }: { id: string; kind: 'partidas' | 'campeonatos'; query: string; analyze: Analyze }) {
  const [records, setRecords] = useState<History | null>(null), [page, setPage] = useState(1), [loading, setLoading] = useState(true), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    const params = new URLSearchParams(query); params.delete('aba'); params.set('pagina', String(page));
    requestJson<History>(`/jogadores/${id}/${kind}?${params}`, { signal: controller.signal })
      .then(list => { if (!controller.signal.aborted) setRecords(previous => ({ ...list, items: page === 1 ? list.items : [...(previous?.items || []), ...list.items] })); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, kind, query, page, attempt]);
  return <>
    <p className="player-history-count" role="status">{!records && loading ? 'Carregando…' : `${records?.total || 0} ${kind === 'partidas' ? 'partidas' : 'campeonatos'}`}</p>
    {error && <div role="alert" className="notice-error">{error}<Btn variant="ghost" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</Btn></div>}
    {!records && loading ? <LoadingSkeleton kind="table"/> : records?.items.length ? kind === 'partidas' ? <MatchList items={records.items as PlayerMatch[]} analyze={analyze}/> : <ChampionshipList items={records.items as Championship[]} analyze={analyze}/> : !error && <Empty championships={kind === 'campeonatos'}/>}
    {records && records.items.length < records.total && !error && <div className="player-history-more"><Btn variant="ghost" disabled={loading} onClick={() => setPage(value => value + 1)}>{loading ? 'Carregando…' : `Carregar mais (${records.total - records.items.length})`}</Btn></div>}
  </>;
}

export default function JogadorPerfil({ history }: { history?: 'partidas' | 'campeonatos' }) {
  const { id } = useParams(); const { clube } = useAuth(); const location = useLocation(); const [params, setParams] = useSearchParams();
  const [player, setPlayer] = useState<Profile | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [version, setVersion] = useState(0), [edit, setEdit] = useState(false);
  const [scout, setScout] = useState<FiltroContextoScout | null>(null), [filters, setFilters] = useState(false), [draft, setDraft] = useState({ status: '', competicao_id: '' });
  const query = params.toString(), tab = history || (params.get('aba') === 'dados' ? 'dados' : 'resumo');
  const from = typeof location.state?.from === 'string' && location.state.from.startsWith('/jogadores?') ? location.state.from : '/jogadores';
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setPlayer(null); setEdit(false); setScout(null);
    requestJson<Profile>(`/jogadores/${id}`, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setPlayer(data); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, clube?.id, version]);
  const changeSeason = (ano: string) => setParams(current => { const next = new URLSearchParams(current); next.delete('pagina'); ano ? next.set('ano', ano) : next.delete('ano'); return next; });
  return <div className="player-profile-page player-profile-v2">
    <Link className="player-back" to={from}><span><Icon name="arrow" size={18}/></span>Voltar aos jogadores</Link>
    {loading ? <LoadingSkeleton kind="match"/> : error ? <div className="notice-error" role="alert">{error}<Btn variant="ghost" onClick={() => setVersion(value => value + 1)}>Tentar novamente</Btn></div> : player && <>
      <header className="player-profile-header"><div className="player-portrait">{player.foto ? <img src={player.foto} alt={`Foto de ${player.nome}`}/> : <Icon name="user" size={30}/>}</div><div className="player-profile-title"><p className="eyebrow"><ClubBadge name={clube?.nome} src={clube?.escudo} size={20}/><span>{clube?.nome} · {player.categoria.nome.toUpperCase()}</span></p><h1>{player.nome}</h1><span><PositionBadge position={player.posicao}/>{player.posicao}<i/>{Number.isFinite(playerAge(player.dtNasc)) ? `${playerAge(player.dtNasc)} anos` : 'Idade não informada'}<span className="player-number-tag">{player.numCamisa == null ? 'Sem camisa' : `Camisa ${formatShirtNumber(player.numCamisa)}`}</span></span></div><div className="player-profile-actions">{player.podeEditar && <Btn aria-label="Editar jogador" variant="ghost" onClick={() => setEdit(true)}><Icon name="edit" size={16}/><span>Editar</span></Btn>}<Btn className="player-scout-link" variant="ghost" onClick={() => setScout({})}><Icon name="radar" size={17}/>Ver Scout</Btn></div></header>
      <nav className="player-profile-tabs" aria-label="Seções do jogador">{[{ key: 'resumo', label: 'Resumo', path: '' }, { key: 'partidas', label: 'Partidas', path: '/partidas' }, { key: 'campeonatos', label: 'Campeonatos', path: '/campeonatos' }, { key: 'dados', label: 'Dados', path: '?aba=dados' }].map(item => <Link key={item.key} to={`/jogadores/${id}${item.path}`} state={{ from }} aria-label={item.key === 'dados' ? 'Dados cadastrais' : undefined} aria-current={tab === item.key ? 'page' : undefined}>{item.label}</Link>)}</nav>
      {tab === 'dados' ? <section className="player-panel player-data-panel"><header><h2>Dados cadastrais</h2>{player.podeEditar && <Btn variant="ghost" size="sm" onClick={() => setEdit(true)}><Icon name="edit" size={15}/>Editar dados</Btn>}</header><dl className="player-facts"><div><dt>Nome completo</dt><dd>{player.nome}</dd></div><div><dt>Nascimento</dt><dd>{player.dtNasc.slice(0,10).split('-').reverse().join('/')}</dd></div><div><dt>Categoria</dt><dd>{player.categoria.nome.toUpperCase()} · {player.categoria.tipo === 'BASE' ? 'Base' : 'Iniciação'}</dd></div>{player.cpf !== undefined && <div><dt><Icon name="shield" size={13}/>CPF · acesso restrito</dt><dd>{player.cpf ? formatCpf(player.cpf) : 'Não informado'}</dd></div>}</dl></section> : history ? <section className="player-history-section"><header className="player-section-heading"><div><h2>{history === 'partidas' ? 'Partidas do atleta' : 'Campeonatos do atleta'}</h2><p>{history === 'partidas' ? 'Resultado da equipe e contribuição registrada na súmula.' : 'Inscrições e registros do atleta em cada campeonato.'}</p></div><div className="player-history-controls"><FilterSelect label="Temporada" emptyLabel="Todas as temporadas" value={params.get('ano') || ''} options={(history === 'campeonatos' ? [...new Set(player.opcoesCampeonatos?.map(item => item.ano) || [])].sort((a,b) => b-a) : player.temporadas || []).map(year => ({ value: String(year), label: String(year) }))} onChange={changeSeason}/>{history === 'partidas' && <Btn variant="ghost" aria-label="Mais filtros de partidas" onClick={() => { setDraft({ status: params.get('status') || '', competicao_id: params.get('competicao_id') || '' }); setFilters(true); }}><Icon name="filters" size={17}/><span>Filtros</span>{(params.has('status') || params.has('competicao_id')) && <span className="player-filter-dot"/>}</Btn>}</div></header>
        <HistoryPanel key={`${id}-${clube?.id}-${history}-${query}-${version}`} id={id!} kind={history} query={query} analyze={setScout}/>
      </section> : <>
        <section className="player-overview"><header className="player-section-heading"><h2>Registros do atleta</h2><span>Partidas finalizadas</span></header><dl className="player-summary-metrics">{[{ name: 'Convocações', value: player.resumo?.convocacoes, icon: 'team' }, { name: 'Gols', value: player.resumo?.gols, icon: 'ball' }, { name: 'Assistências', value: player.resumo?.assistencias, icon: 'handshake' }, { name: 'Defesas', value: player.resumo?.defesas, icon: 'defense' }].map(metric => <div key={metric.name}><dt><Icon name={metric.icon as IconName} size={17}/>{metric.name}</dt><dd>{metric.value ?? '—'}</dd></div>)}</dl><p className="player-registration-note"><Icon name="info" size={13}/>Convocação não confirma entrada em campo ou minutos jogados.</p></section>
        <section className="player-recent-section"><header className="player-section-heading"><div><h2>Últimas partidas</h2><p>Resultado da equipe e registros individuais.</p></div><Link to={`/jogadores/${id}/partidas`} state={{ from }}>Ver todas ({player.totalPartidas})<Icon name="chevronRight" size={15}/></Link></header>{player.partidas.length ? <MatchList items={player.partidas} analyze={setScout}/> : <Empty/>}</section>
        <section className="player-recent-section"><header className="player-section-heading"><h2>Campeonatos</h2><Link to={`/jogadores/${id}/campeonatos`} state={{ from }}>Ver todos ({player.totalCompeticoes})<Icon name="chevronRight" size={15}/></Link></header>{player.campeonatos.length ? <ChampionshipList items={player.campeonatos} analyze={setScout}/> : <Empty championships/>}</section>
      </>}
      {edit && <PlayerEditDialog player={player} categoryName={player.categoria.nome} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); setVersion(value => value + 1); }}/>}
      {scout && <ScoutPlayerDetail player={{ ...player, cpf: player.cpf || '', totalPartidas: player.resumo?.convocacoes || 0, totalGols: player.resumo?.gols || 0, totalAssistencias: player.resumo?.assistencias || 0, totalDefesas: player.resumo?.defesas || 0, totalFaltas: player.resumo?.faltas || 0, totalCartoes: player.resumo?.cartoes || 0, idade: playerAge(player.dtNasc) } as PerfilJogador} category={player.categoria.nome} initialFilter={scout} onClose={() => setScout(null)}/>}
    </>}
    <Modal open={filters} title="Filtrar partidas do atleta" className="player-history-filters" onClose={() => setFilters(false)} footer={<><Btn variant="ghost" onClick={() => setDraft({ status: '', competicao_id: '' })}>Limpar filtros</Btn><Btn onClick={() => { setParams(current => { const next = new URLSearchParams(current); next.delete('pagina'); for (const [key, value] of Object.entries(draft)) value ? next.set(key, value) : next.delete(key); return next; }); setFilters(false); }}>Aplicar filtros</Btn></>}><FilterSelect label="Situação" emptyLabel="Todas as situações" value={draft.status} options={[{ value: 'FINALIZADA', label: 'Finalizada' }, { value: 'AO_VIVO', label: 'Ao vivo' }]} onChange={status => setDraft(value => ({ ...value, status }))}/><FilterSelect label="Campeonato" emptyLabel="Todos os campeonatos" value={draft.competicao_id} options={(player?.opcoesCampeonatos || []).map(item => ({ value: String(item.id), label: item.nome }))} onChange={competicao_id => setDraft(value => ({ ...value, competicao_id }))}/></Modal>
  </div>;
}
