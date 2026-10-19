import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Btn, Modal } from './UI';
import './CollectionControls.css';

export type ViewMode = 'grid' | 'list';
export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  return <div className="collection-view segmented-control" data-second={value === 'list'} role="group" aria-label="Modo de visualização">
    <button type="button" aria-pressed={value === 'grid'} onClick={() => onChange('grid')}><Icon name="grid" size={16} /> Blocos</button>
    <button type="button" aria-pressed={value === 'list'} onClick={() => onChange('list')}><Icon name="list" size={16} /> Lista</button>
  </div>;
}
export function Choice({ label, value, options, onChange, disabled = false }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return <div className="choice field" ref={root} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
    <span className="field-label" id={`${id}-label`}>{label}</span>
    <button ref={trigger} type="button" className="field-input choice-trigger" aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open && !disabled} aria-controls={`${id}-options`} disabled={disabled}
      onClick={() => setOpen(!open)} onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('[data-choice-option]')?.focus()); } }}>
      <span id={`${id}-value`}>{options.find(o => o.value === value)?.label || 'Selecionar'}</span><span aria-hidden="true">⌄</span>
    </button>
    {open && !disabled && <div id={`${id}-options`} className="choice-options" role="group" aria-labelledby={`${id}-label`} onKeyDown={e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); trigger.current?.focus(); }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault(); const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')]; const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      }
    }}>{options.map(option => <button data-choice-option key={option.value} type="button" aria-pressed={option.value === value} onClick={() => { onChange(option.value); setOpen(false); trigger.current?.focus(); }}>{option.label}</button>)}</div>}
  </div>;
}
export function ConfirmDelete({ name, busy, error, onClose, onConfirm }: { name: string | null; busy: boolean; error: string; onClose: () => void; onConfirm: () => void }) {
  return <Modal open={name !== null} onClose={() => { if (!busy) onClose(); }} title="Confirmar exclusão">
    <p>Deseja excluir <strong>{name}</strong>? Esta ação não pode ser desfeita pelo site.</p>
    {error && <p role="alert" className="notice-error">{error}</p>}
    <div className="collection-dialog-actions"><Btn type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancelar</Btn><Btn type="button" variant="danger" disabled={busy} onClick={onConfirm}>{busy ? 'Excluindo...' : 'Confirmar exclusão'}</Btn></div>
  </Modal>;
}
export function PositionBadge({ position }: { position: string }) {
  const label = normalizePosition(position);
  return <span className={`position-badge position-${label === 'Goleiro' ? 'keeper' : label === 'Fixo' ? 'back' : label === 'Pivô' ? 'pivot' : 'wing'}`}>
    {label === 'Goleiro' && <Icon name="defense" size={14} />}{label}
  </span>;
}
export function normalizePosition(value: string) { return /^ala/i.test(value) ? 'Alas' : value; }
export const POSITIONS = ['Goleiro', 'Fixo', 'Pivô', 'Alas'];
