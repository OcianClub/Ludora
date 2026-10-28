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
const PAPEL_MAP: Record<string, string> = { ADMIN: 'Admin', TECNICO: 'Técnico', MESARIO: 'Mesário', TORCEDOR: 'Visitante', OLHEIRO: 'Olheiro' };
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

// Somente Modal controla o scroll da página. Bloqueios nos consumidores podem
// restaurar "hidden" depois desta limpeza e travar todas as rotas.
// O contador mantém o bloqueio até fechar o último modal sobreposto.
let activeModals = 0;
let restorePageScroll: (() => void) | undefined;

function lockPageScroll() {
  if (activeModals++ === 0) {
    const root = document.documentElement;
    const body = document.body;
    const x = window.scrollX;
    const y = window.scrollY;
    const rootOverflow = root.style.overflow;
    const rootGutter = root.style.scrollbarGutter;
    const bodyStyles = ['position', 'top', 'left', 'width', 'overflow'] as const;
    const previous = bodyStyles.map(property => body.style[property]);
    root.style.scrollbarGutter = 'stable';
    root.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${y}px`;
    body.style.left = `-${x}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    restorePageScroll = () => {
      root.style.overflow = rootOverflow;
      root.style.scrollbarGutter = rootGutter;
      bodyStyles.forEach((property, index) => { body.style[property] = previous[index]; });
      window.scrollTo({ left: x, top: y, behavior: 'instant' });
    };
  }
  return () => {
    if (--activeModals === 0) {
      restorePageScroll?.();
      restorePageScroll = undefined;
    }
  };
}

// ── Modal ──
export function Modal({ open, onClose, title, children, className = '', id, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; className?: string; id?: string; footer?: React.ReactNode }) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  React.useLayoutEffect(() => {
    if (open) return lockPageScroll();
  }, [open]);
  React.useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (open && dialog && !dialog.open) dialog.showModal();
    return () => {
      dialog?.close();
      if (open && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return (
      <dialog ref={dialogRef} id={id} className={`modal ${className}`} aria-labelledby={titleId}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
            return;
          }
          if (event.key !== 'Tab') return;
          const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
          )).filter(element => element.getClientRects().length > 0 && !element.closest('[inert]'));
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal-header">
          <h2 className="modal-title" id={titleId}>{title}</h2>
          <button type="button" className="modal-close" aria-label="Fechar janela" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
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
