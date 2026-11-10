import { AdminIcon, type AdminIconName } from './AdminIcon';
import './MaintenanceReasonIcon.css';

export const motivosPausa = ['Dados em conferência', 'Correção em andamento', 'Instabilidade na operação'];
export const motivosReativacao = ['Correção validada pela equipe', 'Dados conferidos', 'Serviço disponível novamente'];

const motivos: Record<string, { icon: AdminIconName; tone: string }> = {
  'Dados em conferência': { icon: 'search', tone: 'review' },
  'Correção em andamento': { icon: 'wrench', tone: 'fix' },
  'Instabilidade na operação': { icon: 'alert', tone: 'failure' },
  'Correção validada pela equipe': { icon: 'check', tone: 'success' },
  'Dados conferidos': { icon: 'clipboard', tone: 'checked' },
  'Serviço disponível novamente': { icon: 'live', tone: 'success' },
};

/** Apresentação apenas: motivos personalizados e antigos mantêm seu texto e usam ícone neutro. */
export function MaintenanceReasonIcon({ reason, size = 18 }: { reason: string; size?: number }) {
  const visual = motivos[reason.trim()] || { icon: 'info' as const, tone: 'other' };
  return <span className="maintenance-reason-icon" data-tone={visual.tone} aria-hidden="true"><AdminIcon name={visual.icon} size={size}/></span>;
}
