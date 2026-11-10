import { useEffect, useId, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { useDropdownPlacement } from '@web/hooks/useDropdownPlacement';
import { DesktopToggleIndicator } from './DesktopToggle';
import './DesktopMenu.css';

export function DesktopMenu({ label, children, trigger: triggerContent, className = '', disabled = false, style, inline = false }: { label: string; children: ReactNode; trigger?: ReactNode; className?: string; disabled?: boolean; style?: CSSProperties; inline?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const placement = useDropdownPlacement(root, aberto, inline, 480);
  useEffect(() => {
    if (!aberto) return;
    (root.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]:not(:disabled)') || root.current?.querySelector<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)'))?.focus();
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [aberto]);
  return <div className={`desktop-menu${inline ? ' desktop-menu-inline' : ''} ${className}`} style={style} ref={root} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setAberto(false); }}>
    <button type="button" ref={trigger} disabled={disabled} className="btn btn-md btn-ghost desktop-menu-trigger" aria-label={label} aria-haspopup="menu" aria-expanded={aberto} aria-controls={aberto ? id : undefined}
      onClick={() => setAberto(a => !a)} onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setAberto(true); } }}>
      {triggerContent || <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>}
    </button>
    {aberto && <div id={id} role="menu" aria-label={label} className="desktop-menu-popover" style={placement} onClick={e => {
      if ((e.target as HTMLElement).closest('button[role^="menuitem"]:not(:disabled):not([data-menu-stay-open])')) { setAberto(false); trigger.current?.focus(); }
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

export function DesktopMenuItem({ children, icon, onSelect, disabled = false }: { children: ReactNode; icon?: ReactNode; onSelect: () => void; disabled?: boolean }) {
  return <button type="button" role="menuitem" disabled={disabled} onClick={onSelect}>{icon}{children}</button>;
}

export function DesktopMenuRadioItem({ children, icon, checked, onSelect, disabled = false, indicator = 'radio' }: {
  children: ReactNode; icon?: ReactNode; checked: boolean; onSelect: () => void; disabled?: boolean; indicator?: 'radio' | 'dot';
}) {
  return <button type="button" role="menuitemradio" aria-checked={checked} disabled={disabled} onClick={onSelect}>
    {icon}{children}{indicator === 'radio' ? <span className="desktop-menu-radio" aria-hidden="true"/> : checked && <span className="desktop-menu-selection-dot" aria-hidden="true"/>}
  </button>;
}

export function DesktopMenuToggleItem({ children, checked, onChange, disabled = false }: { children: ReactNode; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <button type="button" role="menuitemcheckbox" aria-checked={checked} disabled={disabled} data-menu-stay-open onClick={() => onChange(!checked)}>
    {children}<DesktopToggleIndicator checked={checked}/>
  </button>;
}

export function DesktopMenuSeparator() { return <hr role="separator"/>; }
export function DesktopMenuLabel({ children }: { children: ReactNode }) { return <span className="desktop-menu-label">{children}</span>; }
