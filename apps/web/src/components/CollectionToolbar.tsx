import { useEffect, useId, type ReactNode } from 'react';
import { Btn, Modal } from './UI';
import { Icon, type IconName } from './Icon';
import './CollectionToolbar.css';

export function CollectionSearch({ value, onChange, label, placeholder, id, className = '' }: {
  value: string; onChange: (value: string) => void; label: string; placeholder: string; id?: string; className?: string;
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  return <div className={`collection-control collection-search ${className}`} data-swipe-ignore>
    <Icon name="search" size={18}/>
    <label htmlFor={inputId} className="sr-only">{label}</label>
    <input id={inputId} type="search" value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)}/>
  </div>;
}

export function CollectionFilterButton({ onClick, label = 'Filtros', count = 0, className = '' }: {
  onClick: () => void; label?: string; count?: number; className?: string;
}) {
  return <Btn variant="ghost" className={`collection-control collection-filter-button compact-filter-button ${className}`}
    onClick={onClick} aria-label={label} title={label} aria-haspopup="dialog">
    <Icon name="filters" size={18}/>
    {count > 0 && <span className="compact-filter-count">{count}</span>}
  </Btn>;
}

export function CollectionViewToggle({ value, onChange, options, label = 'Modo de visualização', className = '' }: {
  value: string; onChange: (value: string) => void;
  options: { value: string; label: string; icon: IconName }[];
  label?: string; className?: string;
}) {
  return <div className={`collection-control collection-mode-toggle compact-view-toggle ${className}`} data-swipe-ignore role="group" aria-label={label}>
    {options.map(option => <button type="button" key={option.value} aria-label={option.label} title={option.label}
      aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
      <Icon name={option.icon} size={16}/><span className="compact-control-label">{option.label}</span>
    </button>)}
  </div>;
}

export function CollectionFilterDialog({ open, title, onClose, onClear, onApply, applyLabel = 'Aplicar filtros', showCancel = false, children, className = '' }: {
  open: boolean; title: string; onClose: () => void; onClear: () => void; onApply: () => void;
  applyLabel?: string; showCancel?: boolean; children: ReactNode; className?: string;
}) {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!open || !viewport) return;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty('--collection-filter-height', `${viewport.height}px`);
      root.style.setProperty('--collection-filter-bottom', `${Math.max(0, innerHeight - viewport.height - viewport.offsetTop)}px`);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      root.style.removeProperty('--collection-filter-height');
      root.style.removeProperty('--collection-filter-bottom');
    };
  }, [open]);
  return <Modal open={open} title={title} onClose={onClose} className={`collection-filter-dialog ${className}`}
    footer={<div className="collection-filter-actions">
      <Btn variant="ghost" onClick={onClear}>Limpar filtros</Btn>
      <div>{showCancel && <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>}<Btn onClick={onApply}>{applyLabel}</Btn></div>
    </div>}>
    {children}
  </Modal>;
}
