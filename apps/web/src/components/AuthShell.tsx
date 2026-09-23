import { ReactNode } from 'react';
import { Brand } from './Brand';
import { Icon } from './Icon';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <main className="auth-page">
    <section className="auth-story" aria-label="Ludora">
      <Brand />
      <div className="auth-story-content">
        <span className="eyebrow">DENTRO E FORA DE CAMPO</span>
        <h2>O seu clube.<br />Mais perto<br /><span>de você.</span></h2>
        <p>Acompanhe o elenco, as próximas partidas e cada resultado do seu time.</p>
        <div className="auth-pitch" aria-hidden="true"><span className="pitch-circle" /><span className="pitch-goal left" /><span className="pitch-goal right" /><span className="pitch-ball"><Icon name="ball" size={28} /></span></div>
      </div>
      <span className="auth-story-footer">FUTEBOL CONECTA. LUDORA APROXIMA.</span>
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        <div className="auth-mobile-brand"><Brand /></div>
        <div className="auth-heading"><span className="eyebrow">SEU ESPAÇO NO CLUBE</span><h1>{title}</h1><p>{subtitle}</p></div>
        {children}
      </div>
    </section>
  </main>;
}
