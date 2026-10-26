import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';

export function FilterSelect({ label, value, emptyLabel, options, onChange, inlineOptions = false }: {
  label: string;
  value: string;
  emptyLabel: string;
  options: { value: string | number; label: string }[];
  onChange: (value: string) => void;
  inlineOptions?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const search = useRef({ text: '', time: 0 });
  const items = [{ value: '', label: emptyLabel }, ...options];
  const selected = Math.max(0, items.findIndex(item => String(item.value) === value));

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, id]);

  function choose(index: number) {
    onChange(String(items[index].value));
    setOpen(false);
  }

  return (
    <div className="schedule-select field" ref={root} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <span className="field-label" id={`${id}-label`}>{label}</span>
      <button type="button" className="schedule-select-trigger" role="combobox"
        aria-labelledby={`${id}-label`} aria-expanded={open} aria-haspopup="listbox"
        aria-controls={open ? `${id}-options` : undefined} data-value={value}
        aria-activedescendant={open ? `${id}-option-${active}` : undefined}
        onClick={() => { setActive(selected); setOpen(previous => !previous); }}
        onKeyDown={event => {
          if (event.key === 'Escape' && open) {
            event.preventDefault(); event.stopPropagation(); setOpen(false);
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setActive(open ? (active + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length : selected);
            setOpen(true);
          } else if (open && ['Home', 'End'].includes(event.key)) {
            event.preventDefault(); setActive(event.key === 'Home' ? 0 : items.length - 1);
          } else if (open && ['Enter', ' '].includes(event.key)) {
            event.preventDefault(); choose(active);
          } else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const now = Date.now();
            search.current = { text: (now - search.current.time < 600 ? search.current.text : '') + event.key.toLocaleLowerCase('pt-BR'), time: now };
            const index = items.findIndex(item => item.label.toLocaleLowerCase('pt-BR').startsWith(search.current.text));
            if (index >= 0) { event.preventDefault(); setActive(index); setOpen(true); }
          }
        }}>
        <span>{items[selected].label}</span>
        <span className="schedule-select-chevron"><Icon name="chevronRight" size={16} /></span>
      </button>
      {open && <div id={`${id}-options`} role="listbox" aria-labelledby={`${id}-label`} className={`schedule-select-options${inlineOptions ? ' schedule-select-options-inline' : ''}`}>
        {items.map((item, index) => (
          <div key={item.value} id={`${id}-option-${index}`} role="option" aria-selected={index === selected}
            data-highlighted={index === active} onPointerMove={() => setActive(index)}
            onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
            <span>{item.label}</span>{index === selected && <span aria-hidden="true" className="schedule-select-check">✓</span>}
          </div>
        ))}
      </div>}
    </div>
  );
}
