import type { ReactNode } from 'react';
import './DesktopTable.css';

/** Apresentação comum; os dados, colunas e a ordenação pertencem à tela. */
export function DesktopTable({ label, className = '', tableClassName = '', children }: {
  label: string; className?: string; tableClassName?: string; children: ReactNode;
}) {
  return <div className={`desktop-table-scroll ${className}`} role="region" aria-label={label} tabIndex={0}>
    <table className={`desktop-data-table ${tableClassName}`} aria-label={label}>{children}</table>
  </div>;
}

export function DesktopSortButton({ label, direction, onClick }: {
  label: string; direction?: 'asc' | 'desc'; onClick: () => void;
}) {
  return <button type="button" className="desktop-sort-button" data-direction={direction}
    aria-label={`Ordenar por ${label}`} onClick={onClick}>
    {label}<span className="desktop-sort-indicator" aria-hidden="true"><i/><i/></span>
  </button>;
}
