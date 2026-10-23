import { Link } from 'react-router-dom';
import type { HomePartida } from '../services/api';
import { ClubBadge } from './Brand';
import { Icon } from './Icon';
import { teamName } from '../utils/teamIdentity';
import { dataHome, resultadoPartida } from '../utils/homeDashboard';

export const RESULTADOS = { V: 'Vitória', E: 'Empate', D: 'Derrota' };

export function HomeMatch({ partida }: { partida: HomePartida }) {
  const live = partida.status === 'AO_VIVO';
  return (
    <article className="home-main-match">
      <div className="home-match-top">
        <span>{partida.competicao?.nome || 'Competição não informada'}</span>
        <span className="home-match-venue"><Icon name={partida.emCasa ? 'home' : 'switchClub'} size={16} />{partida.emCasa ? 'Em casa' : 'Fora'}</span>
      </div>
      <div className="home-scoreboard">
        <div className="home-team">
          <ClubBadge src={partida.mandante?.escudo} name={teamName(partida.mandante?.nome || 'Mandante')} size={72} />
          <strong>{teamName(partida.mandante?.nome || 'Mandante')}</strong>
        </div>
        <div className="home-score" aria-label={live ? `${partida.gols_mandante} a ${partida.gols_visitante}` : 'Contra'}>
          {live ? <><span>{partida.gols_mandante}</span><i aria-hidden="true">·</i><span>{partida.gols_visitante}</span></> : <span className="home-versus">VS</span>}
        </div>
        <div className="home-team">
          <ClubBadge src={partida.visitante?.escudo} name={teamName(partida.visitante?.nome || 'Visitante')} size={72} />
          <strong>{teamName(partida.visitante?.nome || 'Visitante')}</strong>
        </div>
      </div>
      <div className="home-match-meta">
        <div><Icon name="calendar" size={20} /><span><small>Data</small><strong>{dataHome(partida.data)}</strong></span></div>
        <div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></svg>
          <span><small>Horário</small><strong>{partida.horario || 'A definir'}</strong></span>
        </div>
      </div>
      <p className="home-match-location"><Icon name="location" size={18} />{partida.local || 'Local a definir'}</p>
      <Link className="btn btn-primary home-match-cta" to={`/partidas/${partida.id}`}>
        {live ? 'Acompanhar ao vivo' : 'Ver detalhes da partida'}
        <Icon name={live ? 'live' : 'chevronRight'} size={20} />
      </Link>
    </article>
  );
}

export function HomeHistoryMatch({ partida }: { partida: HomePartida }) {
  const resultado = resultadoPartida(partida);
  const mandante = teamName(partida.mandante?.nome || 'Mandante');
  const visitante = teamName(partida.visitante?.nome || 'Visitante');
  const label = `${mandante} ${partida.gols_mandante} a ${partida.gols_visitante} ${visitante}. ${RESULTADOS[resultado]} em ${dataHome(partida.data, true)}.${partida.competicao?.nome ? ` ${partida.competicao.nome}.` : ''} Ver detalhes da partida.`;
  return (
    <Link to={`/partidas/${partida.id}`} className="home-history-match" aria-label={label}>
      <div className="home-history-top">
        <div className="home-history-meta">
          <Icon name="calendar" size={18} />
          <time dateTime={partida.data.slice(0, 10)}>{dataHome(partida.data)}</time>
          <small title={partida.competicao?.nome}>{partida.competicao?.nome || 'Sem competição informada'}</small>
        </div>
        <span className={`home-result-tag result-${resultado}`}>{RESULTADOS[resultado]}</span>
      </div>
      <div className="home-history-teams">
        <div className={`home-history-team${partida.emCasa ? ' is-club' : ''}`}>
          <ClubBadge src={partida.mandante?.escudo} name={mandante} size={36} />
          <span>{mandante}{partida.emCasa && <small>Seu clube</small>}</span>
          <strong className="home-history-score">{partida.gols_mandante}</strong>
        </div>
        <div className={`home-history-team${!partida.emCasa ? ' is-club' : ''}`}>
          <ClubBadge src={partida.visitante?.escudo} name={visitante} size={36} />
          <span>{visitante}{!partida.emCasa && <small>Seu clube</small>}</span>
          <strong className="home-history-score">{partida.gols_visitante}</strong>
        </div>
      </div>
      <div className="home-history-footer">
        <span><Icon name={partida.emCasa ? 'home' : 'bus'} size={17} />{partida.emCasa ? 'Em casa' : 'Fora de casa'} · Encerrada</span>
        <span className="home-history-action">Ver partida<Icon name="chevronRight" size={17} /></span>
      </div>
    </Link>
  );
}
