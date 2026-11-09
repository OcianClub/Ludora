import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';

export function useDropdownPlacement(
  root: RefObject<HTMLElement>,
  open: boolean,
  inline: boolean,
  maxHeight = 264,
  containInDialog = false,
) {
  const [placement, setPlacement] = useState<CSSProperties>();

  useLayoutEffect(() => {
    if (!open || inline || !root.current) return;
    const element = root.current;
    const viewport = window.visualViewport;
    function position() {
      const box = element.getBoundingClientRect();
      const top = viewport?.offsetTop || 0;
      const height = viewport?.height || innerHeight;
      const boundary = containInDialog ? element.closest('.modal-body')?.getBoundingClientRect() : undefined;
      const bottom = Math.min(top + height, boundary?.bottom ?? Infinity);
      const start = Math.max(top, boundary?.top ?? 0);
      const gutter = containInDialog ? 10 : 18;
      const below = Math.max(0, bottom - box.bottom - gutter);
      const above = Math.max(0, box.top - start - gutter);
      const upward = below < Math.min(200, above);
      const next: CSSProperties = {
        maxHeight: Math.min(maxHeight, upward ? above : below),
        top: upward ? 'auto' : 'calc(100% + 6px)',
        bottom: upward ? 'calc(100% + 6px)' : 'auto',
        marginTop: 0,
      };
      setPlacement((previous) =>
        previous?.maxHeight === next.maxHeight && previous?.top === next.top
          ? previous
          : next,
      );
    }
    position();
    const observer = new ResizeObserver(position);
    observer.observe(element);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    viewport?.addEventListener('resize', position);
    viewport?.addEventListener('scroll', position);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      viewport?.removeEventListener('resize', position);
      viewport?.removeEventListener('scroll', position);
    };
  }, [root, open, inline, maxHeight, containInDialog]);

  return inline ? undefined : placement;
}
