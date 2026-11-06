import { ReactNode, useEffect, useRef } from 'react';
import { Brand } from './Brand';
import { Icon } from './Icon';
import { ThemeOptions } from './ThemeOptions';

export function AuthShell({ title, subtitle, children, back, progress, footer, navigation, intent }: {
  intent?: "login" | "register";
  title: string;
  subtitle: string;
  children: ReactNode;
  back?: ReactNode;
  progress?: ReactNode;
  footer?: ReactNode;
  navigation?: ReactNode;
}) {
  const story = intent === 'register' ? {
    eyebrow: 'SEU PRÓXIMO PASSO NO FUTSAL',
    lines: ['Entre no jogo.', 'Faça parte.', 'Viva o Ludora.'],
    description: 'Crie sua conta e conecte-se ao seu clube. Acompanhe partidas e participe da equipe com o acesso que receber.',
  } : intent === 'login' ? {
    eyebrow: 'SEU CLUBE, DENTRO E FORA DA QUADRA',
    lines: ['Seu clube.', 'Seu jogo.', 'Tudo conectado.'],
    description: 'Acesse seu clube para organizar a rotina, acompanhar partidas e consultar o Scout dos atletas.',
  } : {
    eyebrow: 'GESTÃO ESPORTIVA PARA CLUBES',
    lines: ['Seu clube.', 'Seu jogo.', 'Mais conectado.'],
    description: 'Organize seu clube, acompanhe as partidas e descubra o desempenho de cada atleta em um só lugar.',
  };
  const heading = useRef<HTMLHeadingElement>(null);
  const shell = useRef<HTMLElement>(null);
  const footerElement = useRef<HTMLDivElement>(null);
  const hasFooter = !!footer;
  useEffect(() => {
    if (!hasFooter) return;
    const viewport = window.visualViewport;
    let frame = 0;
    let restingHeight = window.innerHeight;
    let restingWidth = window.innerWidth;
    let wasEditing = false;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const inset = viewport ? Math.max(0, innerHeight - viewport.height - viewport.offsetTop) : 0;
        if (window.innerWidth !== restingWidth) {
          restingWidth = window.innerWidth;
          restingHeight = window.innerHeight;
        }
        const focused = document.activeElement;
        const editable = focused instanceof HTMLElement && focused.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, [contenteditable="true"]');
        const keyboardVisible = restingHeight - (viewport?.height ?? innerHeight) > 150;
        const editing = editable || (wasEditing && keyboardVisible);
        if (!editing) restingHeight = window.innerHeight;
        wasEditing = editing;
        // Leia a altura antes de alterar estilos, e evite reescrevê-los em cada scroll.
        const footerHeight = `${footerElement.current?.offsetHeight || 130}px`;
        const element = shell.current;
        if (element) {
          if (element.dataset.authEditing !== String(editing)) element.dataset.authEditing = String(editing);
          if (element.style.getPropertyValue('--auth-keyboard-inset') !== `${inset}px`) element.style.setProperty('--auth-keyboard-inset', `${inset}px`);
          if (element.style.getPropertyValue('--auth-footer-height') !== footerHeight) element.style.setProperty('--auth-footer-height', footerHeight);
        }
        if (editable && window.matchMedia('(max-width: 760px)').matches) {
          const rect = focused.getBoundingClientRect();
          const visibleTop = viewport?.offsetTop ?? 0;
          const visibleBottom = visibleTop + (viewport?.height ?? innerHeight);
          if (rect.bottom > visibleBottom - 20) window.scrollBy({ top: rect.bottom - visibleBottom + 20, behavior: 'instant' });
          else if (rect.top < visibleTop + 12) window.scrollBy({ top: rect.top - visibleTop - 12, behavior: 'instant' });
        }
      });
    };
    const observer = new ResizeObserver(measure);
    if (footerElement.current) observer.observe(footerElement.current);
    viewport?.addEventListener('resize', measure);
    viewport?.addEventListener('scroll', measure);
    window.addEventListener('resize', measure);
    document.addEventListener('focusin', measure);
    document.addEventListener('focusout', measure);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      viewport?.removeEventListener('resize', measure);
      viewport?.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      document.removeEventListener('focusin', measure);
      document.removeEventListener('focusout', measure);
    };
  }, [hasFooter]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [title]);
  return <main className="auth-page" ref={shell}>
    <section className="auth-story" aria-label="Ludora">
      <Brand />
      <div className="auth-story-content">
        <span className="eyebrow">{story.eyebrow}</span>
        <h2>{story.lines[0]}<br />{story.lines[1]}<br /><span>{story.lines[2]}</span></h2>
        <p>{story.description}</p>
        <div className="auth-pitch" aria-hidden="true"><span className="pitch-circle" /><span className="pitch-goal left" /><span className="pitch-goal right" /><span className="pitch-ball"><Icon name="ball" size={28} /></span></div>
        <div className="auth-story-features" aria-label="Recursos do Ludora"><span>Gestão do clube</span><span>Partidas</span><span>Scout de atletas</span></div>
      </div>
      <span className="auth-story-footer">FUTSAL CONECTA. LUDORA APROXIMA.</span>
    </section>
    <section className="auth-panel">
      <div className={`auth-card${hasFooter ? ' auth-card--footer' : ''}`}>
        <div className={`access-topbar${back || navigation ? ' has-navigation' : ''}`}>
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
