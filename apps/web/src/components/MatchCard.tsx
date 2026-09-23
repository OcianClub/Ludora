import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Partida } from '../services/api';
import { ClubBadge } from './Brand';
import { Icon } from './Icon';
import { StatusBadge } from './UI';
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
    <div className="match-card-header"><span>{p.categoria?.nome || 'Categoria não informada'}</span><StatusBadge status={p.status} /></div>
    <div className="match-teams">
      <div className="match-team"><ClubBadge src={p.mandante?.escudo} size={featured ? 58 : 44} /><strong>{p.mandante?.nome || 'Mandante'}</strong></div>
      <div className="match-score">{hasScore ? <><span>{p.gols_mandante}</span><small>:</small><span>{p.gols_visitante}</span></> : <small>VS</small>}</div>
      <div className="match-team"><ClubBadge src={p.visitante?.escudo} size={featured ? 58 : 44} /><strong>{p.visitante?.nome || 'Visitante'}</strong></div>
    </div>
    <div className="match-info">
      <span><Icon name="calendar" size={15} />{p.data ? formatMatchDate(p.data) : 'Data a definir'}{p.horario ? ` · ${p.horario}` : ''}</span>
      <span><Icon name="location" size={15} />{p.local || 'Local a definir'}</span>
    </div>
    <div className="match-card-actions"><Link className={`btn btn-${featured ? 'primary' : 'ghost'} btn-md`} to={`/partidas/${p.id}`}>Ver detalhes da partida<Icon name="arrow" size={16} /></Link>{actions}</div>
  </article>;
}
