import { ReactNode, useEffect, useRef } from 'react';
import { Brand } from './Brand';
import { Icon } from './Icon';
import { ThemeToggle } from './ThemeToggle';

export function AuthShell({ title, subtitle, children, back, progress }: {
  title: string;
  subtitle: string;
  children: ReactNode;
  back?: ReactNode;
  progress?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [title]);
  return <main className="auth-page">
    <section className="auth-story" aria-label="Ludora">
      <Brand />
      <div className="auth-story-content">
        <span className="eyebrow">DENTRO E FORA DA QUADRA</span>
        <h2>O seu clube.<br />Mais perto<br /><span>de você.</span></h2>
        <p>Acompanhe o elenco, as próximas partidas e cada resultado do seu time.</p>
        <div className="auth-pitch" aria-hidden="true"><span className="pitch-circle" /><span className="pitch-goal left" /><span className="pitch-goal right" /><span className="pitch-ball"><Icon name="ball" size={28} /></span></div>
      </div>
      <span className="auth-story-footer">FUTSAL CONECTA. LUDORA APROXIMA.</span>
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        <div className="access-topbar">{back || <span />}<ThemeToggle /></div>
        <div className="access-brand"><Brand /></div>
        {progress}
        <div className="auth-heading"><h1 tabIndex={-1} ref={heading}>{title}</h1><p>{subtitle}</p></div>
        {children}
      </div>
    </section>
  </main>;
}
