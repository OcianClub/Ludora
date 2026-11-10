import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useDropdownPlacement } from '@web/hooks/useDropdownPlacement';

export function DesktopMenu({ label, children, trigger: triggerContent, className = '' }: { label: string; children: ReactNode; trigger?: ReactNode; className?: string }) {
  const [aberto, setAberto] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const placement = useDropdownPlacement(root, aberto, false, 480);
  useEffect(() => {
    if (!aberto) return;
    (root.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]') || root.current?.querySelector<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)'))?.focus();
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [aberto]);
  return <div className={`desktop-menu ${className}`} ref={root} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setAberto(false); }}>
    <button type="button" ref={trigger} className="btn btn-md btn-ghost desktop-menu-trigger" aria-label={label} aria-haspopup="menu" aria-expanded={aberto} aria-controls={aberto ? id : undefined}
      onClick={() => setAberto(a => !a)} onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setAberto(true); } }}>
      {triggerContent || <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>}
    </button>
    {aberto && <div id={id} role="menu" aria-label={label} className="desktop-menu-popover" style={placement} onClick={e => {
      if ((e.target as HTMLElement).closest('button[role^="menuitem"]:not(:disabled)')) { setAberto(false); trigger.current?.focus(); }
    }} onKeyDown={e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setAberto(false); trigger.current?.focus(); }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button[role^="menuitem"]:not(:disabled)')];
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }
    }}>{children}</div>}
  </div>;
}
