import type { UsuarioGlobal } from '@ludora/shared-types';
import type { ColunaUsuario, OrdemUsuario } from '../../../shared/user-order';
import { Icon } from '@web/components/Icon';
import { CargoClube, CargoPlataforma } from './CargoClube';
import { DesktopTable, DesktopSortButton } from './DesktopTable';
import './DesktopUserTable.css';

const columns: readonly [ColunaUsuario, string][] = [
  ['conta', 'Conta'], ['clube', 'Clube'], ['cargo', 'Cargo'], ['situacao', 'Situação'],
];

export function DesktopUserTable({ label, usuarios, ordem, onSort, onManage, currentUserId }: {
  label: string;
  usuarios: readonly UsuarioGlobal[];
  ordem: OrdemUsuario;
  onSort: (coluna: ColunaUsuario) => void;
  onManage: (usuario: UsuarioGlobal) => void;
  currentUserId?: number;
}) {
  const linhas = [...usuarios.filter(u => u.id === currentUserId), ...usuarios.filter(u => u.id !== currentUserId)];
  return <DesktopTable label={label} className="desktop-users-table" tableClassName="desktop-user-data-table">
    <thead><tr className="desktop-users-head">
      {columns.map(([coluna, texto]) => {
        const direction = ordem?.coluna === coluna ? ordem.direcao : undefined;
        return <th key={coluna} scope="col" aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}>
          <DesktopSortButton label={texto} direction={direction} onClick={() => onSort(coluna)}/>
        </th>;
      })}
      <th scope="col"><span className="sr-only">Gerenciar conta</span></th>
    </tr></thead>
    <tbody>{linhas.map(u => <tr key={u.id} className="desktop-user-line" data-self={u.id === currentUserId} onClick={e => {
      if (!(e.target as HTMLElement).closest('button')) onManage(u);
    }}>
      <td><div className="desktop-user-name">
        <span className="user-identity-avatar" aria-hidden="true">{u.nome.trim().slice(0, 1).toLocaleUpperCase('pt-BR')}</span>
        <span><strong title={u.nome}><span>{u.nome}</span>{u.id === currentUserId && <small className="desktop-self-chip">Você</small>}</strong><small title={u.email}>{u.email}</small></span>
      </div></td>
      <td><div className="desktop-user-clubs" title={u.clubes.map(c => c.nome).join(', ')}>
        <span>{u.clubes[0]?.nome || 'Sem clube vinculado'}</span>
        {u.clubes.length > 1 && <small>+{u.clubes.length - 1} {u.clubes.length === 2 ? 'clube' : 'clubes'}</small>}
      </div></td>
      <td><div className="desktop-user-role">{u.papel_plataforma !== 'USUARIO' ? <CargoPlataforma papel={u.papel_plataforma}/>
        : u.clubes[0] ? <CargoClube papel={u.clubes[0].papel}/> : <small>Sem cargo</small>}</div></td>
      <td><span className="desktop-user-state" data-suspended={u.suspenso}>
        <span className="user-active-dot" aria-hidden="true"/>{u.suspenso ? 'Suspensa' : 'Ativa'}
      </span></td>
      <td><button type="button" className="desktop-icon-action" aria-label={`Gerenciar ${u.nome}`} onClick={() => onManage(u)}>
        <Icon name="chevronRight" size={17}/>
      </button></td>
    </tr>)}</tbody>
  </DesktopTable>;
}
