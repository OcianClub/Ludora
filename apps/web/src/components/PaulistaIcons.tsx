export function FederationGlobe() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5h14M5 17.5h14"/></svg>;
}
export function OfficialMedal({ chave }: { chave: string }) {
  return <span className={`paulista-medal medal-${chave.toLowerCase()}`} aria-label={`Chave ${chave.toLowerCase()} publicada pela federação`}><svg width="24" height="28" viewBox="0 0 24 28" fill="none" aria-hidden="true"><path d="m4 1 5 11h6L20 1h-6l-2 5-2-5Z" fill="currentColor" opacity=".5"/><circle cx="12" cy="18" r="8" fill="currentColor"/><path d="m12 13 1.5 3 3.5.5-2.5 2.5.6 3.5-3.1-1.6-3.1 1.6.6-3.5L7 16.5l3.5-.5Z" fill="var(--fundo-card)"/></svg><span>{chave[0] + chave.slice(1).toLowerCase()}</span></span>;
}
