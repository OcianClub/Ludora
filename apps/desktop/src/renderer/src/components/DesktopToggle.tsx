import './DesktopToggle.css';

export function DesktopToggleIndicator({ checked }: { checked: boolean }) {
  return <span className="desktop-menu-toggle" data-checked={checked} aria-hidden="true"><span/></span>;
}

export function DesktopToggle({ label, checked, onChange, disabled = false }: {
  label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean;
}) {
  return <button type="button" className="desktop-toggle-control" role="switch" aria-label={label}
    aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}>
    <DesktopToggleIndicator checked={checked}/>
  </button>;
}
