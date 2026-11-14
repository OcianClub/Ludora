import './RadioIndicator.css';

export function RadioIndicator({ checked, className = '' }: { checked: boolean; className?: string }) {
  return <span className={`radio-indicator ${className}`} data-checked={checked} aria-hidden="true" />;
}
