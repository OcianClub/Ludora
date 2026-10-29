import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { HomePartida } from '../services/api';
import { ClubBadge } from './Brand';
import { Icon } from './Icon';
import { teamName } from '../utils/teamIdentity';
import { dataHome, resultadoPartida } from '../utils/homeDashboard';

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

export function HomeMatch({ partida }: { partida: HomePartida }) {
  const live = partida.status === 'AO_VIVO';
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
          <strong>{teamName(partida.mandante?.nome || 'Mandante')}{partida.emCasa && <span className="history-sr-only"> (Seu clube)</span>}</strong>
        </div>
        <div className="home-score" aria-label={live ? `${partida.gols_mandante} a ${partida.gols_visitante}` : 'Contra'}>
          {live ? <><span>{partida.gols_mandante}</span><i aria-hidden="true">·</i><span>{partida.gols_visitante}</span></> : <span className="home-versus">VS</span>}
        </div>
        <div className={`home-team${!partida.emCasa ? ' is-club' : ''}`}>
          <ClubBadge src={partida.visitante?.escudo} name={teamName(partida.visitante?.nome || 'Visitante')} size={72} />
          <strong>{teamName(partida.visitante?.nome || 'Visitante')}{!partida.emCasa && <span className="history-sr-only"> (Seu clube)</span>}</strong>
        </div>
      </div>
      {!live && <MatchCountdown date={partida.data} time={partida.horario} />}
      <div className="home-match-meta">
        <div><Icon name="calendar" size={20} /><span><small>Data</small><strong>{dataHome(partida.data)}</strong></span></div>
        <div>
          <Icon name="clock" size={20} />
          <span><small>Horário</small><strong>{partida.horario || 'A definir'}</strong></span>
        </div>
        <p className="home-match-location"><Icon name="location" size={18} />{partida.local || 'Local a definir'}</p>
      </div>
      <Link className="btn btn-primary home-match-cta" to={`/partidas/${partida.id}`}>
        {live ? 'Acompanhar ao vivo' : 'Ver detalhes da partida'}
        <Icon name={live ? 'live' : 'chevronRight'} size={20} />
      </Link>
    </article>
  );
}

export function HomeHistoryTable({ partidas }: { partidas: HomePartida[] }) {
  return (
    <div className="home-history-table-wrap">
      <table className="home-history-table" aria-label="Últimas cinco partidas">
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col" className="history-competition">Competição</th>
            <th scope="col">Confronto</th>
            <th scope="col" className="history-score-cell">Placar</th>
            <th scope="col">Resultado</th>
            <th scope="col" className="history-venue">Mando</th>
            <th scope="col"><span className="history-sr-only">Detalhes</span></th>
          </tr>
        </thead>
        <tbody>
          {partidas.map(partida => {
            const result = resultadoPartida(partida);
            const home = teamName(partida.mandante?.nome || 'Mandante');
            const away = teamName(partida.visitante?.nome || 'Visitante');
            return (
              <tr key={partida.id}>
                <td><time dateTime={partida.data.slice(0, 10)}>{dataHome(partida.data)}</time></td>
                <td className="history-competition">{partida.competicao?.nome || 'Sem competição informada'}</td>
                <td>
                  <div className="history-table-teams">
                    <span className={partida.emCasa ? 'is-club' : ''}><ClubBadge src={partida.mandante?.escudo} name={home} size={28} /><span title={home}>{home}{partida.emCasa && <span className="history-sr-only"> (Seu clube)</span>}</span></span>
                    <span className={!partida.emCasa ? 'is-club' : ''}><ClubBadge src={partida.visitante?.escudo} name={away} size={28} /><span title={away}>{away}{!partida.emCasa && <span className="history-sr-only"> (Seu clube)</span>}</span></span>
                  </div>
                </td>
                <td className="history-score-cell"><div className="history-table-score" aria-label={`${partida.gols_mandante} a ${partida.gols_visitante}`}><strong>{partida.gols_mandante}</strong><strong>{partida.gols_visitante}</strong></div></td>
                <td><span className={`home-result-tag result-${result}`}>{RESULTADOS[result]}</span></td>
                <td className="history-venue"><span><Icon name={partida.emCasa ? 'home' : 'bus'} size={16} />{partida.emCasa ? 'Em casa' : 'Fora'}</span></td>
                <td><Link className="history-table-link" to={`/partidas/${partida.id}`} aria-label={`Ver partida: ${home} contra ${away}, ${dataHome(partida.data, true)}`}><span>Ver partida</span><Icon name="chevronRight" size={17} /></Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
