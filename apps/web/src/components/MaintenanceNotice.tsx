import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';
import { useMaintenance } from '../contexts/MaintenanceContext';
import './MaintenanceNotice.css';

export function MaintenanceNotice({ sidebar = false, expanded = false }: { sidebar?: boolean; expanded?: boolean }) {
  const { pauses } = useMaintenance();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pinned) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setPinned(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [pinned]);
  if (!pauses.length) return null;
  const open = pinned || hovered || focused;

  return <div className={sidebar ? 'maintenance-notice maintenance-notice-sidebar' : 'maintenance-notice'} ref={root}
    onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(true); }}
    onPointerLeave={() => setHovered(false)}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { setFocused(false); setPinned(false); } }}
    onKeyDown={event => {
      if (event.key === 'Escape' && open) { setPinned(false); setHovered(false); setFocused(false); }
    }}>
    <button type="button" className="maintenance-notice-trigger" aria-label="Funções em manutenção"
      aria-expanded={open} aria-controls={id} onFocus={event => { if (event.currentTarget.matches(':focus-visible')) setFocused(true); }}
      onClick={() => { setFocused(false); setPinned(value => !value); }}>
      <Icon name="alert" size={19} />
      {expanded && <span>Funções em manutenção</span>}
    </button>
    {open && <section id={id} className="maintenance-notice-panel" aria-label="Funções em manutenção">
      <strong>Funções em manutenção</strong>
      <ul>{pauses.map(pause => <li key={`${pause.escopo}:${pause.operacao}`}>
        <span>{pause.label}{pause.escopo === 'CLUBE' ? ' · Este clube' : ''}</span>
        <small>{pause.motivo}</small>
      </li>)}</ul>
    </section>}
  </div>;
}
