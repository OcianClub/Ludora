import { useEffect, useLayoutEffect, useId, useRef } from 'react';
import './CategoryFilter.css';

/** Minimal category shape; the filter is independent of API and routing. */
export type FilterCategory = { id: number; nome: string; tipo: string };

export function PhaseFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="home-phase" role="group" aria-label="Grupo de categorias">
    {['INICIACAO', 'BASE'].map(phase => <button type="button" key={phase} aria-pressed={value === phase} onClick={() => onChange(phase)}>{phase === 'INICIACAO' ? 'Iniciação' : 'Base'}</button>)}
  </div>;
}

export type CategoryFilterProps = {
  categories: FilterCategory[];
  phase: string;
  selected?: FilterCategory;
  onPhase: (phase: string) => void;
  onSelect: (name: string) => void;
  label?: string;
  hint?: string;
};

function Chevron({ right = false }: { right?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={right ? 'm9 5 7 7-7 7' : 'm15 5-7 7 7 7'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CategoryFilter({ categories, phase, selected, onPhase, onSelect, label = 'Categoria', hint = 'Deslize para trocar a categoria ou use os botões e as setas do teclado no seletor.' }: CategoryFilterProps) {
  const strip = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const positioned = useRef(false);
  const hintId = useId();
  const gesture = useRef<{ x: number; scroll: number; moved: boolean } | null>(null);
  const pressed = useRef(false);
  const userScroll = useRef(false);
  const suppressClick = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef({ available: [] as FilterCategory[], onSelect });
  const available = categories.filter(category => category.tipo === phase)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
  latest.current = { available, onSelect };
  const index = available.findIndex(category => category.id === selected?.id);

  useLayoutEffect(() => {
    const container = strip.current;
    const active = container?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    const highlight = indicator.current;
    if (!container || !active || !highlight) return;
    let lastWidth = container.clientWidth;
    let lastItemWidth = active.offsetWidth;
    let frame = 0;
    function update() {
      const width = container!.clientWidth;
      container!.style.setProperty('--sub-item-width', `${Math.min(96, Math.max(60, (width - 12) / 3))}px`);
      const resized = width !== lastWidth || active!.offsetWidth !== lastItemWidth;
      const instant = !positioned.current || resized;
      if (instant) highlight!.style.transition = 'none';
      container!.style.setProperty('--strip-edge', `${Math.max(0, width / 2 - active!.offsetWidth / 2)}px`);
      highlight!.style.width = `${active!.offsetWidth}px`;
      highlight!.style.height = `${active!.offsetHeight}px`;
      highlight!.style.transform = `translate(${active!.offsetLeft}px, ${active!.offsetTop}px)`;
      if (instant) {
        container!.scrollLeft = active!.offsetLeft - (width - active!.offsetWidth) / 2;
        void highlight!.offsetWidth;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => highlight!.style.removeProperty('transition'));
      }
      positioned.current = true;
      lastWidth = width;
      lastItemWidth = active!.offsetWidth;
    }
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(active);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [selected?.id, phase]);

  useEffect(() => {
    const container = strip.current;
    const active = container?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (!container || !active) return;
    userScroll.current = false;
    container.scrollTo({
      left: active.offsetLeft - (container.clientWidth - active.clientWidth) / 2,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }, [selected?.id, phase]);

  useEffect(() => {
    const container = strip.current;
    if (!container) return;
    const settle = () => {
      clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        if (!userScroll.current || pressed.current || gesture.current) return;
        const buttons = [...container.querySelectorAll<HTMLButtonElement>('button')];
        const center = container.scrollLeft + container.clientWidth / 2;
        const closest = buttons.reduce<HTMLButtonElement | null>((best, button) => !best || Math.abs(button.offsetLeft + button.offsetWidth / 2 - center) < Math.abs(best.offsetLeft + best.offsetWidth / 2 - center) ? button : best, null);
        if (!closest) return;
        const category = latest.current.available[buttons.indexOf(closest)];
        userScroll.current = false;
        container.scrollTo({ left: closest.offsetLeft - (container.clientWidth - closest.clientWidth) / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        if (category) latest.current.onSelect(category.nome);
      }, 130);
    };
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      const delta = (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientWidth : 1);
      if ((delta < 0 && container.scrollLeft <= 1) || (delta > 0 && container.scrollLeft >= container.scrollWidth - container.clientWidth - 1)) return;
      event.preventDefault(); userScroll.current = true;
      container.scrollBy({ left: delta, behavior: 'instant' }); settle();
    };
    container.addEventListener('wheel', wheel, { passive: false });
    container.addEventListener('scroll', settle);
    return () => { clearTimeout(settleTimer.current); container.removeEventListener('wheel', wheel); container.removeEventListener('scroll', settle); };
  }, []);

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
        <div className="home-sub-strip category-tabs" ref={strip} data-swipe-ignore
          role="group" aria-label={label} aria-describedby={hintId}
          onPointerDown={event => {
            if (!event.isPrimary || event.button !== 0) return;
            pressed.current = true;
            clearTimeout(settleTimer.current);
            userScroll.current = true; suppressClick.current = false;
            // Interrupt a previous centering animation before taking ownership.
            event.currentTarget.scrollTo({ left: event.currentTarget.scrollLeft, behavior: 'instant' });
            gesture.current = { x: event.clientX, scroll: event.currentTarget.scrollLeft, moved: false };
            if (event.pointerType === 'mouse') event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onDragStart={event => event.preventDefault()}
          onPointerMove={event => {
            const start = gesture.current;
            if (!start) return;
            const distance = event.clientX - start.x;
            if (Math.abs(distance) > 5) {
              start.moved = true; suppressClick.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              event.currentTarget.classList.add('is-dragging');
              event.currentTarget.scrollLeft = start.scroll - distance;
            }
          }}
          onPointerUp={event => {
            const moved = gesture.current?.moved;
            pressed.current = false;
            gesture.current = null; event.currentTarget.classList.remove('is-dragging');
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            if (!moved) {
              const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('button');
              if (target && event.currentTarget.contains(target)) {
                const buttons = [...event.currentTarget.querySelectorAll('button')];
                const category = available[buttons.indexOf(target)];
                if (category) { userScroll.current = false; onSelect(category.nome); }
              }
              suppressClick.current = true;
            }
            event.currentTarget.dispatchEvent(new Event('scroll'));
          }}
          onPointerCancel={event => { pressed.current = false; gesture.current = null; event.currentTarget.classList.remove('is-dragging'); event.currentTarget.dispatchEvent(new Event('scroll')); }}
          onLostPointerCapture={event => {
            if (!pressed.current || event.target !== event.currentTarget) return;
            pressed.current = false; gesture.current = null;
            event.currentTarget.classList.remove('is-dragging');
            event.currentTarget.dispatchEvent(new Event('scroll'));
          }}
          onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}
          onKeyDown={event => {
            suppressClick.current = false;
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            select(event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1 : index + (event.key === 'ArrowLeft' ? -1 : 1), true);
          }}>
          {selected && <span className="home-sub-indicator" ref={indicator} aria-hidden="true" />}
          {available.map(category => (
            <button type="button" key={category.id} aria-pressed={selected?.id === category.id}
              tabIndex={selected?.id === category.id || !selected && category === available[0] ? 0 : -1} onClick={() => onSelect(category.nome)}>
              {category.nome.toUpperCase()}
            </button>
          ))}
          {!available.length && <span className="home-no-category">Nenhuma categoria nesta fase</span>}
        </div>
        <button type="button" className="home-category-arrow" aria-label="Próxima categoria"
          disabled={index < 0 || index >= available.length - 1} onClick={() => select(index + 1)}><Chevron right /></button>
      </div>

      <span className="sr-only" id={hintId}>{hint}</span>
      <span className="sr-only" role="status">{selected ? `Categoria selecionada: ${selected.nome}` : 'Nenhuma categoria selecionada'}</span>
    </div>
  );
}
