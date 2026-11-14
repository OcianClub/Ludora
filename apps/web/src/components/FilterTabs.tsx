import { useEffect, useState, type ReactNode, type Ref } from 'react';
import './FilterTabs.css';

export type FilterTab<T extends string> = {
  value: T;
  label: ReactNode;
  count?: number | null;
  icon?: ReactNode;
  disabled?: boolean;
};

export function FilterTabs<T extends string>({
  label, value, options, onChange, className = '', mode = 'tabs', id, manual = false, listRef,
}: {
  label: string;
  value: T;
  options: readonly FilterTab<T>[];
  onChange: (value: T) => void;
  className?: string;
  mode?: 'tabs' | 'navigation' | 'filter';
  id?: string;
  manual?: boolean;
  listRef?: Ref<HTMLDivElement>;
}) {
  const [focused, setFocused] = useState(value);
  useEffect(() => { setFocused(value); }, [value]);
  const focusValue = manual ? focused : value;
  const selected = options.some(option => option.value === focusValue && !option.disabled)
    ? focusValue : options.find(option => !option.disabled)?.value;
  return <div ref={listRef} className={`filter-tabs ${className}`}
    role={mode === 'tabs' ? 'tablist' : mode === 'navigation' ? 'navigation' : 'group'} aria-label={label}
    onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const current = buttons.indexOf(event.target as HTMLButtonElement);
      if (current < 0) return;
      event.preventDefault();
      const step = event.key === 'ArrowRight' ? 1 : -1;
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : (current + step + buttons.length) % buttons.length;
      buttons[index].focus();
      if (!manual) buttons[index].click();
    }}>
    {options.map((option, index) => {
      const active = option.value === value;
      return <button key={option.value} type="button" role={mode === 'tabs' ? 'tab' : undefined}
        id={id ? `${id}-tab-${index}` : undefined} aria-controls={id ? `${id}-panel-${index}` : undefined}
        aria-selected={mode === 'tabs' ? active : undefined} aria-pressed={mode === 'filter' ? active : undefined}
        aria-current={mode === 'navigation' && active ? 'page' : undefined}
        tabIndex={mode === 'tabs' && option.value !== selected ? -1 : undefined}
        onFocus={manual ? () => setFocused(option.value) : undefined}
        data-active={active} disabled={option.disabled} onClick={() => onChange(option.value)}>
        {option.icon}{option.label}
        {option.count != null && <span className="filter-tabs-count">{option.count}</span>}
      </button>;
    })}
  </div>;
}
