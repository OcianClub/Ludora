import { Icon } from '@web/components/Icon';
import { DesktopSelect } from './DesktopSelect';
import { PERIODOS_LOG, type PeriodoLog } from '../../../shared/log-period';

function PeriodIcon({ live }: { live: boolean }) {
  return live ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="m13 2-8 12h6l-1 8 9-13h-6l1-7Z"/></svg> : <Icon name="clock" size={16}/>;
}

export function LogPeriodPicker({ value, onChange }: { value: PeriodoLog; onChange: (v: PeriodoLog) => void }) {
  return <DesktopSelect label="Período dos logs" height={40} value={value} onChange={onChange} className="desktop-log-period"
    options={PERIODOS_LOG.map(p => ({ ...p, icon: <PeriodIcon live={p.value === 'live'}/> }))}/>;
}
