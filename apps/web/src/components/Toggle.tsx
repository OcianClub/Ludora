import './Toggle.css';

export function ToggleIndicator({ checked }: { checked: boolean }) {
  return <span className="toggle-indicator" data-checked={checked} aria-hidden="true"><span /></span>;
}

type ToggleProps = {
  label?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function Toggle({ label, checked, onChange, disabled, ...accessibleName }: ToggleProps) {
  return <button type="button" className="toggle-control" role="switch" aria-label={label}
    {...accessibleName} aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}>
    <ToggleIndicator checked={checked} />
  </button>;
}
