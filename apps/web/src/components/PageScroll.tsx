import { useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import './PageScroll.css';

const positions = new Map<string, number>();
const webLists = /^\/(?:jogadores|elenco|partidas|competicoes(?:\/paulista)?|clubes\/\d+\/(?:partidas|competicoes))$/;

export function PageScroll({ scope, desktop = false }: { scope: string; desktop?: boolean }) {
  const { pathname, search } = useLocation();
  const searchRef = useRef(search);
  useLayoutEffect(() => { searchRef.current = search; }, [search]);
  const [visible, setVisible] = useState(false);
  const allowed = desktop ? pathname !== '/logs' : !/^\/(?:login|registrar|convite|recuperar-senha|confirmar-email)(?:\/|$)/.test(pathname);

  useLayoutEffect(() => {
    const container = desktop ? document.querySelector<HTMLElement>('.admin-workspace') : window;
    if (!container) return;
    const top = () => container instanceof Window ? container.scrollY : container.scrollTop;
    const key = scope + pathname + searchRef.current;
    const activeSearch = searchRef.current;
    const tracked = !desktop && webLists.test(pathname);
    const target = tracked ? positions.get(key) || 0 : 0;
    let restoring = false;
    let observer: ResizeObserver | undefined;
    let timeout: number | undefined;
    const stop = () => {
      restoring = false;
      observer?.disconnect();
      window.clearTimeout(timeout);
    };
    const remember = () => {
      const y = top();
      setVisible(y > 650);
      if (!tracked || restoring) return;
      const currentKey = scope + pathname + searchRef.current;
      positions.delete(currentKey);
      positions.set(currentKey, y);
      if (positions.size > 80) positions.delete(positions.keys().next().value!);
    };
    const restore = () => {
      if (activeSearch !== searchRef.current) { stop(); return; }
      container.scrollTo({ top: target, behavior: 'instant' });
      if (top() >= target - 1) { stop(); remember(); }
    };
    restoring = target > 0;
    restore();
    if (restoring) {
      const content = document.getElementById('main-content') || document.body;
      observer = new ResizeObserver(restore);
      observer.observe(content);
      timeout = window.setTimeout(stop, 4000);
    }
    container.addEventListener('scroll', remember, { passive: true });
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchmove', stop, { passive: true });
    const onScrollKey = (event: KeyboardEvent) => { if (['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) stop(); };
    window.addEventListener('keydown', onScrollKey);
    return () => {
      stop();
      container.removeEventListener('scroll', remember);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchmove', stop);
      window.removeEventListener('keydown', onScrollKey);
    };
  // Query changes within a list keep its current viewport.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, pathname, desktop]);

  if (!allowed || !visible) return null;
  return <button type="button" className={`page-to-top${desktop ? ' page-to-top-desktop' : ''}`} aria-label="Voltar ao topo"
    title="Voltar ao topo" onClick={() => {
      const container = desktop ? document.querySelector('.admin-workspace') : window;
      container?.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      document.getElementById('main-content')?.focus({ preventScroll: true });
    }}><Icon name="chevronRight" size={19} /></button>;
}
