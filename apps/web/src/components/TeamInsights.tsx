import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchConfrontosTime, type ResumoConfronto, type ConfrontoTime } from '../services/api';
import { teamName } from '../utils/teamIdentity';
import { Btn, Spinner } from './UI';
import { Icon } from './Icon';
import './TeamInsights.css';

export function shortTeamDate(date: string) {
  return new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '');
}

export function TeamInsights({ teamId, clubeId, clubeName, summary, summaryLoading, summaryError, retrySummary, categoria, opponentName }: {
  teamId: number; clubeId: number; clubeName: string;
  summary?: ResumoConfronto; summaryLoading: boolean; summaryError: boolean; retrySummary: () => void;
  categoria?: { id: number; nome: string }; opponentName: string;
}) {
  const [data, setData] = useState<{ ultimas: ConfrontoTime[]; proximas: ConfrontoTime[] } | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    fetchConfrontosTime(teamId, categoria?.id).then(result => { if (active) setData(result); })
      .catch(() => { if (active) setError('Não foi possível carregar os jogos deste adversário.'); });
    return () => { active = false; };
  }, [teamId, clubeId, categoria?.id, version]);

  return <div className="team-insights">
    <section><h3>Confrontos com {clubeName}{categoria ? ` · ${categoria.nome.toUpperCase()}` : ''}</h3><p className="team-insights-scope">Somente partidas finalizadas</p>
      {summaryLoading ? <p role="status">Carregando retrospecto…</p> : summaryError ? <div role="alert"><p>Retrospecto indisponível.</p><Btn size="sm" variant="ghost" onClick={retrySummary}>Tentar novamente</Btn></div> : <>
        <div className="team-insights-stats">
          <div><strong>{summary?.vitorias || 0}</strong><span>Vitórias</span></div>
          <div><strong>{summary?.empates || 0}</strong><span>Empates</span></div>
          <div><strong>{summary?.derrotas || 0}</strong><span>Derrotas</span></div>
          <div><strong>{(summary?.golsPro || 0) - (summary?.golsContra || 0) > 0 ? '+' : ''}{(summary?.golsPro || 0) - (summary?.golsContra || 0)}</strong><span>Saldo</span></div>
        </div>
        <p className="team-insights-scope">{summary?.golsPro || 0} gols marcados · {summary?.golsContra || 0} sofridos</p>
      </>}
    </section>
    {!data && !error ? <Spinner/> : error ? <div role="alert"><p>{error}</p><Btn size="sm" variant="ghost" onClick={() => setVersion(value => value + 1)}>Recarregar jogos</Btn></div> : <>
      <section><div className="team-insights-section-header"><h3>Últimos 5 jogos</h3><Link to={`/partidas?status=FINALIZADA&busca=${encodeURIComponent(opponentName)}${categoria ? `&categoria_id=${categoria.id}` : ''}`}>Ver todos<Icon name="chevronRight" size={13}/></Link></div>
        {!data?.ultimas.length && <p className="team-insights-empty">Nenhuma partida finalizada entre os clubes.</p>}
        {data?.ultimas.map(match => {
          const ownHome = match.mandante.clube_representado_id === clubeId;
          const pro = ownHome ? match.gols_mandante : match.gols_visitante;
          const against = ownHome ? match.gols_visitante : match.gols_mandante;
          const outcome = pro > against ? 'win' : pro < against ? 'loss' : 'draw';
          return <Link className="team-recent-match" to={`/partidas/${match.id}`} key={match.id}>
            <span className="team-match-date">{shortTeamDate(match.data)}<small>{match.categoria.nome.toUpperCase()}</small></span>
            <span className="team-match-teams"><span>{teamName(match.mandante.nome)}</span><strong>{match.gols_mandante} · {match.gols_visitante}</strong><span>{teamName(match.visitante.nome)}</span></span>
            <span className={`team-result is-${outcome}`}>{outcome === 'win' ? 'Vitória' : outcome === 'loss' ? 'Derrota' : 'Empate'}</span>
          </Link>;
        })}
      </section>
      <section><h3>Próximos confrontos</h3>
        {!data?.proximas.length && <p className="team-insights-empty">Nenhum confronto agendado com este time.</p>}
        {data?.proximas.map(match => <Link key={match.id} to={`/partidas/${match.id}`} className="team-next-match">
          <span className="team-match-date">{shortTeamDate(match.data)}<small>{match.categoria.nome.toUpperCase()}</small></span>
          <span><strong><Icon name="clock" size={14}/>{match.horario || 'Horário a definir'}</strong><small>{match.mandante.clube_representado_id === clubeId ? 'Em casa' : 'Fora de casa'} · {match.status === 'PREPARADA' ? 'Preparada' : 'Agendada'}</small></span>
          <Icon name="chevronRight" size={16}/>
        </Link>)}
      </section>
    </>}
  </div>;
}
