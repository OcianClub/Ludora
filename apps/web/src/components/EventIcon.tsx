import { Icon } from './Icon';

export const EVENT_TYPES = [
  { value: 'GOL', label: 'Gol' },
  { value: 'CARTAO_AMARELO', label: 'Amarelo' },
  { value: 'CARTAO_VERMELHO', label: 'Vermelho' },
  { value: 'CARTAO_AZUL', label: 'Azul', unavailable: true },
  { value: 'FALTA', label: 'Falta' },
  { value: 'DEFESA', label: 'Defesa' },
  { value: 'ASSISTENCIA', label: 'Assistência' },
];

export function EventIcon({ type }: { type: string }) {
  if (type.startsWith('CARTAO_')) return <span aria-hidden="true" className={`event-card-symbol event-card-${type.toLowerCase()}`} />;
  return <Icon name={type === 'GOL' ? 'ball' : type === 'FALTA' ? 'whistle' : type === 'DEFESA' ? 'defense' : 'player'} size={23} />;
}
