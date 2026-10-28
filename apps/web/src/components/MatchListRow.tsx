import { Link } from 'react-router-dom';
import type { Partida } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { teamName } from '../utils/teamIdentity';
import { ClubBadge } from './Brand';
import { Icon } from './Icon';
import { StatusBadge } from './UI';
import './MatchListRow.css';

export function MatchListRow({ partida: p }: { partida: Partida }) {
  const { clube } = useAuth();
  const date = new Date(`${p.data.slice(0, 10)}T12:00:00Z`);
  const validDate = !Number.isNaN(date.getTime());
  const dateLabel = validDate ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).replace(/ de /g, ' ').replace(/\./g, '').toUpperCase() : 'A definir';
  const weekday = validDate ? date.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace(/\./g, '') : '';
  const home = teamName(p.mandante?.nome || 'Mandante');
  const away = teamName(p.visitante?.nome || 'Visitante');
  const result = (p.gols_mandante - p.gols_visitante) * (p.emCasa ? 1 : -1);
  const homeClub = p.mandante?.clube_representado_id === clube?.id;
  const awayClub = p.visitante?.clube_representado_id === clube?.id;
  const highlightHome = homeClub || (!awayClub && p.emCasa);
  const highlightAway = awayClub || (!homeClub && !p.emCasa);
  const finished = p.status === 'FINALIZADA';

  return (
    <Link className="match-list-row" to={`/partidas/${p.id}`} aria-label={`${home} contra ${away}, ${dateLabel}, ${p.horario || 'horário a definir'}. Ver partida.`}>
      <div className="match-list-date">
        <time dateTime={validDate ? p.data.slice(0, 10) : undefined}>{dateLabel}</time>
        <span><span>{weekday}</span><span className="match-list-time"><Icon name="clock" size={13} />{p.horario || 'A definir'}</span></span>
        <small>{p.categoria?.nome?.toUpperCase() || 'Categoria a definir'}</small>
      </div>
      <div className="match-list-contest">
        <div className={`match-list-team${highlightHome ? ' is-current' : ''}`}>
          <ClubBadge src={p.mandante?.escudo} name={home} size={40} />
          <strong title={home}>{home}</strong>
        </div>
        <div className={`match-list-score${finished ? ' has-result' : ''}`} aria-label={finished ? `${p.gols_mandante} a ${p.gols_visitante}` : 'Contra'}>
          {finished ? <><b>{p.gols_mandante}</b><i aria-hidden="true">·</i><b>{p.gols_visitante}</b></> : <small>VS</small>}
        </div>
        <div className={`match-list-team${highlightAway ? ' is-current' : ''}`}>
          <ClubBadge src={p.visitante?.escudo} name={away} size={40} />
          <strong title={away}>{away}</strong>
        </div>
      </div>
      <span className="match-list-location"><Icon name="location" size={16} /><span>{p.local || 'Local a definir'}</span></span>
      <div className="match-list-status">
        {finished ? <span className={`match-result result-${result > 0 ? 'V' : result < 0 ? 'D' : 'E'}`}>{result > 0 ? 'Vitória' : result < 0 ? 'Derrota' : 'Empate'}</span>
          : p.status === 'CANCELADA' ? <span className="status-badge status-cancelada"><Icon name="cancel" size={14} />Cancelada</span>
          : <StatusBadge status={p.status} />}
        <span className="match-venue"><Icon name={p.emCasa ? 'home' : 'bus'} size={13} />{p.emCasa ? 'Casa' : 'Fora'}</span>
      </div>
      <span className="match-list-open"><Icon name="chevronRight" size={18} /></span>
    </Link>
  );
}
