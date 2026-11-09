export function FederationGlobe() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5h14M5 17.5h14"/></svg>;
}
export function OfficialMedal({ chave, filled = false }: { chave: string; filled?: boolean }) {
  if (filled) {
    const label = `Chave ${chave[0] + chave.slice(1).toLowerCase()}`;
    return <span className={`paulista-medal paulista-key-trophy medal-${chave.toLowerCase()}`} role="img" aria-label={label} title={label}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 3h10v5a5 5 0 0 1-4 4.9V17h2a2 2 0 0 1 2 2v2H7v-2a2 2 0 0 1 2-2h2v-4.1A5 5 0 0 1 7 8V3Z"/><path d="M7 4H2v4a6 6 0 0 0 6 6v-2a4 4 0 0 1-4-4V6h3V4Zm10 0h5v4a6 6 0 0 1-6 6v-2a4 4 0 0 0 4-4V6h-3V4Z"/></svg>
      <span>{label}</span>
    </span>;
  }
  return <span className={`paulista-medal medal-${chave.toLowerCase()}`} aria-label={`Chave ${chave.toLowerCase()} publicada pela federação`}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M8 3h8v5a4 4 0 0 1-8 0V3Z" fill="currentColor" fillOpacity=".12"/><path d="M8 5H4v2a4 4 0 0 0 5 4m7-6h4v2a4 4 0 0 1-5 4M12 12v5m-4 4v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2H8Z"/></svg><span>Chave {chave[0] + chave.slice(1).toLowerCase()}</span></span>;
}
