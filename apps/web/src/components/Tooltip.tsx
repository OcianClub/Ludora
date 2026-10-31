import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import './Tooltip.css';

export function Tooltip({ label, position, children }: { label: string; position?: string; children: ReactNode }) {
  return <span className="tooltip-target" tabIndex={0} aria-label={label} data-tooltip={label} data-position={position}>{children}</span>;
}

type Tip = { text: string; target: HTMLElement; host: HTMLElement };

function visibleText(element: HTMLElement) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.textContent?.trim()) continue;
    const parent = node.parentElement;
    if (!parent || parent.closest('[aria-hidden="true"], .sr-only, .history-sr-only')) continue;
    const rect = parent.getBoundingClientRect();
    if (rect.width > 1 && rect.height > 1 && getComputedStyle(parent).visibility !== 'hidden') return true;
  }
  return false;
}

function tooltipText(element: HTMLElement) {
  if (element.closest('[data-tooltip-disabled]') || element.matches(':disabled, [aria-disabled="true"]')) return '';
  if (element.hasAttribute('data-tooltip-overflow') && element.scrollWidth <= element.clientWidth + 1
    && element.scrollHeight <= element.clientHeight + 1) return '';
  if (element.hasAttribute('data-tooltip-icon-only') && visibleText(element)) return '';
  return element.dataset.tooltip?.trim() || '';
}

export function TooltipLayer() {
  const { pathname } = useLocation();
  const [tip, setTip] = useState<Tip | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const dismiss = useRef<() => void>(() => {});

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    let focusTarget: HTMLElement | null = null;
    let target: HTMLElement | null = null;
    let touched = false;
    let dismissed: HTMLElement | null = null;

    const close = () => {
      clearTimeout(timer);
      clearTimeout(focusTimer);
      focusTarget = null;
      if (target) {
        const ids = (target.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== 'ludora-tooltip');
        if (ids.length) target.setAttribute('aria-describedby', ids.join(' '));
        else target.removeAttribute('aria-describedby');
      }
      target = null;
      setTip(null);
    };
    dismiss.current = close;
    const showFor = (element: HTMLElement) => {
      if (element === target || element === dismissed) return;
      const text = tooltipText(element);
      if (!text) { close(); return; }
      close();
      target = element;
      timer = setTimeout(() => {
        if (!element.isConnected || tooltipText(element) !== text) { close(); return; }
        if (!element.hasAttribute('data-tooltip-overflow') && element.getAttribute('aria-label') !== text) {
          const ids = new Set((element.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
          ids.add('ludora-tooltip');
          element.setAttribute('aria-describedby', [...ids].join(' '));
        }
        setTip({ text, target: element, host: element.closest('dialog') || document.body });
      }, 500);
    };
    const show = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      if (event instanceof PointerEvent && event.pointerType === 'touch') { touched = true; close(); return; }
      if (event.type === 'focusin' && (touched || !event.target.matches(':focus-visible'))) return;
      if (panel.current?.contains(event.target)) { clearTimeout(timer); return; }
      let element = event.target.closest<HTMLElement>('[data-tooltip]');
      if (!element && event.type === 'focusin') {
        element = [...event.target.querySelectorAll<HTMLElement>('[data-tooltip]')].find(item => tooltipText(item)) || null;
      }
      if (element && event.type === 'focusin') {
        close();
        focusTarget = element;
        focusTimer = setTimeout(() => {
          if (element.isConnected && (element.matches(':focus-visible') || element.contains(document.activeElement))) showFor(element);
        }, 100);
      } else if (element) showFor(element);
      else close();
    };
    const scroll = () => {
      const element = focusTarget;
      if (!element) { close(); return; }
      clearTimeout(focusTimer);
      focusTimer = setTimeout(() => {
        if (element.isConnected && (element.matches(':focus-visible') || element.contains(document.activeElement))) showFor(element);
      }, 100);
    };
    const leave = (event: Event) => {
      const next = (event as FocusEvent).relatedTarget;
      if (next instanceof Node && (target?.contains(next) || panel.current?.contains(next))) return;
      if (event.target instanceof Element && event.target.closest('[data-tooltip]') === dismissed) dismissed = null;
      clearTimeout(timer);
      timer = setTimeout(close, 120);
    };
    const pointerDown = (event: PointerEvent) => {
      touched = event.pointerType === 'touch';
      dismissed = target;
      close();
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') { touched = false; dismissed = null; }
      if (event.key === 'Escape' && target) {
        dismissed = target;
        if (panel.current) {
          event.preventDefault();
          event.stopPropagation();
        }
        close();
      }
    };
    const blur = () => { dismissed = null; close(); };
    document.addEventListener('pointerover', show);
    document.addEventListener('focusin', show);
    document.addEventListener('pointerout', leave);
    document.addEventListener('focusout', leave);
    document.addEventListener('pointerdown', pointerDown, true);
    document.addEventListener('click', close, true);
    document.addEventListener('keydown', keyDown, true);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', close);
    window.addEventListener('blur', blur);
    return () => {
      close();
      document.removeEventListener('pointerover', show);
      document.removeEventListener('focusin', show);
      document.removeEventListener('pointerout', leave);
      document.removeEventListener('focusout', leave);
      document.removeEventListener('pointerdown', pointerDown, true);
      document.removeEventListener('click', close, true);
      document.removeEventListener('keydown', keyDown, true);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', blur);
    };
  }, []);

  useEffect(() => { dismiss.current(); }, [pathname]);

  useLayoutEffect(() => {
    if (!tip || !panel.current) return;
    const element = panel.current;
    const target = tip.target.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0;
    const top = viewport?.offsetTop || 0;
    const width = viewport?.width || innerWidth;
    const height = viewport?.height || innerHeight;
    const x = Math.max(left + 12, Math.min(left + width - rect.width - 12, target.left + target.width / 2 - rect.width / 2));
    const above = target.top - rect.height - 8;
    const y = above >= top + 12 ? above : Math.min(top + height - rect.height - 12, target.bottom + 8);
    element.style.left = `${x}px`;
    element.style.top = `${Math.max(top + 12, y)}px`;
    element.style.visibility = 'visible';
  }, [tip]);

  return tip ? createPortal(<div ref={panel} id="ludora-tooltip" role="tooltip" className="ludora-tooltip" style={{ visibility: 'hidden' }}>
    {tip.text}
  </div>, tip.host) : null;
}
