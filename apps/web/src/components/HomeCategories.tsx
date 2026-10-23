import { useEffect, useLayoutEffect, useId, useRef } from 'react';
import type { Categoria } from '../services/api';

function Chevron({ right = false }: { right?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={right ? 'm9 5 7 7-7 7' : 'm15 5-7 7 7 7'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HomeCategories({ categories, phase, selected, onPhase, onSelect }: {
  categories: Categoria[];
  phase: string;
  selected?: Categoria;
  onPhase: (phase: string) => void;
  onSelect: (name: string) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const hintId = useId();
  const available = categories.filter(category => category.tipo === phase);
  const index = available.findIndex(category => category.id === selected?.id);

  useLayoutEffect(() => {
    const container = strip.current;
    const active = container?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    const highlight = indicator.current;
    if (!container || !active || !highlight) return;
    function update() {
      highlight!.style.width = `${active!.offsetWidth}px`;
      highlight!.style.height = `${active!.offsetHeight}px`;
      highlight!.style.transform = `translate(${active!.offsetLeft}px, ${active!.offsetTop}px)`;
    }
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(active);
    return () => observer.disconnect();
  }, [selected?.id]);

  useEffect(() => {
    const container = strip.current;
    const active = container?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (!container || !active) return;
    container.scrollTo({
      left: active.offsetLeft - (container.clientWidth - active.clientWidth) / 2,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }, [selected?.id]);

  function select(next: number, focus = false) {
    if (!available[next]) return;
    onSelect(available[next].nome);
    if (focus) strip.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus({ preventScroll: true });
  }

  function changePhase(next: string, focus = false) {
    onPhase(next);
    if (focus) document.getElementById(`${hintId}-${next}`)?.focus();
  }

  return (
    <div className="home-controls">
      <div className="home-phase" role="group" aria-label="Fase"
        onKeyDown={event => {
          const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
          if (!keys.includes(event.key)) return;
          event.preventDefault();
          changePhase(event.key === 'Home' || event.key === 'ArrowLeft' ? 'INICIACAO' : 'BASE', true);
        }}>
        <button id={`${hintId}-INICIACAO`} type="button" aria-pressed={phase === 'INICIACAO'}
          tabIndex={phase === 'INICIACAO' ? 0 : -1} onClick={() => changePhase('INICIACAO')}>Iniciação</button>
        <button id={`${hintId}-BASE`} type="button" aria-pressed={phase === 'BASE'}
          tabIndex={phase === 'BASE' ? 0 : -1} onClick={() => changePhase('BASE')}>Base</button>
      </div>

      <div className="home-category-picker">
        <button type="button" className="home-category-arrow" aria-label="Categoria anterior"
          disabled={index <= 0} onClick={() => select(index - 1)}><Chevron /></button>
        <div className="home-sub-strip category-tabs" ref={strip}
          role="group" aria-label="Categoria da visão geral" aria-describedby={hintId}
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            select(event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1 : index + (event.key === 'ArrowLeft' ? -1 : 1), true);
          }}>
          {selected && <span className="home-sub-indicator" ref={indicator} aria-hidden="true" />}
          {available.map(category => (
            <button type="button" key={category.id} aria-pressed={selected?.id === category.id}
              tabIndex={selected?.id === category.id ? 0 : -1} onClick={() => onSelect(category.nome)}>
              {category.nome.toUpperCase()}
            </button>
          ))}
          {!available.length && <span className="home-no-category">Nenhuma categoria nesta fase</span>}
        </div>
        <button type="button" className="home-category-arrow" aria-label="Próxima categoria"
          disabled={index < 0 || index >= available.length - 1} onClick={() => select(index + 1)}><Chevron right /></button>
      </div>

      <span className="sr-only" id={hintId}>Deslize o conteúdo para trocar a categoria ou use os botões e as setas do teclado no seletor.</span>
      <span className="sr-only" role="status">{selected ? `Categoria selecionada: ${selected.nome}` : 'Nenhuma categoria selecionada'}</span>
    </div>
  );
}
