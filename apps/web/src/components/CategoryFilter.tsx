import { useEffect, useId, useRef } from 'react';
import './CategoryFilter.css';

export type FilterCategory = { id: number; nome: string; tipo: string };
export type CategoryFilterProps = {
  categories: FilterCategory[];
  phase: string;
  selected?: FilterCategory;
  onPhase: (phase: string) => void;
  onSelect: (name: string) => void;
  label?: string;
  hint?: string;
};

export function PhaseFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="home-phase" role="group" aria-label="Grupo de categorias">
    {['INICIACAO', 'BASE'].map(phase => <button type="button" key={phase} aria-pressed={value === phase} onClick={() => onChange(phase)}>{phase === 'INICIACAO' ? 'Iniciação' : 'Base'}</button>)}
  </div>;
}

export function CategoryFilter({ categories, phase, selected, onPhase, onSelect, label = 'Categoria' }: CategoryFilterProps) {
  const id = useId();
  const track = useRef<HTMLDivElement>(null);
  const available = categories.filter(category => category.tipo === phase)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));

  useEffect(() => {
    const container = track.current;
    if (!container) return;
    const update = () => {
      container.dataset.more = String(container.scrollWidth - container.clientWidth - container.scrollLeft > 1);
    };
    const observer = new ResizeObserver(update);
    observer.observe(container);
    container.addEventListener('scroll', update, { passive: true });
    update();
    return () => { observer.disconnect(); container.removeEventListener('scroll', update); };
  }, [phase, categories.length]);

  useEffect(() => {
    if (!matchMedia('(max-width: 760px)').matches) return;
    const container = track.current;
    const active = container?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (container && active) container.scrollTo({
      left: active.offsetLeft - (container.clientWidth - active.clientWidth) / 2,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }, [selected?.id, phase]);

  return <div className="home-controls">
    <div className="home-phase" role="tablist" aria-label="Fase" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'ArrowLeft' || event.key === 'Home' ? 'INICIACAO' : 'BASE';
      onPhase(next);
      document.getElementById(`${id}-${next}`)?.focus();
    }}>
      {['INICIACAO', 'BASE'].map(value => <button key={value} id={`${id}-${value}`} type="button" role="tab"
        aria-selected={phase === value} tabIndex={phase === value ? 0 : -1}
        onClick={() => onPhase(value)}>{value === 'BASE' ? 'Base' : 'Iniciação'}</button>)}
    </div>
    <div className="home-category-picker">
      <div className="home-sub-strip category-tabs" role="tablist" aria-label={label} ref={track} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const index = available.findIndex(category => category.id === selected?.id);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1 : Math.max(0, Math.min(available.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)));
        if (available[next]) {
          onSelect(available[next].nome);
          track.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus({ preventScroll: true });
        }
      }}>
        {available.map((category, index) => <button type="button" role="tab" key={category.id}
          aria-selected={selected?.id === category.id} tabIndex={selected?.id === category.id || !selected && index === 0 ? 0 : -1}
          onClick={() => onSelect(category.nome)}>{category.nome.toUpperCase()}</button>)}
        {!available.length && <span className="home-no-category">Nenhuma categoria nesta fase</span>}
      </div>
    </div>
  </div>;
}
