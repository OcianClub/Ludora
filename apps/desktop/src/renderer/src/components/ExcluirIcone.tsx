export function ExcluirIcone({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="desktop-icon-action desktop-icon-action--danger" aria-label={label} data-tooltip={label} onClick={onClick}>
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <path d="M9 3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2h5a1 1 0 1 1 0 2H4a1 1 0 0 1 0-2h5V3Zm-3 6h12l-.7 10.1a2 2 0 0 1-2 1.9H8.7a2 2 0 0 1-2-1.9L6 9Z"/>
    </svg>
  </button>;
}
