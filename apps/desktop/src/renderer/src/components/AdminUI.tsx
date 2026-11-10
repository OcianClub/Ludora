import type { ReactNode } from 'react';
import { Btn } from '@web/components/UI';
import { AdminIcon, type AdminIconName } from './AdminIcon';

// Os controles continuam compartilhados. A apresentação dos estados abaixo é
// específica do painel administrativo e não modifica Web ou Mobile.
export { Btn, Card, Input, Select, Modal, PapelBadge, StatusBadge } from '@web/components/UI';

export function DesktopState({ title, description, icon = 'info', error = false, onRetry, action }: {
  title: string;
  description?: string;
  icon?: AdminIconName;
  error?: boolean;
  onRetry?: () => void;
  action?: ReactNode;
}) {
  return <div className={`desktop-state${error ? ' desktop-state-error' : ''}`} role={error ? 'alert' : undefined}>
    <span className="desktop-state-icon"><AdminIcon name={error ? 'alert' : icon} size={23}/></span>
    <div className="desktop-state-copy"><h2>{title}</h2>{description && <p>{description}</p>}</div>
    {onRetry ? <Btn variant="ghost" onClick={onRetry}>Tentar novamente</Btn> : action}
  </div>;
}

export function Empty({ icon, message }: { icon?: string; message: string }) {
  const name: AdminIconName = icon === '👥' ? 'people' : icon === '🏆' ? 'trophy' : 'search';
  return <DesktopState title={message} icon={name}/>;
}

export function Spinner({ label = 'Carregando dados…' }: { label?: string }) {
  return <div className="desktop-loading-inline" role="status"><span className="spinner" aria-hidden="true"/><span>{label}</span></div>;
}

type SkeletonKind = 'rows' | 'cards' | 'table' | 'form' | 'match' | 'stats' | 'overview';

export function LoadingSkeleton({ kind = 'rows', label = 'Carregando dados', count = 4 }: {
  kind?: SkeletonKind; label?: string; count?: number;
}) {
  const length = Math.max(1, Math.min(count, 8));
  return <div className={`desktop-skeleton desktop-skeleton-${kind}`} role="status" aria-label={label}>
    {kind === 'overview' ? <>
      <div className="desktop-skeleton-heading" aria-hidden="true"><i/><i/></div>
      <div className="desktop-skeleton-stats" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div key={index}><i/><i/></div>)}</div>
      <div className="desktop-skeleton-item" aria-hidden="true"><b/><span><i/><i/></span></div>
    </> : Array.from({ length }, (_, index) => <div className="desktop-skeleton-item" key={index} aria-hidden="true">
      {(kind === 'rows' || kind === 'cards' || kind === 'table') && <b/>}
      <span><i/><i/></span>
      {kind === 'table' && <><i/><i/></>}
    </div>)}
  </div>;
}
