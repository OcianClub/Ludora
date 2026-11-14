import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from './UI';
import './ResponsivePanel.css';

const mobileQuery = '(max-width: 760px)';

export function ResponsivePanel({ anchor, title, onClose, children, footer, className = '', wide = false }: {
  anchor: HTMLElement | null;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  const [mobile, setMobile] = useState(() => matchMedia(mobileQuery).matches);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useRef(onClose);

  useLayoutEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!anchor) return;
    const media = matchMedia(mobileQuery);
    const update = () => {
      if (!anchor.getClientRects().length) close.current();
      setMobile(media.matches);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [anchor]);

  useLayoutEffect(() => {
    const element = panel.current;
    if (!anchor || mobile || !element) return;
    if (typeof element.showPopover === 'function' && !element.matches(':popover-open')) {
      element.setAttribute('popover', 'manual');
      element.showPopover();
    }

    const position = () => {
      if (!anchor.isConnected || !anchor.getClientRects().length) {
        close.current();
        return;
      }
      const box = anchor.getBoundingClientRect();
      const gutter = 12;
      const gap = 6;
      const below = innerHeight - box.bottom - gutter - gap;
      const above = box.top - gutter - gap;
      const content = element.querySelector('.modal-body');
      const fixedHeight = element.offsetHeight - (content?.clientHeight ?? 0);
      const desiredHeight = fixedHeight + (content?.scrollHeight ?? 0);
      const up = below < Math.min(desiredHeight, 540) && above > below;
      element.style.maxHeight = `${Math.min(540, Math.max(0, up ? above : below))}px`;
      element.style.left = `${Math.max(gutter, Math.min(box.right - element.offsetWidth, innerWidth - element.offsetWidth - gutter))}px`;
      element.style.top = up ? 'auto' : `${Math.max(gutter, box.bottom + gap)}px`;
      element.style.bottom = up ? `${Math.max(gutter, innerHeight - box.top + gap)}px` : 'auto';
    };
    position();
    element.focus({ preventScroll: true });

    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !element.contains(event.target) && !anchor.contains(event.target)) close.current();
    };
    const leave = (event: FocusEvent) => {
      if (event.target instanceof Node && !element.contains(event.target) && !anchor.contains(event.target)) close.current();
    };
    const observer = new ResizeObserver(position);
    observer.observe(anchor);
    observer.observe(element);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', leave);
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    return () => {
      observer.disconnect();
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', leave);
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
      if ((element.contains(document.activeElement) || document.activeElement === document.body) && anchor.isConnected) {
        anchor.focus({ preventScroll: true });
      }
    };
  }, [anchor, mobile]);

  if (!anchor) return null;
  if (mobile) return <Modal open title={title} onClose={onClose} className={`responsive-sheet ${className}`} footer={footer}>{children}</Modal>;

  return createPortal(
    <div ref={panel} role="dialog" aria-labelledby={titleId} tabIndex={-1} data-swipe-ignore
      className={`responsive-popover${wide ? ' responsive-popover-wide' : ''} ${className}`}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}>
      <div className="modal-header"><h2 id={titleId} className="modal-title">{title}</h2>
        <button type="button" className="modal-close" aria-label="Fechar janela" onClick={onClose}>✕</button>
      </div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-footer">{footer}</div>}
    </div>,
    anchor.closest('dialog[open]') || document.body,
  );
}
