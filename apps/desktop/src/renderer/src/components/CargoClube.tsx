import type { PapelClube } from '@ludora/shared-types';
import { Icon, type IconName } from '@web/components/Icon';
import { AdminIcon, type AdminIconName } from './AdminIcon';
import './CargoClube.css';

export const PAPEIS_CLUBE = [
  { value: 'ADMIN', label: 'Administrador' }, { value: 'TECNICO', label: 'Técnico' },
  { value: 'MESARIO', label: 'Mesário' }, { value: 'OLHEIRO', label: 'Olheiro' }, { value: 'TORCEDOR', label: 'Visitante' },
] as const satisfies readonly { value: PapelClube; label: string }[];

export const ICONES_CARGO_CLUBE: Record<PapelClube, IconName> = { ADMIN: 'shield', TECNICO: 'table', MESARIO: 'whistle', OLHEIRO: 'eye', TORCEDOR: 'user' };
export const ICONES_CARGO_PLATAFORMA: Record<string, AdminIconName> = { SUPERADMIN: 'shield', SUPORTE: 'headset', DESENVOLVEDOR: 'terminal' };

export function CargoIcon({ papel }: { papel: string }) {
  return <span className="desktop-role-icon" data-role={papel}>{ICONES_CARGO_PLATAFORMA[papel]
    ? <AdminIcon name={ICONES_CARGO_PLATAFORMA[papel]} size={13}/>
    : <Icon name={ICONES_CARGO_CLUBE[papel as PapelClube] || 'user'} size={13}/>}</span>;
}

export function CargoClube({ papel }: { papel: PapelClube }) {
  return <span className="desktop-role-badge" data-role={papel}>
    <Icon name={ICONES_CARGO_CLUBE[papel]} size={13}/><span>{PAPEIS_CLUBE.find(opcao => opcao.value === papel)?.label}</span>
  </span>;
}

export function CargoPlataforma({ papel }: { papel: string }) {
  const roles: Record<string, { label: string; icon: AdminIconName }> = {
    SUPERADMIN: { label: 'Administrador Ludora', icon: 'shield' },
    SUPORTE: { label: 'Suporte', icon: 'headset' },
    DESENVOLVEDOR: { label: 'Desenvolvedor', icon: 'terminal' },
  };
  const role = roles[papel];
  if (!role) return null;
  return <span className="desktop-role-badge" data-role={papel}><AdminIcon name={role.icon} size={13}/><span>{role.label}</span></span>;
}
