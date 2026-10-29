import { ReactNode, useEffect, useRef } from 'react';
import { Brand } from './Brand';
import { Icon } from './Icon';
import { ThemeOptions } from './ThemeOptions';

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
        <span className="eyebrow">GESTÃO ESPORTIVA PARA CLUBES</span>
        <h2>Seu clube.<br />Seu jogo.<br /><span>Mais conectado.</span></h2>
        <p>Organize seu clube, acompanhe as partidas e descubra o desempenho de cada atleta em um só lugar.</p>
        <div className="auth-pitch" aria-hidden="true"><span className="pitch-circle" /><span className="pitch-goal left" /><span className="pitch-goal right" /><span className="pitch-ball"><Icon name="ball" size={28} /></span></div>
        <div className="auth-story-features" aria-label="Recursos do Ludora"><span>Gestão do clube</span><span>Partidas</span><span>Scout de atletas</span></div>
      </div>
      <span className="auth-story-footer">FUTSAL CONECTA. LUDORA APROXIMA.</span>
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        <div className="access-mobile-brand"><Brand /></div>
        <div className="access-topbar">{back || <span />}<ThemeOptions /></div>
        {progress}
        <div className="auth-heading"><h1 tabIndex={-1} ref={heading}>{title}</h1><p>{subtitle}</p></div>
        {children}
      </div>
    </section>
  </main>;
}
