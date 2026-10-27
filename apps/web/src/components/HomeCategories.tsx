import { useEffect, useLayoutEffect, useId, useRef } from 'react';
import type { Categoria } from '../services/api';
import './HomeCategories.css';

function Chevron({ right = false }: { right?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={right ? 'm9 5 7 7-7 7' : 'm15 5-7 7 7 7'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HomeCategories({ categories, phase, selected, onPhase, onSelect, label = 'Categoria da visão geral', hint = 'Deslize o conteúdo para trocar a categoria ou use os botões e as setas do teclado no seletor.' }: {
  categories: Categoria[];
  phase: string;
  selected?: Categoria;
  onPhase: (phase: string) => void;
  onSelect: (name: string) => void;
  label?: string;
  hint?: string;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const hintId = useId();
  const gesture = useRef<{ x: number; scroll: number; moved: boolean } | null>(null);
  const userScroll = useRef(false);
  const suppressClick = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef({ available: [] as Categoria[], onSelect });
  const available = categories.filter(category => category.tipo === phase);
  latest.current = { available, onSelect };
  const index = available.findIndex(category => category.id === selected?.id);

  useLayoutEffect(() => {
    const container = strip.current;
    const active = container?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    const highlight = indicator.current;
    if (!container || !active || !highlight) return;
    function update() {
      container!.style.setProperty('--strip-edge', `${Math.max(0, container!.clientWidth / 2 - active!.offsetWidth / 2)}px`);
      highlight!.style.width = `${active!.offsetWidth}px`;
      highlight!.style.height = `${active!.offsetHeight}px`;
      highlight!.style.transform = `translate(${active!.offsetLeft}px, ${active!.offsetTop}px)`;
    }
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(active);
    return () => observer.disconnect();
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
  }, [selected?.id]);

  useEffect(() => {
    const container = strip.current;
    if (!container) return;
    const settle = () => {
      clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        if (!userScroll.current || gesture.current) return;
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
            userScroll.current = true; suppressClick.current = false;
            if (event.pointerType !== 'mouse' || event.button !== 0) return;
            gesture.current = { x: event.clientX, scroll: event.currentTarget.scrollLeft, moved: false };
          }}
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
            gesture.current = null; event.currentTarget.classList.remove('is-dragging');
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            if (moved) event.currentTarget.dispatchEvent(new Event('scroll'));
          }}
          onPointerCancel={event => { gesture.current = null; event.currentTarget.classList.remove('is-dragging'); event.currentTarget.dispatchEvent(new Event('scroll')); }}
          onPointerLeave={() => { if (!gesture.current?.moved) gesture.current = null; }}
          onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}
          onKeyDown={event => {
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
