import { useEffect, useId, useState, type ReactNode } from 'react';
import './DesktopTabs.css';

export type DesktopTab<T extends string = string> = { value: T; label: ReactNode; count?: number; disabled?: boolean };

/** Abas controladas. Setas movem o foco; Enter/Espaço confirmam a troca. */
export function DesktopTabs<T extends string>({ label, value, options, onChange, children, className = '' }: {
  label: string; value: T; options: readonly DesktopTab<T>[]; onChange: (value: T) => void;
  children: ReactNode; className?: string;
}) {
  const id = useId();
  const [focused, setFocused] = useState(value);
  useEffect(() => { setFocused(value); }, [value]);
  const selected = options.findIndex(option => option.value === value);
  return <div className={`desktop-tabs ${className}`}>
    <div className="desktop-tabs-list" role="tablist" aria-label={label} onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)')];
      if (!tabs.length) return;
      const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next]?.focus();
    }}>
      {options.map((option, index) => <button key={option.value} type="button" role="tab" id={`${id}-tab-${index}`}
        aria-selected={option.value === value} aria-controls={`${id}-panel-${index}`} disabled={option.disabled}
        tabIndex={option.value === focused ? 0 : -1} onFocus={() => setFocused(option.value)}
        onClick={() => { if (option.value !== value) onChange(option.value); }}>{option.label}{option.count !== undefined && <span className="desktop-tabs-count">{option.count}</span>}</button>)}
    </div>
    <div className="desktop-tabs-panel" role="tabpanel" id={`${id}-panel-${selected}`} aria-labelledby={`${id}-tab-${selected}`} tabIndex={0}>
      {children}
    </div>
  </div>;
}
