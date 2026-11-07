import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Partida } from '../services/api';
import { ClubBadge } from './Brand';
import { Icon } from './Icon';
import { StatusBadge } from './UI';
import { teamName } from '../utils/teamIdentity';
import { useAuth } from '../contexts/AuthContext';
import './MatchCard.css';

// A data da partida é um dia do calendário; não deve mudar com o fuso horário.
export function formatMatchDate(value: string) {
  const date = value.slice(0, 10);
  const parts = date.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : 'Data a definir';
}

export function MatchCard({ partida: p, featured = false, actions, onOpen }: { partida: Partida; featured?: boolean; actions?: ReactNode; onOpen?: () => void }) {
  const navigate = useNavigate();
  const { clube } = useAuth();
  const live = p.status === 'AO_VIVO';
  const date = p.data ? new Date(`${p.data.slice(0, 10)}T12:00:00Z`) : null;
  const validDate = date && !Number.isNaN(date.getTime());
  const shortDate = validDate ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).replace(/ de /g, ' ').replace(/\./g, '').toUpperCase() : 'A definir';
  const weekday = validDate ? date.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace(/\./g, '') : '';
  const homeClub = p.mandante?.clube_representado_id === clube?.id;
  const awayClub = p.visitante?.clube_representado_id === clube?.id;
  const highlightHome = !p.semPerspectiva && (homeClub || (!awayClub && p.emCasa));
  const highlightAway = !p.semPerspectiva && (awayClub || (!homeClub && !p.emCasa));
  const occurrence = p.oficialPaulista?.ocorrencia;
  const hasScore = !occurrence && (p.oficialPaulista ? p.oficialPaulista.golsMandante !== null && p.oficialPaulista.golsVisitante !== null : p.status === 'AO_VIVO' || p.status === 'FINALIZADA');
  const result = p.emCasa ? p.gols_mandante - p.gols_visitante : p.gols_visitante - p.gols_mandante;
  const openMatch = () => onOpen ? onOpen() : navigate(`/partidas/${p.id}`);
  const ignoreNestedAction = (target: EventTarget | null) => target instanceof Element && !!target.closest('a, button, input, select, textarea');
  return <article className={`match-card match-card-interactive${featured ? ' match-card-featured' : ''}${live ? ' match-card-live' : ' match-card-static'}`}
    role={onOpen ? "button" : "link"} tabIndex={0} aria-label={`Ver partida ${teamName(p.mandante?.nome || 'Mandante')} contra ${teamName(p.visitante?.nome || 'Visitante')}`}
    onClick={event => { if (!ignoreNestedAction(event.target)) openMatch(); }}
    onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && !ignoreNestedAction(event.target)) { event.preventDefault(); openMatch(); } }}>
    <div className="match-card-header">
      <div className="match-calendar-highlight">
        <div className="match-calendar-heading">
          <time dateTime={validDate ? p.data.slice(0, 10) : undefined} data-tooltip={validDate ? formatMatchDate(p.data) : undefined}>{shortDate}</time>
          {p.paulista_evento_id && <small className="match-official-label">Campeonato Paulista</small>}<span className="match-category">{p.categoria?.nome?.toUpperCase() || 'Categoria não informada'}</span>
        </div>
        <span>{weekday && <span className="match-weekday">{weekday}</span>}<span><Icon name="clock" size={13} />{p.horario || 'Horário a definir'}</span></span>
      </div>
      <div className="match-card-badges">
        {occurrence ? <span className="status-badge">{occurrence === 'WO' ? 'W.O.' : 'Adiada'}</span> : live
          ? <span className="match-live-radar" role="img" aria-label="Partida ao vivo" data-tooltip="Partida ao vivo"><Icon name="broadcast" size={20} /></span>
          : p.status === 'FINALIZADA' ? <span className={p.semPerspectiva ? 'status-badge' : `match-result result-${result > 0 ? 'V' : result < 0 ? 'D' : 'E'}`}>{p.semPerspectiva ? 'Finalizada' : result > 0 ? 'Vitória' : result < 0 ? 'Derrota' : 'Empate'}</span>
          : p.status === 'CANCELADA' ? <span className="status-badge status-cancelada"><Icon name="cancel" size={14} />Cancelada</span> : <StatusBadge status={p.status} />}
        {!p.semPerspectiva && <span className="match-venue"><Icon name={p.emCasa ? 'home' : 'bus'} size={14} />{p.emCasa ? 'Casa' : 'Fora'}</span>}
      </div>
    </div>
    <div className="match-teams">
      <div className={`match-team${highlightHome ? ' match-team-current' : ''}`}><ClubBadge src={p.mandante?.escudo} name={teamName(p.mandante?.nome || 'Mandante')} size={52} /><strong data-tooltip={teamName(p.mandante?.nome || 'Mandante')} data-tooltip-overflow>{teamName(p.mandante?.nome || 'Mandante')}</strong></div>
      <div className="match-score" aria-label={hasScore ? `${p.gols_mandante} a ${p.gols_visitante}` : 'Contra'}>{hasScore ? <><span>{p.gols_mandante}</span><small aria-hidden="true">·</small><span>{p.gols_visitante}</span></> : <small>{occurrence === 'WO' ? 'W.O.' : 'VS'}</small>}</div>
      <div className={`match-team${highlightAway ? ' match-team-current' : ''}`}><ClubBadge src={p.visitante?.escudo} name={teamName(p.visitante?.nome || 'Visitante')} size={52} /><strong data-tooltip={teamName(p.visitante?.nome || 'Visitante')} data-tooltip-overflow>{teamName(p.visitante?.nome || 'Visitante')}</strong></div>
    </div>
    <div className="match-info">
      <span className="match-location"><Icon name="location" size={17} />{p.local || 'Local a definir'}</span>
    </div>
    <div className="match-card-actions">{onOpen ? <button type="button" className="btn btn-ghost btn-md" onClick={onOpen}>Ver detalhes<Icon name="chevronRight" size={18}/></button> : (<Link className={`btn btn-${featured ? 'primary' : 'ghost'} btn-md`} to={`/partidas/${p.id}`} aria-label={`${live ? 'Acompanhar ao vivo' : p.status === 'FINALIZADA' ? 'Ver súmula' : 'Ver detalhes'}: ${teamName(p.mandante?.nome || 'Mandante')} contra ${teamName(p.visitante?.nome || 'Visitante')}`}><span className="match-action-label">{p.status === 'AO_VIVO' ? 'Acompanhar ao vivo' : p.status === 'FINALIZADA' ? 'Ver súmula' : 'Ver detalhes'}</span><Icon name={p.status === 'AO_VIVO' ? 'live' : 'chevronRight'} size={18} /></Link>)}{actions}</div>
  </article>;
}
