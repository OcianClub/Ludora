import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Partida } from '../services/api';
import { Icon } from './Icon';

export function LiveMatchesCarousel({ matches, renderMatch }: {
  matches: Partida[];
  renderMatch: (match: Partida) => ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ pointer: number; x: number; left: number; dragging: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [edges, setEdges] = useState({ start: true, end: false });
  const id = useId();

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const update = () => {
      const start = element.scrollLeft <= 2;
      const end = element.scrollLeft + element.clientWidth >= element.scrollWidth - 2;
      setEdges(previous => previous.start === start && previous.end === end ? previous : { start, end });
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener('scroll', update, { passive: true });
    update();
    return () => { observer.disconnect(); element.removeEventListener('scroll', update); };
  }, [matches.length]);

  function step(direction: number) {
    track.current?.scrollBy({ left: track.current.clientWidth * .9 * direction, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  return <section className="schedule-live-section" aria-labelledby={`${id}-title`}>
    <div className="schedule-live-heading">
      <div><h2 id={`${id}-title`}><Icon name="live" />Ao vivo<span>{matches.length}</span></h2><p>Partidas em andamento · deslize para acompanhar</p></div>
      <div className="schedule-carousel-controls">
        <button type="button" aria-label="Partidas ao vivo anteriores" disabled={edges.start} onClick={() => step(-1)}><Icon name="chevronLeft" /></button>
        <button type="button" aria-label="Próximas partidas ao vivo" disabled={edges.end} onClick={() => step(1)}><Icon name="chevronRight" /></button>
      </div>
    </div>
    <div ref={track} className="schedule-live-carousel" tabIndex={0} role="region" aria-label="Carrossel de partidas ao vivo"
      onKeyDown={event => {
        suppressClick.current = false;
        if (event.target !== event.currentTarget) return;
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); step(event.key === 'ArrowRight' ? 1 : -1); }
      }}
      onPointerDown={event => {
        suppressClick.current = false;
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        gesture.current = { pointer: event.pointerId, x: event.clientX, left: event.currentTarget.scrollLeft, dragging: false };
      }}
      onPointerMove={event => {
        const current = gesture.current;
        if (!current || current.pointer !== event.pointerId) return;
        const distance = event.clientX - current.x;
        if (!current.dragging && Math.abs(distance) > 8) {
          current.dragging = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.classList.add('is-dragging');
        }
        if (current.dragging) { suppressClick.current = true; event.currentTarget.scrollLeft = current.left - distance; }
      }}
      onPointerUp={event => {
        gesture.current = null;
        event.currentTarget.classList.remove('is-dragging');
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={event => { gesture.current = null; event.currentTarget.classList.remove('is-dragging'); }}
      onPointerLeave={() => { if (!gesture.current?.dragging) gesture.current = null; }}
      onDragStart={event => event.preventDefault()}
      onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
      {matches.map(renderMatch)}
    </div>
  </section>;
}
