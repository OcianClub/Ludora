import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { HomePartida } from '../services/api';
import { ClubBadge } from './Brand';
import { Icon } from './Icon';
import { teamName } from '../utils/teamIdentity';
import { acaoHome, dataHome, hojeCalendario, resultadoPartida } from '../utils/homeDashboard';
import { useAuth } from '../contexts/AuthContext';

export const RESULTADOS = { V: 'Vitória', E: 'Empate', D: 'Derrota' };

function MatchCountdown({ date, time }: { date: string; time?: string | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const minutes = Math.ceil((new Date(`${date.slice(0, 10)}T${time || '00:00'}:00`).getTime() - now) / 60_000);
  if (!Number.isFinite(minutes) || minutes <= 0 || !time) return null;
  return <p className="home-countdown"><Icon name="clock" size={15} />{minutes >= 1440 ? `Em ${Math.floor(minutes / 1440)} dia(s)` : minutes >= 60 ? `Em ${Math.floor(minutes / 60)}h ${minutes % 60}min` : `Em ${minutes}min`}</p>;
}

export function HomeMatch({ partida, manager = false }: { partida: HomePartida; manager?: boolean }) {
  const { clube } = useAuth();
  const live = partida.status === 'AO_VIVO';
  const finished = partida.status === 'FINALIZADA';
  const oldLive = live && partida.data.slice(0, 10) < hojeCalendario();
  const action = acaoHome(partida, manager, clube?.id);
  return (
    <article className="home-main-match">
      <div className="home-match-top">
        <span className="home-match-competition">
          <Icon name="trophy" size={19} />
          <span>{partida.competicao?.nome || 'Competição não informada'}</span>
        </span>
        <span className="home-match-venue"><Icon name={partida.emCasa ? 'home' : 'bus'} size={16} />{partida.emCasa ? 'Em casa' : 'Fora'}</span>
      </div>
      <div className="home-scoreboard">
        <div className={`home-team${partida.emCasa ? ' is-club' : ''}`}>
          <ClubBadge src={partida.mandante?.escudo} name={teamName(partida.mandante?.nome || 'Mandante')} size={72} />
          <strong data-tooltip={teamName(partida.mandante?.nome || 'Mandante')} data-tooltip-overflow>{teamName(partida.mandante?.nome || 'Mandante')}{partida.emCasa && <span className="history-sr-only"> (Seu clube)</span>}</strong>
        </div>
        <div className="home-score" aria-label={live || finished ? `${partida.gols_mandante} a ${partida.gols_visitante}` : 'Contra'}>
          {live || finished ? <><span>{partida.gols_mandante}</span><i aria-hidden="true">·</i><span>{partida.gols_visitante}</span></> : <span className="home-versus">VS</span>}
        </div>
        <div className={`home-team${!partida.emCasa ? ' is-club' : ''}`}>
          <ClubBadge src={partida.visitante?.escudo} name={teamName(partida.visitante?.nome || 'Visitante')} size={72} />
          <strong data-tooltip={teamName(partida.visitante?.nome || 'Visitante')} data-tooltip-overflow>{teamName(partida.visitante?.nome || 'Visitante')}{!partida.emCasa && <span className="history-sr-only"> (Seu clube)</span>}</strong>
        </div>
      </div>
      {!live && !finished && <MatchCountdown date={partida.data} time={partida.horario} />}
      {finished && <p className={`home-last-result result-${resultadoPartida(partida)}`}>{RESULTADOS[resultadoPartida(partida)]} · Encerrada</p>}
      {oldLive && <p className="home-stale-live"><Icon name="info" size={16} /><span>{manager
        ? `Iniciada em ${dataHome(partida.data)}. Confira se já terminou.`
        : `Partida de ${dataHome(partida.data)}. O encerramento ainda não foi informado.`}</span></p>}
      <div className="home-match-meta">
        <div><Icon name="calendar" size={20} /><span><small>Data</small><strong>{dataHome(partida.data)}</strong></span></div>
        <div>
          <Icon name="clock" size={20} />
          <span><small>Horário</small><strong>{partida.horario || 'A definir'}</strong></span>
        </div>
        <p className="home-match-location"><Icon name="location" size={18} />{partida.local || 'Local a definir'}</p>
      </div>
      <Link className="btn btn-primary home-match-cta" to={`/partidas/${partida.id}`}>
        {action}
        <Icon name={live ? 'live' : 'chevronRight'} size={20} />
      </Link>
    </article>
  );
}

export function HomeHistoryTable({ partidas }: { partidas: HomePartida[] }) {
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const totals = partidas.reduce((counts, match) => {
    counts[resultadoPartida(match)] += 1;
    return counts;
  }, { V: 0, E: 0, D: 0 });

  function locateMatch(id: number) {
    const row = document.getElementById(`home-history-match-${id}`);
    row?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    row?.querySelector<HTMLAnchorElement>('.history-table-link')?.focus({ preventScroll: true });
  }

  return (
    <div className="home-history-table-wrap">
      <div className="history-summary" role="group" aria-label="Resumo dos resultados da categoria">
        <span className="history-summary-label">{partidas.length === 1 ? 'Último jogo' : `Últimos ${partidas.length} jogos`}</span>
        <div className="history-summary-results">
          {partidas.map(match => {
            const result = resultadoPartida(match);
            const description = `${RESULTADOS[result]}: ${teamName(match.mandante?.nome || 'Mandante')} ${match.gols_mandante} a ${match.gols_visitante} ${teamName(match.visitante?.nome || 'Visitante')}, ${dataHome(match.data, true)}`;
            return <button type="button" key={match.id} className={`history-summary-result result-${result}`}
              aria-label={`${description}. Localizar no histórico`} aria-controls={`home-history-match-${match.id}`}
              data-tooltip={description} onMouseEnter={() => setHighlighted(match.id)} onMouseLeave={() => setHighlighted(null)}
              onFocus={() => setHighlighted(match.id)} onBlur={() => setHighlighted(null)} onClick={() => locateMatch(match.id)}>
              <strong aria-hidden="true">{result}</strong>
            </button>;
          })}
        </div>
        <p className="history-summary-totals">
          <span className="history-summary-wins">{totals.V} {totals.V === 1 ? 'vitória' : 'vitórias'}</span><i aria-hidden="true">·</i>
          <span>{totals.E} {totals.E === 1 ? 'empate' : 'empates'}</span><i aria-hidden="true">·</i>
          <span className="history-summary-losses">{totals.D} {totals.D === 1 ? 'derrota' : 'derrotas'}</span>
        </p>
        <small className="history-summary-order">Mais recente primeiro</small>
      </div>
      <table className="home-history-table" aria-label={partidas.length === 1 ? 'Última partida' : `Últimas ${partidas.length} partidas`}>
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col" className="history-competition"><span className="history-competition-label">Competição</span><abbr className="history-competition-short" title="Competição">Comp.</abbr></th>
            <th scope="col" className="history-confrontation"><span className="history-confrontation-heading">Confronto<span>Placar</span></span></th>
            <th scope="col" className="history-result-cell">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {partidas.map(partida => {
            const result = resultadoPartida(partida);
            const home = teamName(partida.mandante?.nome || 'Mandante');
            const away = teamName(partida.visitante?.nome || 'Visitante');
            const month = new Date(`${partida.data.slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace(/\./g, '');
            return (
              <tr key={partida.id} id={`home-history-match-${partida.id}`} data-highlighted={highlighted === partida.id ? 'true' : undefined}>
                <td><time dateTime={partida.data.slice(0, 10)} aria-label={dataHome(partida.data, true)}><span className="history-date-wide" aria-hidden="true">{dataHome(partida.data)}</span><span className="history-date-compact" aria-hidden="true"><b>{partida.data.slice(8, 10)}</b><span>{month}</span></span></time></td>
                <td className="history-competition" data-tooltip={partida.competicao?.nome || 'Sem competição informada'} data-tooltip-overflow>{partida.competicao?.nome || 'Sem competição informada'}</td>
                <td className="history-confrontation">
                  <div className="history-table-teams">
                    <span className={partida.emCasa ? 'is-club' : ''}><ClubBadge src={partida.mandante?.escudo} name={home} size={28} /><span data-tooltip={home} data-tooltip-overflow>{home}{partida.emCasa && <span className="history-sr-only"> (Seu clube)</span>}</span></span>
                    <div className="history-table-score history-score-cell" aria-label={`${partida.gols_mandante} a ${partida.gols_visitante}`}><strong>{partida.gols_mandante}</strong><i aria-hidden="true">–</i><strong>{partida.gols_visitante}</strong></div>
                    <span className={!partida.emCasa ? 'is-club' : ''}><ClubBadge src={partida.visitante?.escudo} name={away} size={28} /><span data-tooltip={away} data-tooltip-overflow>{away}{!partida.emCasa && <span className="history-sr-only"> (Seu clube)</span>}</span></span>
                  </div>
                </td>
                <td className="history-result-cell"><div className="history-result-summary">
                  <span className={`home-result-tag result-${result}`}>{RESULTADOS[result]}</span>
                  <Link className="history-table-link" to={`/partidas/${partida.id}`} aria-label={`Ver partida: ${home} contra ${away}, ${dataHome(partida.data, true)}`}><Icon name="chevronRight" size={17} /></Link>
                </div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
