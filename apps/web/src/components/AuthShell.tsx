import { ReactNode, useEffect, useRef } from 'react';
import { Brand } from './Brand';
import { ThemeOptions } from './ThemeOptions';
import { AuthStory, MobileAuthStory, type RegistrationStep } from './auth/AuthStory';

export function AuthShell({ title, subtitle, children, back, progress, footer, invite, intent, registerStep = 1 }: {
  intent?: 'login' | 'register';
  registerStep?: RegistrationStep;
  title: string;
  subtitle: string;
  children: ReactNode;
  back?: ReactNode;
  progress?: ReactNode;
  footer?: ReactNode;
  invite?: ReactNode;
}) {
  const storyStep = intent === 'register' ? registerStep : undefined;
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
  return <main className={`auth-page${intent ? ' auth-page--access' : ''}`} ref={shell}>
    <AuthStory step={storyStep} />
    <section className="auth-panel">
      <div className={`auth-card${hasFooter ? ' auth-card--footer' : ''}`}>
        <div className={`access-topbar${back ? ' has-navigation' : ''}`}>
          <div className="access-mobile-brand"><Brand /></div>
          {back}
          <ThemeOptions />
        </div>
        {progress}
        <div className="auth-heading"><h1 tabIndex={-1} ref={heading}>{title}</h1><p>{subtitle}</p></div>
        {children}
        {hasFooter && <div className="auth-footer" ref={footerElement}>{footer}</div>}
        {invite}
        {storyStep && <MobileAuthStory step={storyStep} />}
      </div>
    </section>
  </main>;
}
