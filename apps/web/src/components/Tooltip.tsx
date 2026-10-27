import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Tooltip.css';

export function Tooltip({ label, position, children }: { label: string; position?: string; children: ReactNode }) {
  return <span className="tooltip-target" tabIndex={0} aria-label={label} data-tooltip={label} data-position={position}>{children}</span>;
}

// Delegation also covers existing icon buttons without changing their layout.
export function TooltipLayer() {
  const [tip, setTip] = useState<{ text: string; position?: string; x: number; y: number; below: boolean; host: HTMLElement } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let target: HTMLElement | null = null;
    let previousDescription: string | null = null;
    let previousTitle: string | null = null;
    const close = () => {
      clearTimeout(timer);
      if (target) {
        if (previousDescription === null) target.removeAttribute('aria-describedby');
        else target.setAttribute('aria-describedby', previousDescription);
        if (previousTitle !== null) target.setAttribute('title', previousTitle);
      }
      target = null;
      setTip(null);
    };
    const showFor = (element: HTMLElement) => {
      if (element === target) return;
      close();
      target = element;
      previousDescription = element.getAttribute('aria-describedby');
      previousTitle = element.getAttribute('title');
      element.removeAttribute('title');
      timer = setTimeout(() => {
        if (!element.isConnected) return close();
        const rect = element.getBoundingClientRect();
        element.setAttribute('aria-describedby', [previousDescription, 'ludora-tooltip'].filter(Boolean).join(' '));
        setTip({ text: element.dataset.tooltip || element.getAttribute('aria-label') || '', position: element.dataset.position, host: element.closest('dialog') || document.body,
          x: Math.max(136, Math.min(innerWidth - 136, rect.left + rect.width / 2)), y: rect.top < 64 ? rect.bottom + 8 : rect.top - 8, below: rect.top < 64 });
      }, 200);
    };
    const show = (event: Event) => {
      if (event instanceof PointerEvent && event.pointerType === 'touch') return;
      const element = (event.target as Element)?.closest<HTMLElement>('[data-tooltip], button[aria-label], a[aria-label]');
      if (element) showFor(element);
    };
    const scroll = () => {
      const focused = target && target.contains(document.activeElement) ? target : null;
      close();
      if (focused) showFor(focused);
    };
    const leave = (event: Event) => {
      const next = (event as FocusEvent).relatedTarget as Node | null;
      if (next && (target?.contains(next) || panel.current?.contains(next))) return;
      if (event.type === 'pointerout' && target?.contains(document.activeElement)) return;
      clearTimeout(timer); timer = setTimeout(close, 100);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && panel.current) { event.preventDefault(); event.stopPropagation(); close(); } };
    document.addEventListener('pointerover', show);
    document.addEventListener('focusin', show);
    document.addEventListener('pointerout', leave);
    document.addEventListener('focusout', leave);
    document.addEventListener('keydown', escape, true);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', close);
    return () => {
      close();
      document.removeEventListener('pointerover', show); document.removeEventListener('focusin', show);
      document.removeEventListener('pointerout', leave); document.removeEventListener('focusout', leave);
      document.removeEventListener('keydown', escape, true); window.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', close);
    };
  }, []);
  return tip ? createPortal(<div ref={panel} id="ludora-tooltip" role="tooltip" className="ludora-tooltip" style={{ left: tip.x, top: tip.y, transform: `translate(-50%, ${tip.below ? '0' : '-100%'})` }}>
    <span>{tip.text}</span>
  </div>, tip.host) : null;
}
