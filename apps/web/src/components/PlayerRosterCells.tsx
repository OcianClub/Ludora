import type { ReactNode } from 'react';
import { normalizePosition, PositionBadge } from './CollectionControls';
import { PlayerShirtButton } from './PlayerShirtDialog';
import { PlayerPortrait } from './PlayerProfileContent';
import { playerAge } from '../utils/playerAge';
import type { EditablePlayer } from './PlayerEditDialog';

export function PlayerRosterCells({ player, name, open, photo, shirt }: {
  player: EditablePlayer & { ativo?: boolean }; name: ReactNode; open: ReactNode; photo?: boolean; shirt?: ReactNode;
}) {
  const age = playerAge(player.dtNasc);
  return <>
    <td className="alunos-cell-shirt">{shirt ?? <PlayerShirtButton player={player} editable={false}/>}</td>
    <td className="alunos-cell-name">
      {photo ? <div className="alunos-identity"><PlayerPortrait player={player} size={18}/><div>{name}{player.ativo === false && <small>Inativo</small>}</div></div> : name}
    </td>
    <td className="alunos-cell-position"><span><PositionBadge position={player.posicao}/>{normalizePosition(player.posicao)}</span></td>
    <td className="alunos-cell-age">{Number.isFinite(age) ? `${age} anos` : 'Idade não informada'}</td>
    <td className="alunos-cell-open">{open}</td>
  </>;
}
