import { ReactNode, useEffect, useRef } from 'react';
import { Brand } from './Brand';
import { Icon } from './Icon';
import { ThemeOptions } from './ThemeOptions';

export function AuthShell({ title, subtitle, children, back, progress, footer, navigation }: {
  title: string;
  subtitle: string;
  children: ReactNode;
  back?: ReactNode;
  progress?: ReactNode;
  footer?: ReactNode;
  navigation?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const shell = useRef<HTMLElement>(null);
  const footerElement = useRef<HTMLDivElement>(null);
  const hasFooter = !!footer;
  useEffect(() => {
    if (!hasFooter) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const inset = viewport ? Math.max(0, innerHeight - viewport.height - viewport.offsetTop) : 0;
        shell.current?.style.setProperty('--auth-keyboard-inset', `${inset}px`);
        shell.current?.style.setProperty('--auth-footer-height', `${footerElement.current?.offsetHeight || 130}px`);
      });
    };
    const observer = new ResizeObserver(measure);
    if (footerElement.current) observer.observe(footerElement.current);
    viewport?.addEventListener('resize', measure);
    viewport?.addEventListener('scroll', measure);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      viewport?.removeEventListener('resize', measure);
      viewport?.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [hasFooter]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [title]);
  return <main className="auth-page" ref={shell}>
    <section className="auth-story" aria-label="Ludora">
      <Brand />
      <div className="auth-story-content">
        <span className="eyebrow">GESTÃO ESPORTIVA PARA CLUBES</span>
        <h2>Seu clube.<br />Seu jogo.<br /><span>Mais conectado.</span></h2>
        <p>Organize seu clube, acompanhe as partidas e descubra o desempenho de cada atleta em um só lugar.</p>
        <div className="auth-pitch" aria-hidden="true"><span className="pitch-circle" /><span className="pitch-goal left" /><span className="pitch-goal right" /><span className="pitch-ball"><Icon name="ball" size={28} /></span></div>
        <div className="auth-story-features" aria-label="Recursos do Ludora"><span>Gestão do clube</span><span>Partidas</span><span>Scout de atletas</span></div>
      </div>
      <span className="auth-story-footer">FUTSAL CONECTA. LUDORA APROXIMA.</span>
    </section>
    <section className="auth-panel">
      <div className={`auth-card${hasFooter ? ' auth-card--footer' : ''}`}>
        <div className="access-topbar">
          <div className="access-mobile-brand"><Brand /></div>
          {back || <span />}
          {navigation}
          <ThemeOptions />
        </div>
        {progress}
        <div className="auth-heading"><h1 tabIndex={-1} ref={heading}>{title}</h1><p>{subtitle}</p></div>
        {children}
        {hasFooter && <div className="auth-footer" ref={footerElement}>{footer}</div>}
      </div>
    </section>
  </main>;
}
