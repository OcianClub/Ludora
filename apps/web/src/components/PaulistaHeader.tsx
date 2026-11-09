import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FilterSelect } from './FilterSelect';
import { Icon } from './Icon';
import { FederationGlobe } from './PaulistaIcons';

export function PaulistaHeader({ division, year, years, source, busy, home, onYear, onRefresh }: {
  division?: string; year: number; years: number[]; source?: string;
  busy: boolean; home: boolean; onYear: (year: string) => void; onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => { setOpen(false); }, [year, source]);
  function close() { setOpen(false); trigger.current?.focus(); }
  return <header className="paulista-header" aria-busy={busy}>
    <div className="paulista-header-identity">
      {!home && <Link className="paulista-back" to="/competicoes"><Icon name="chevronLeft" size={17}/>Voltar</Link>}
      <h1 className="page-title">Campeonato Paulista</h1>
      {division && <p className="paulista-division">Divisão {division}</p>}
    </div>
    <div className="paulista-header-actions">
      {!!years.length && <FilterSelect label="Temporada" compactLabel={String(year)} value={String(year)} emptyLabel="Selecionar temporada" options={years.map(value => ({ value, label: `Temporada ${value}` }))} onChange={onYear}/>}
      <div className="paulista-header-menu" ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
        <button ref={trigger} type="button" className="paulista-menu-trigger" aria-label="Opções do campeonato" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
          onClick={() => setOpen(value => !value)} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); } }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>
        </button>
        {open && <div id={menuId} className="paulista-header-menu-options" role="menu" aria-label="Ações do campeonato" onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')];
            const index = items.indexOf(document.activeElement as HTMLElement);
            items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
          }
        }}>
          <button type="button" role="menuitem" className="paulista-reload" disabled={busy} onClick={() => { close(); onRefresh(); }}><Icon name="refresh" size={17}/>{busy ? 'Atualizando…' : 'Atualizar dados'}</button>
          {home && <Link role="menuitem" to="?arquivo=1" onClick={close}><Icon name="trophy" size={17}/>Competições anteriores</Link>}
          {source && <a role="menuitem" className="paulista-source-link" href={source} target="_blank" rel="noreferrer" aria-label="Consultar fonte oficial em nova aba" onClick={close}><FederationGlobe/>Consultar fonte oficial<Icon name="arrow" size={14}/></a>}
        </div>}
      </div>
    </div>
  </header>;
}
