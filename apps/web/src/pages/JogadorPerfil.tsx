import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { requestJson } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Btn, Spinner, StatusBadge } from '../components/UI';
import { Icon } from '../components/Icon';
import { PositionBadge } from '../components/CollectionControls';
import { PlayerEditDialog, type EditablePlayer } from '../components/PlayerEditDialog';
import { formatCpf } from '../utils/playerForm';
import { playerAge } from '../utils/playerAge';
import { FilterSelect } from '../components/FilterSelect';
import './JogadorPerfil.css';

type PlayerMatch = { id: number; data: string; horario?: string; status: string; gols_mandante: number; gols_visitante: number; mandante: { nome: string }; visitante: { nome: string } };
type Championship = { id: number; nome: string; ano: number; tipo: string };
type Profile = EditablePlayer & { categoria: { id: number; nome: string; tipo: string }; podeEditar: boolean; totalPartidas: number; totalCompeticoes: number; partidas: PlayerMatch[]; campeonatos: Championship[] };
type History = { items: (PlayerMatch | Championship)[]; total: number; pagina: number; porPagina: number };

function MatchLinks({ items }: { items: PlayerMatch[] }) {
  return <ul className="player-history-list">{items.map(match => <li key={match.id}><Link to={`/partidas/${match.id}`}><span><strong>{match.mandante.nome} <em>{match.gols_mandante} × {match.gols_visitante}</em> {match.visitante.nome}</strong><small>{match.data.slice(0,10).split('-').reverse().join('/')} · {match.horario || 'Sem horário'}</small></span><StatusBadge status={match.status}/><Icon name="chevronRight" size={18}/></Link></li>)}</ul>;
}
function ChampionshipList({ items }: { items: Championship[] }) {
  return <ul className="player-history-list">{items.map(item => <li key={item.id}><span className="player-championship"><Icon name="trophy" size={22}/><span><strong>{item.nome}</strong><small>{item.ano} · {item.tipo === 'BASE' ? 'Base' : 'Iniciação'}</small></span></span></li>)}</ul>;
}

export default function JogadorPerfil({ history }: { history?: 'partidas' | 'campeonatos' }) {
  const { id } = useParams(); const { clube } = useAuth(); const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [player, setPlayer] = useState<Profile | null>(null), [records, setRecords] = useState<History | null>(null);
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [version, setVersion] = useState(0), [edit, setEdit] = useState(false);
  const query = params.toString();
  const from = typeof location.state?.from === 'string' && location.state.from.startsWith('/jogadores?') ? location.state.from : '/jogadores';
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setPlayer(null); setRecords(null); setEdit(false);
    Promise.all([requestJson<Profile>(`/jogadores/${id}`, { signal: controller.signal }), history ? requestJson<History>(`/jogadores/${id}/${history}?${query}`, { signal: controller.signal }) : null])
      .then(([profile, list]) => { if (!controller.signal.aborted) { setPlayer(profile); setRecords(list); } })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, clube?.id, history, query, version]);
  const page = records?.pagina || 1;
  return <div className="player-profile-page">
    <Link className="player-back" to={history ? `/jogadores/${id}` : from} state={{ from }}><Icon name="chevronLeft" size={18}/>{history ? 'Perfil do jogador' : 'Jogadores'}</Link>
    {loading ? <Spinner/> : error ? <div className="notice-error" role="alert">{error}<Btn variant="ghost" onClick={() => setVersion(v => v + 1)}>Tentar novamente</Btn></div> : player && <>
      <header className="player-profile-header"><div className="player-portrait">{player.foto ? <img src={player.foto} alt={`Foto de ${player.nome}`}/> : <Icon name="user" size={44}/>}</div><div className="player-profile-title"><p className="eyebrow">{clube?.nome} · {player.categoria.nome.toUpperCase()}</p><h1>{player.nome}</h1><span><PositionBadge position={player.posicao}/> {player.posicao} · {playerAge(player.dtNasc)} anos · {player.numCamisa == null ? 'Sem camisa' : `Camisa ${player.numCamisa}`}</span></div><div className="player-profile-actions">{player.podeEditar && !history && <Btn aria-label="Editar jogador" variant="ghost" onClick={() => setEdit(true)}><Icon name="edit" size={20}/></Btn>}<Link className="btn btn-ghost btn-md" aria-label="Abrir scout do jogador" to={`/elenco?atleta=${id}&categoria_id=${player.categoria.id}&fase=${player.categoria.tipo}`}><Icon name="radar" size={20}/></Link></div></header>
      {history ? <section className="player-panel"><h2>{history === 'partidas' ? 'Histórico de partidas' : 'Histórico de campeonatos'}</h2>
        {history === 'partidas' ? <div className="player-history-filter"><FilterSelect label="Situação" emptyLabel="Todas as situações" value={params.get('status') || ''}
          options={[{ value: 'AGENDADA', label: 'Agendada' }, { value: 'PREPARADA', label: 'Preparada' }, { value: 'AO_VIVO', label: 'Ao vivo' }, { value: 'FINALIZADA', label: 'Finalizada' }, { value: 'CANCELADA', label: 'Cancelada' }]}
          onChange={value => setParams(current => { const next = new URLSearchParams(current); value ? next.set('status', value) : next.delete('status'); next.set('pagina', '1'); return next; })}/></div> : <label className="field player-history-filter"><span className="field-label">Ano · Enter para aplicar</span><input key={params.get('ano')} className="field-input" inputMode="numeric" placeholder="Todos" maxLength={4} defaultValue={params.get('ano') || ''} onInput={event => { event.currentTarget.value = event.currentTarget.value.replace(/\D/g,''); }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} onBlur={event => { const ano = event.target.value; if (!ano || ano.length === 4) setParams(ano ? { ano, pagina: '1' } : {}); }}/></label>}
        <p className="player-empty" role="status">{records?.total || 0} registros encontrados</p>
        {history === 'partidas' ? <MatchLinks items={(records?.items || []) as PlayerMatch[]}/> : <ChampionshipList items={(records?.items || []) as Championship[]}/>}
        <div className="player-pagination"><Btn variant="ghost" disabled={page <= 1} onClick={() => setParams(p => { p.set('pagina', String(page-1)); return p; })}>Anterior</Btn><span>Página {page}</span><Btn variant="ghost" disabled={!records || page * records.porPagina >= records.total} onClick={() => setParams(p => { p.set('pagina', String(page+1)); return p; })}>Próxima</Btn></div>
      </section> : <>
        <section className="player-panel"><h2>Dados do jogador</h2><dl className="player-facts"><div><dt>Nascimento</dt><dd>{player.dtNasc.slice(0,10).split('-').reverse().join('/')}</dd></div><div><dt>Posição</dt><dd>{player.posicao}</dd></div><div><dt>Camisa</dt><dd>{player.numCamisa ?? 'Não definida'}</dd></div><div><dt>Partidas registradas</dt><dd>{player.totalPartidas}</dd></div>{player.cpf !== undefined && <div><dt>CPF · acesso restrito</dt><dd>{formatCpf(player.cpf)}</dd></div>}</dl></section>
        <div className="player-preview-grid"><section className="player-panel"><header><h2>Últimas partidas <small>{player.totalPartidas}</small></h2><Link to={`/jogadores/${id}/partidas`} state={{ from }}>Histórico completo <Icon name="chevronRight" size={16}/></Link></header>{player.partidas.length ? <MatchLinks items={player.partidas}/> : <p className="player-empty">Nenhuma participação registrada.</p>}</section>
          <section className="player-panel"><header><h2>Campeonatos <small>{player.totalCompeticoes}</small></h2><Link to={`/jogadores/${id}/campeonatos`} state={{ from }}>Ver todos <Icon name="chevronRight" size={16}/></Link></header>{player.campeonatos.length ? <ChampionshipList items={player.campeonatos}/> : <p className="player-empty">Nenhuma inscrição ou participação registrada.</p>}</section></div>
      </>}
      {edit && <PlayerEditDialog player={player} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); setVersion(v => v+1); }}/>} 
    </>}
  </div>;
}
