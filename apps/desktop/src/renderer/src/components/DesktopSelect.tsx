import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '@web/components/Icon';
import { DesktopMenu, DesktopMenuRadioItem } from './DesktopMenu';
import './DesktopSelect.css';

export type DesktopSelectOption<T extends string = string> = { value: T; label: string; icon?: ReactNode; disabled?: boolean };

// Mesmo menu das ações (...), com valor controlado pela página.
export function DesktopSelect<T extends string>({ label, value, options, onChange, className = '', disabled = false, indicator = 'radio', placeholder = 'Selecionar', fullWidth = false, showLabel = false, height = 44, optionHeight = 40, width, expandInDialog = false }: {
  label: string; value: T; options: readonly DesktopSelectOption<T>[]; onChange: (value: T) => void;
  className?: string; disabled?: boolean; indicator?: 'radio' | 'dot'; placeholder?: string; fullWidth?: boolean;
  showLabel?: boolean; height?: CSSProperties['height']; optionHeight?: CSSProperties['minHeight']; width?: CSSProperties['width'];
  expandInDialog?: boolean;
}) {
  const selected = options.find(option => option.value === value);
  const text = selected?.label ?? placeholder;
  const length = (value: CSSProperties['height']) => typeof value === 'number' ? `${value}px` : value;
  const style = { width, '--desktop-select-height': length(height), '--desktop-select-option-height': length(optionHeight) } as CSSProperties;
  const menu = <DesktopMenu inline={expandInDialog} style={showLabel ? undefined : style} label={`${label}: ${text}`} disabled={disabled} className={`desktop-menu-select${fullWidth ? ' desktop-menu-select-full' : ''} ${className}`}
    trigger={<>{selected?.icon}<span>{text}</span><Icon name="chevronRight" size={14}/></>}>
    {options.map(option => <DesktopMenuRadioItem key={option.value} checked={value === option.value} disabled={option.disabled}
      icon={option.icon} indicator={indicator} onSelect={() => onChange(option.value)}>{option.label}</DesktopMenuRadioItem>)}
  </DesktopMenu>;
  return showLabel ? <div className={`desktop-select-field${fullWidth ? ' desktop-menu-select-full' : ''}`} style={style}><span className="field-label">{label}</span>{menu}</div> : menu;
}
