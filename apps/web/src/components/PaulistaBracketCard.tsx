import { memo } from 'react';
import type { EquipePaulista, JogoPaulista } from '../../../../packages/shared-types/src/paulista';
import type { AvisoChaveamento } from '../utils/paulistaBracket';
import { estadoJogo, nomeOficial } from '../utils/paulistaView';
import { ClubBadge } from './Brand';
import { Icon } from './Icon';
import { formatMatchDate } from './MatchCard';

export interface BracketCardProps {
  jogo: JogoPaulista;
  equipes: Map<number, EquipePaulista>;
  minhas: Set<number>;
  avancou?: number;
  empate?: boolean;
  avisos: AvisoChaveamento[];
  onOpen: (j: JogoPaulista) => void;
}
export const PaulistaBracketCard = memo(function PaulistaBracketCard({ jogo: j, equipes, minhas, avancou, empate, avisos, onOpen }: BracketCardProps) {
  const own = minhas.has(j.mandanteId) || minhas.has(j.visitanteId);
  const conflito = avisos.some(a => a.tipo === 'conflito');
  const vencedor = !conflito && !j.ocorrencia && j.golsMandante !== null && j.golsVisitante !== null && j.golsMandante !== j.golsVisitante
    ? j.golsMandante > j.golsVisitante ? j.mandanteId : j.visitanteId : null;
  const equipe = (id: number) => nomeOficial(equipes.get(id)?.nome || 'Equipe a confirmar');
  const estado = conflito ? 'Publicação em conferência' : avisos.some(a => a.tipo === 'agenda') ? 'Agenda a confirmar' : avancou ? `${equipe(avancou)} avançou${empate ? ' após empate' : ''}` : estadoJogo(j);
  const explicacao = avancou ? `A presença de ${equipe(avancou)} na fase seguinte foi confirmada pela publicação da federação.${empate ? ' O desempate não foi calculado pelo Ludora.' : ''}` : '';
  return <button type="button" className={`paulista-bracket-game nodrag nopan${own ? ' is-own' : ''}${conflito ? ' has-conflict' : ''}`}
    data-game-id={j.id} onClick={() => onOpen(j)} aria-label={`${equipe(j.mandanteId)} contra ${equipe(j.visitanteId)}. ${estado}. Abrir detalhes.`}>
    <small><span>{j.data ? formatMatchDate(j.data) : 'Data a confirmar'}{j.horario ? ` · ${j.horario}` : ''}</span>{own && <span className="paulista-own-label">Seu clube</span>}</small>
    {[j.mandanteId, j.visitanteId].map((id, side) => <span className={`paulista-bracket-team${minhas.has(id) ? ' is-own' : ''}${vencedor === id ? ' has-won' : ''}`} key={id}>
      <ClubBadge src={equipes.get(id)?.escudo} name={equipe(id)} size={26}/><span className="paulista-bracket-team-name" title={equipe(id)}>{equipe(id)}</span>
      <b>{j.ocorrencia === 'WO' ? '—' : (side ? j.golsVisitante : j.golsMandante) ?? '—'}</b>
      {avancou === id && <span className="paulista-bracket-advance" role="img" title={explicacao} aria-label={`${equipe(id)} avançou para a próxima fase`}><Icon name="chevronRight" size={14}/></span>}
    </span>)}
    <small className="paulista-bracket-state" title={[estado, explicacao, ...avisos.map(a => a.mensagem)].filter(Boolean).join(' ')}>{avisos.length > 0 && <Icon name="alert" size={12}/>}<span>{estado}</span></small>
  </button>;
});
