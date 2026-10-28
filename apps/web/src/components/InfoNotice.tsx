import type { ReactNode } from 'react';
import { Icon } from './Icon';
import './InfoNotice.css';

export function InfoNotice({ title, children, className = '' }: { title: string; children?: ReactNode; className?: string }) {
  return <div className={`info-notice ${className}`} role="status">
    <Icon name="info" size={21} />
    <div><strong>{title}</strong>{children && <div className="info-notice-description">{children}</div>}</div>
  </div>;
}
