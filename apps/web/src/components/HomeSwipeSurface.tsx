import { useEffect, useLayoutEffect, useRef, type PointerEvent, type ReactNode } from 'react';

type Drag = { id: number; x: number; y: number; horizontal: boolean; distance: number };

export function HomeSwipeSurface({ children, footer, renderPage, categoryId, categoryIndex, canPrevious, canNext, onStep }: {
  children: ReactNode;
  footer?: ReactNode;
  renderPage: (offset: number) => ReactNode;
  categoryId?: number;
  categoryIndex: number;
  canPrevious: boolean;
  canNext: boolean;
  onStep: (direction: number) => void;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const previous = useRef({ id: categoryId, index: categoryIndex });
  const animations = useRef<Animation[]>([]);
  const settling = useRef(false);
  const committing = useRef(false);

  function cancelAnimations() {
    animations.current.forEach(animation => animation.cancel());
    animations.current = [];
  }

  function indicatorPosition(progress: number) {
    const strip = surface.current?.querySelector<HTMLElement>('.home-sub-strip');
    const indicator = strip?.querySelector<HTMLElement>('.home-sub-indicator');
    const buttons = strip?.querySelectorAll<HTMLButtonElement>('button');
    const active = buttons?.[categoryIndex];
    if (!indicator || !active || !buttons) return null;
    const neighbor = buttons[categoryIndex + (progress < 0 ? -1 : 1)] ?? active;
    const amount = Math.min(1, Math.abs(progress));
    return {
      indicator,
      transform: `translate(${active.offsetLeft + (neighbor.offsetLeft - active.offsetLeft) * amount}px, ${active.offsetTop}px)`,
      width: `${active.offsetWidth + (neighbor.offsetWidth - active.offsetWidth) * amount}px`,
    };
  }

  function move(distance: number) {
    const width = track.current?.clientWidth || 1;
    track.current?.style.setProperty('--home-page-x', `${distance}px`);
    const position = indicatorPosition(-distance / width);
    if (position) {
      position.indicator.style.transition = 'none';
      position.indicator.style.transform = position.transform;
      position.indicator.style.width = position.width;
    }
  }

  function reset() {
    surface.current?.classList.remove('is-swiping');
    track.current?.style.removeProperty('--home-page-x');
    const indicator = surface.current?.querySelector<HTMLElement>('.home-sub-indicator');
    indicator?.style.removeProperty('transition');
    settling.current = false;
  }

  useLayoutEffect(() => {
    const old = previous.current;
    previous.current = { id: categoryId, index: categoryIndex };
    drag.current = null;
    cancelAnimations();
    reset();
    if (committing.current) {
      committing.current = false;
      return;
    }
    if (!track.current || old.id === undefined || old.id === categoryId || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const direction = categoryIndex < old.index ? -1 : 1;
    animations.current = [track.current.animate([
      { transform: `translateX(${direction * 100}%)` },
      { transform: 'translateX(0)' },
    ], { duration: 280, easing: 'cubic-bezier(.22,.7,.2,1)' })];
  }, [categoryId, categoryIndex]);

  useEffect(() => () => cancelAnimations(), []);

  function settle(distance: number, direction: number) {
    const element = track.current;
    if (!element) return;
    settling.current = true;
    const target = direction ? -direction * element.clientWidth : 0;
    const position = indicatorPosition(direction);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const options: KeyframeAnimationOptions = {
      duration: reduced ? 0 : 230,
      easing: 'cubic-bezier(.22,.7,.2,1)',
      fill: 'forwards',
    };
    const slide = element.animate([
      { transform: `translateX(${distance}px)` },
      { transform: `translateX(${target}px)` },
    ], options);
    animations.current = [slide];
    if (position) {
      animations.current.push(position.indicator.animate([
        { transform: getComputedStyle(position.indicator).transform, width: getComputedStyle(position.indicator).width },
        { transform: position.transform, width: position.width },
      ], options));
    }
    slide.finished.then(() => {
      if (direction) {
        committing.current = true;
        onStep(direction);
      } else {
        move(0);
        cancelAnimations();
        reset();
      }
    }).catch(() => {});
  }

  function finish(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    drag.current = null;
    suppressClick.current = start.horizontal;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!start.horizontal) return;
    const direction = start.distance < 0 ? 1 : -1;
    const allowed = direction > 0 ? canNext : canPrevious;
    const threshold = Math.min(64, (track.current?.clientWidth || 1) * .18);
    settle(start.distance, !cancelled && allowed && Math.abs(start.distance) >= threshold ? direction : 0);
  }

  return (
    <div className="dashboard home-swipe-surface" ref={surface}
      onKeyDownCapture={() => { suppressClick.current = false; }}
      onDragStart={event => event.preventDefault()}
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0 || settling.current) return;
        suppressClick.current = false;
        const target = event.target as Element;
        const inStrip = target.closest('.home-sub-strip');
        if (!inStrip && target.closest('.home-controls, button, input, select, textarea, [contenteditable="true"]')) return;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: false, distance: 0 };
      }}
      onPointerMove={event => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (!start.horizontal && Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
          drag.current = null;
          return;
        }
        if (!start.horizontal && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) {
          start.horizontal = true;
          cancelAnimations();
          event.currentTarget.setPointerCapture(event.pointerId);
          surface.current?.classList.add('is-swiping');
        }
        if (!start.horizontal) return;
        event.preventDefault();
        const allowed = dx < 0 ? canNext : canPrevious;
        const width = track.current?.clientWidth || 1;
        start.distance = allowed ? Math.max(-width, Math.min(width, dx)) : dx * .12;
        move(start.distance);
      }}
      onPointerUp={event => finish(event)}
      onPointerCancel={event => finish(event, true)}
      onLostPointerCapture={event => {
        if (event.target !== event.currentTarget || !drag.current) return;
        const start = drag.current;
        drag.current = null;
        if (start.horizontal) settle(start.distance, 0);
      }}
      onClickCapture={event => {
        if (!suppressClick.current) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClick.current = false;
      }}>
      {children}
      {categoryId !== undefined && <div className="home-pager">
        <div className="home-pager-track" ref={track}>
          {[-1, 0, 1].map(offset => (
            <div key={offset} className={offset === 0 ? 'home-pager-current' : 'home-pager-preview'}
              data-offset={offset} aria-hidden={offset === 0 ? undefined : true}
              ref={element => { if (element) element.inert = offset !== 0; }}>
              {renderPage(offset)}
            </div>
          ))}
        </div>
      </div>}
      {footer}
    </div>
  );
}
