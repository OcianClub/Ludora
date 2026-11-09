import type { PapelClube } from '@ludora/shared-types';

export const PAPEIS_CLUBE = [
  { value: 'ADMIN', label: 'Administrador' }, { value: 'TECNICO', label: 'Técnico' },
  { value: 'MESARIO', label: 'Mesário' }, { value: 'OLHEIRO', label: 'Olheiro' }, { value: 'TORCEDOR', label: 'Visitante' },
] as const satisfies readonly { value: PapelClube; label: string }[];

export function CargoClube({ papel }: { papel: PapelClube }) {
  return <span className="user-role" data-role={papel}>{PAPEIS_CLUBE.find(opcao => opcao.value === papel)?.label}</span>;
}
