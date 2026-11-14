import { useEffect, useId, type MouseEventHandler, type ReactNode } from 'react';
import { Btn, Modal } from './UI';
import { Icon, type IconName } from './Icon';
import { ResponsivePanel } from './ResponsivePanel';
import { RadioIndicator } from './RadioIndicator';
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

export function CollectionFilterButton({ onClick, label = 'Filtros', text, count = 0, className = '', expanded }: {
  onClick: MouseEventHandler<HTMLButtonElement>; label?: string; text?: string; count?: number; className?: string; expanded?: boolean;
}) {
  return <Btn variant="ghost" className={`collection-control collection-filter-button compact-filter-button ${className}`}
    type="button" onClick={onClick} aria-label={label} data-tooltip={label} aria-haspopup="dialog" aria-expanded={expanded}>
    <Icon name="filters" size={18}/>
    {text && <span className="collection-filter-label">{text}</span>}
    {count > 0 && <span className="compact-filter-count">{count}</span>}
  </Btn>;
}

export function CollectionViewToggle({ value, onChange, options, label = 'Modo de visualização', className = '' }: {
  value: string; onChange: (value: string) => void;
  options: { value: string; label: string; icon: IconName }[];
  label?: string; className?: string;
}) {
  return <div className={`collection-control collection-mode-toggle compact-view-toggle ${className}`} data-swipe-ignore role="group" aria-label={label}>
    {options.map(option => <button type="button" key={option.value} aria-label={option.label} data-tooltip={option.label} data-tooltip-icon-only
      aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
      <Icon name={option.icon} size={16}/><span className="compact-control-label">{option.label}</span>
    </button>)}
  </div>;
}

export function FilterRadioGroup({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string; icon?: IconName }[];
  onChange: (value: string) => void;
}) {
  const name = useId();
  return <fieldset className="filter-radio-group">
    <legend>{label}</legend>
    {options.map(option => <label className="filter-radio-option" key={option.value}>
      <input type="radio" name={name} value={option.value} checked={option.value === value}
        onChange={() => onChange(option.value)} />
      {option.icon && <Icon name={option.icon} size={16}/>}
      <span>{option.label}</span>
      <RadioIndicator checked={option.value === value}/>
    </label>)}
  </fieldset>;
}

export function CollectionFilterDialog({ open, anchor, title, onClose, onClear, onApply, applyLabel = 'Aplicar filtros', showCancel = false, children, className = '' }: {
  open: boolean; title: string; onClose: () => void; onClear: () => void; onApply: () => void;
  applyLabel?: string; showCancel?: boolean; children: ReactNode; className?: string; anchor?: HTMLElement | null;
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
  if (!open) return null;
  const footer = <div className="collection-filter-actions">
    <Btn variant="ghost" onClick={onClear}>Limpar filtros</Btn>
    <div>{showCancel && <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>}<Btn onClick={onApply}>{applyLabel}</Btn></div>
  </div>;
  const classes = `collection-filter-dialog ${className}`;
  return anchor
    ? <ResponsivePanel anchor={anchor} title={title} onClose={onClose} className={classes} footer={footer}>{children}</ResponsivePanel>
    : <Modal open title={title} onClose={onClose} className={classes} footer={footer}>{children}</Modal>;
}
