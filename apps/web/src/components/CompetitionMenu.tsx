import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

export function CompetitionMenu({ name, archived, onRules, onEdit, onArchive, archiveBlockedReason }: {
  name: string; archived?: boolean; onRules: () => void; onEdit?: () => void; onArchive?: () => void; archiveBlockedReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const act = (action: () => void) => { setOpen(false); trigger.current?.focus(); action(); };
  return <div className="competition-menu" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button type="button" ref={trigger} aria-label={`Opções de ${name}`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(value => !value)}
      onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); } }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>
    </button>
    {open && <div className="competition-menu-options" role="menu" aria-label={`Opções de ${name}`} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=menuitem]')];
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      }
    }}>
      <button type="button" role="menuitem" onClick={() => act(onRules)}><Icon name="info" size={16}/>Regulamento</button>
      {onEdit && <button type="button" role="menuitem" onClick={() => act(onEdit)}><Icon name="edit" size={16}/>Editar competição</button>}
      {onArchive && <button type="button" role="menuitem" aria-disabled={!!archiveBlockedReason} onClick={() => { if (!archiveBlockedReason) act(onArchive); }}><Icon name="archive" size={16}/><span>{archived ? 'Restaurar competição' : 'Arquivar competição'}{archiveBlockedReason && <small>{archiveBlockedReason}</small>}</span></button>}
    </div>}
  </div>;
}
