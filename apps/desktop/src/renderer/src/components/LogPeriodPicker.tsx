import { Icon } from '@web/components/Icon';
import { DesktopMenu } from './DesktopMenu';
import { PERIODOS_LOG, type PeriodoLog } from '../../../shared/log-period';

function PeriodIcon({ live }: { live: boolean }) {
  return live ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="m13 2-8 12h6l-1 8 9-13h-6l1-7Z"/></svg> : <Icon name="clock" size={16}/>;
}

export function LogPeriodPicker({ value, onChange }: { value: PeriodoLog; onChange: (v: PeriodoLog) => void }) {
  const rotulo = PERIODOS_LOG.find(p => p.value === value)!.label;
  return <DesktopMenu label={`Período dos logs: ${rotulo}`} className="desktop-log-select desktop-log-period"
    trigger={<><PeriodIcon live={value === 'live'}/><span>{rotulo}</span><Icon name="chevronRight" size={14}/></>}>
    {PERIODOS_LOG.map(p => <button type="button" key={p.value} role="menuitemradio" aria-checked={value === p.value} onClick={() => onChange(p.value)}>
      <PeriodIcon live={p.value === 'live'}/>{p.label}{value === p.value && <span className="desktop-menu-selection-dot" aria-hidden="true"/>}
    </button>)}
  </DesktopMenu>;
}
