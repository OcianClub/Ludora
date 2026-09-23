import React from 'react';
import { Icon, IconName } from './Icon';
import './UI.css';

// ── Badge de status de partida ──
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  AGENDADA:   { label: 'Agendada',   cls: 'status-agendada' },
  PREPARADA:  { label: 'Preparada',  cls: 'status-preparada' },
  AO_VIVO:    { label: 'Ao Vivo',    cls: 'status-ao-vivo' },
  FINALIZADA: { label: 'Finalizada', cls: 'status-finalizada' },
  CANCELADA:  { label: 'Cancelada',  cls: 'status-cancelada' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || { label: status, cls: '' };
  return <span className={`status-badge ${s.cls}`}>{s.label}</span>;
}

// ── Badge de papel ──
const PAPEL_MAP: Record<string, string> = { ADMIN: 'Admin', TECNICO: 'Técnico', MESARIO: 'Mesário', TORCEDOR: 'Torcedor' };
export function PapelBadge({ papel }: { papel: string }) {
  return <span className={`papel-badge papel-${papel.toLowerCase()}`}>{PAPEL_MAP[papel] || papel}</span>;
}

// ── Card genérico ──
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

// ── Botão ──
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}
export function Btn({ variant = 'primary', size = 'md', className = '', children, ...rest }: BtnProps) {
  return (
    <button className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
      {children}
    </button>
  );
}

// ── Input ──
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}
export function Input({ label, error, className = '', ...rest }: InputProps) {
  const generatedId = React.useId();
  const id = rest.id || generatedId;
  return (
    <div className={`field ${className}`}>
      {label && <label className="field-label" htmlFor={id}>{label}</label>}
      <input className={`field-input${error ? ' field-input--error' : ''}`} {...rest} id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : rest['aria-describedby']} />
      {error && <span className="field-error" id={`${id}-error`}>{error}</span>}
    </div>
  );
}

// ── Select ──
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  emptyLabel?: string;
  options: { value: string | number; label: string }[];
}
export function Select({ label, options, emptyLabel = 'Selecionar...', className = '', ...rest }: SelectProps) {
  const generatedId = React.useId();
  const id = rest.id || generatedId;
  return (
    <div className={`field ${className}`}>
      {label && <label className="field-label" htmlFor={id}>{label}</label>}
      <select className="field-input" {...rest} id={id}>
        <option value="">{emptyLabel}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Modal ──
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    return () => { dialog?.close(); };
  }, [open]);
  if (!open) return null;
  return (
      <dialog ref={dialogRef} className="modal" aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal-header">
          <h2 className="modal-title" id={titleId}>{title}</h2>
          <button type="button" className="modal-close" aria-label="Fechar janela" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </dialog>
  );
}

// ── Spinner ──
export function Spinner() {
  return <div className="spinner" aria-label="Carregando" />;
}

// ── Empty state ──
export function Empty({ icon = '📭', message }: { icon?: string; message: string }) {
  const name: IconName = ({ '⚽': 'ball', '👥': 'team', '🏆': 'trophy', '🛡': 'shield' } as Record<string, IconName>)[icon] || 'shield';
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={name} size={36} /></span>
      <p className="empty-msg">{message}</p>
    </div>
  );
}

// ── Perfil ML badge ──
const PERFIL_MAP: Record<string, { label: string; cor: string }> = {
  Ofensivo:    { label: 'Ofensivo',    cor: '#FF4D00' },
  Defensivo:   { label: 'Defensivo',   cor: '#0E78FF' },
  Equilibrado: { label: 'Equilibrado', cor: '#F0B84E' },
};
export function PerfilBadge({ perfil }: { perfil?: string | null }) {
  if (!perfil) return <span className="texto-sec">—</span>;
  const p = PERFIL_MAP[perfil] || { label: perfil, cor: '#8B8D94' };
  return <span style={{ color: p.cor, fontWeight: 600, fontSize: 12 }}>{p.label}</span>;
}
