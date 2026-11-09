import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { PositionBadge } from './CollectionControls';
import { ClubBadge } from './Brand';
import { StatusBadge } from './UI';
import { playerAge } from '../utils/playerAge';
import { formatCpf } from '../utils/playerForm';
import { formatShirtNumber } from '../utils/lineupShirts';
import type { EditablePlayer } from './PlayerEditDialog';
import '../pages/JogadorPerfil.css';

export type PlayerMatch = { id: number; data: string; horario?: string | null; status: string; gols_mandante: number; gols_visitante: number; mandante: { nome: string }; visitante: { nome: string } };
export type PlayerChampionship = { id: number; nome: string; ano: number; tipo: string };
export type PlayerProfileData = EditablePlayer & { categoria: { id: number; nome: string; tipo: string }; ativo?: boolean; totalPartidas: number; totalCompeticoes: number; partidas: PlayerMatch[]; campeonatos: PlayerChampionship[] };

export function PlayerPortrait({ player, size = 44 }: { player: Pick<EditablePlayer, 'nome' | 'foto'>; size?: number }) {
  return <div className="player-portrait">{player.foto ? <img src={player.foto} alt={`Foto de ${player.nome}`}/> : <Icon name="user" size={size}/>}</div>;
}

export function PlayerProfileHeader({ player, club, clubCrest, actions }: { player: PlayerProfileData; club?: string; clubCrest?: string | null; actions?: ReactNode }) {
  const age = playerAge(player.dtNasc);
  return <header className="player-profile-header">
    <PlayerPortrait player={player} size={30}/>
    <div className="player-profile-title"><p className="eyebrow">{club && <ClubBadge name={club} src={clubCrest} size={20}/>}<span>{[club, player.categoria.nome.toUpperCase()].filter(Boolean).join(' · ')}</span></p><h1>{player.nome}</h1>
      <span><PositionBadge position={player.posicao}/>{player.posicao}<i/>{Number.isFinite(age) ? `${age} anos` : 'Idade não informada'}<span className="player-number-tag">{player.numCamisa == null ? 'Sem camisa' : `Camisa ${formatShirtNumber(player.numCamisa)}`}</span>{player.ativo === false && ' · Inativo'}</span></div>
    {actions && <div className="player-profile-actions">{actions}</div>}
  </header>;
}

export function PlayerMatchList({ items, href }: { items: PlayerMatch[]; href?: (id: number) => string }) {
  return <ul className="player-history-list">{items.map(match => {
    const resumo = <><span><strong>{match.mandante.nome} <em>{match.gols_mandante} × {match.gols_visitante}</em> {match.visitante.nome}</strong><small>{match.data.slice(0, 10).split('-').reverse().join('/')} · {match.horario || 'Sem horário'}</small></span><StatusBadge status={match.status}/></>;
    return <li key={match.id}>{href ? <Link to={href(match.id)}>{resumo}<Icon name="chevronRight" size={18}/></Link> : <div className="player-match-summary">{resumo}</div>}</li>;
  })}</ul>;
}

export function PlayerChampionshipList({ items }: { items: PlayerChampionship[] }) {
  return <ul className="player-history-list">{items.map(item => <li key={item.id}><span className="player-championship"><Icon name="trophy" size={22}/><span><strong>{item.nome}</strong><small>{item.ano} · {item.tipo === 'BASE' ? 'Base' : 'Iniciação'}</small></span></span></li>)}</ul>;
}

export function PlayerProfilePanels({ player, matchHref, matchAction, championshipAction }: {
  player: PlayerProfileData; matchHref?: (id: number) => string; matchAction?: ReactNode; championshipAction?: ReactNode;
}) {
  return <>
    <section className="player-panel"><h2>Dados do jogador</h2>
      <dl className="player-facts"><div><dt>Nascimento</dt><dd>{player.dtNasc.slice(0, 10).split('-').reverse().join('/')}</dd></div><div><dt>Posição</dt><dd>{player.posicao}</dd></div><div><dt>Camisa</dt><dd>{player.numCamisa ?? 'Não definida'}</dd></div><div><dt>Partidas registradas</dt><dd>{player.totalPartidas}</dd></div>{player.cpf !== undefined && <div><dt>CPF · acesso restrito</dt><dd>{formatCpf(player.cpf)}</dd></div>}</dl>
    </section>
    <div className="player-preview-grid">
      <section className="player-panel"><header><h2>Últimas partidas <small>{player.totalPartidas}</small></h2>{matchAction}</header>{player.partidas.length ? <PlayerMatchList items={player.partidas} href={matchHref}/> : <p className="player-empty">Nenhuma participação registrada.</p>}</section>
      <section className="player-panel"><header><h2>Campeonatos <small>{player.totalCompeticoes}</small></h2>{championshipAction}</header>{player.campeonatos.length ? <PlayerChampionshipList items={player.campeonatos}/> : <p className="player-empty">Nenhuma inscrição ou participação registrada.</p>}</section>
    </div>
  </>;
}
