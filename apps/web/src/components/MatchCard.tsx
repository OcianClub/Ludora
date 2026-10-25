import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Partida } from '../services/api';
import { ClubBadge } from './Brand';
import { Icon } from './Icon';
import { StatusBadge } from './UI';
import { teamName } from '../utils/teamIdentity';
import './MatchCard.css';

// A data da partida é um dia do calendário; não deve mudar com o fuso horário.
export function formatMatchDate(value: string) {
  const date = value.slice(0, 10);
  const parts = date.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : 'Data a definir';
}

export function MatchCard({ partida: p, featured = false, actions }: { partida: Partida; featured?: boolean; actions?: ReactNode }) {
  const hasScore = p.status === 'AO_VIVO' || p.status === 'FINALIZADA';
  return <article className={`match-card${featured ? ' match-card-featured' : ''}${p.status === 'AO_VIVO' ? ' match-card-live' : ''}`}>
    <div className="match-card-header">
      <span>{p.categoria?.nome || 'Categoria não informada'}</span>
      <div className="match-card-badges">
        <StatusBadge status={p.status} />
        <span className="match-venue"><Icon name={p.emCasa ? 'home' : 'bus'} size={14} />{p.emCasa ? 'Casa' : 'Fora'}</span>
      </div>
    </div>
    <div className="match-teams">
      <div className="match-team"><ClubBadge src={p.mandante?.escudo} name={teamName(p.mandante?.nome || 'Mandante')} size={52} /><strong>{teamName(p.mandante?.nome || 'Mandante')}</strong></div>
      <div className="match-score" aria-label={hasScore ? `${p.gols_mandante} a ${p.gols_visitante}` : 'Contra'}>{hasScore ? <><span>{p.gols_mandante}</span><small aria-hidden="true">·</small><span>{p.gols_visitante}</span></> : <small>VS</small>}</div>
      <div className="match-team"><ClubBadge src={p.visitante?.escudo} name={teamName(p.visitante?.nome || 'Visitante')} size={52} /><strong>{teamName(p.visitante?.nome || 'Visitante')}</strong></div>
    </div>
    <div className="match-info">
      <div className="match-date-time">
        <span><Icon name="calendar" size={17} /><time dateTime={p.data?.slice(0, 10)}>{p.data ? formatMatchDate(p.data) : 'Data a definir'}</time></span>
        <span><Icon name="clock" size={17} />{p.horario || 'Horário a definir'}</span>
      </div>
      <span className="match-location"><Icon name="location" size={17} />{p.local || 'Local a definir'}</span>
    </div>
    <div className="match-card-actions"><Link className={`btn btn-${featured ? 'primary' : 'ghost'} btn-md`} to={`/partidas/${p.id}`}>{p.status === 'AO_VIVO' ? 'Acompanhar ao vivo' : 'Ver partida'}<Icon name={p.status === 'AO_VIVO' ? 'live' : 'chevronRight'} size={18} /></Link>{actions}</div>
  </article>;
}
