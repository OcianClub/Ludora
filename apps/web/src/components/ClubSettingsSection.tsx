import { useId, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import '../pages/ClubePerfil.css';

export function ClubSettingsSection({ icon, title, description, optional, children, className = '' }: {
  icon: IconName; title: string; description?: string; optional?: boolean; children: ReactNode; className?: string;
}) {
  const id = useId();
  return <section className={`club-settings-section ${className}`} aria-labelledby={id}>
    <header className="club-settings-section-heading">
      <Icon name={icon} size={21}/>
      <div><h2 id={id}>{title}{optional && <span>Opcional</span>}</h2>{description && <p>{description}</p>}</div>
    </header>
    {children}
  </section>;
}
