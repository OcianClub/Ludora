import { useId, useState, type ReactNode } from 'react';
import { Icon } from '@web/components/Icon';
import './DesktopAccordion.css';

/** Cabeçalho sem superfície; o conteúdo fechado sai da navegação por teclado. */
export function DesktopAccordion({ title, count, children, defaultOpen = false, className = '', headingLevel = 3 }: {
  title: ReactNode; count?: number; children: ReactNode; defaultOpen?: boolean; className?: string; headingLevel?: 2 | 3 | 4;
}) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  return <section className={`desktop-accordion ${className}`}>
    <Heading className="desktop-accordion-heading"><button type="button" id={`${id}-trigger`} aria-expanded={open}
      aria-controls={`${id}-content`} onClick={() => setOpen(value => !value)}>
      <span>{title}{count !== undefined && <small className="desktop-accordion-count">{count}</small>}</span>
      <span className={`desktop-accordion-chevron${open ? ' is-open' : ''}`}><Icon name="chevronRight" size={16}/></span>
    </button></Heading>
    <div id={`${id}-content`} aria-labelledby={`${id}-trigger`} hidden={!open} className="desktop-accordion-content">{children}</div>
  </section>;
}
