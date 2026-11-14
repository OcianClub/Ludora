import { useId, type ReactNode } from 'react';
import { FilterTabs, type FilterTab } from '@web/components/FilterTabs';
import './DesktopTabs.css';

export type DesktopTab<T extends string = string> = FilterTab<T>;

/** Abas controladas. Setas movem o foco; Enter/Espaço confirmam a troca. */
export function DesktopTabs<T extends string>({ label, value, options, onChange, children, className = '' }: {
  label: string; value: T; options: readonly DesktopTab<T>[]; onChange: (value: T) => void;
  children: ReactNode; className?: string;
}) {
  const id = useId();
  const selected = options.findIndex(option => option.value === value);
  return <div className={`desktop-tabs ${className}`}>
    <FilterTabs className="desktop-tabs-list" label={label} value={value} options={options}
      onChange={next => { if (next !== value) onChange(next); }} id={id} manual />
    <div className="desktop-tabs-panel" role="tabpanel" id={`${id}-panel-${selected}`} aria-labelledby={`${id}-tab-${selected}`} tabIndex={0}>
      {children}
    </div>
  </div>;
}
