import { useId, useState } from 'react';
import { Btn, Modal } from './UI';
import { Choice } from './CollectionControls';
import { Icon } from './Icon';
import './MatchDateTime.css';
import { formatTimeInput, validTimeInput } from '../utils/timeInput';

const pad = (value: number) => String(value).padStart(2, '0');
const months = Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: new Date(2026, i, 1).toLocaleDateString('pt-BR', { month: 'long' }) }));

export function MatchDateField({ value, onChange, min, disabled = false }: { value: string; onChange: (value: string) => void; min?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(new Date());
  const id = useId();
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const prefix = `${year}-${pad(month + 1)}`;
  const offset = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  return <div className="field">
    <span className="field-label" id={id}>Data</span>
    <button className="field-input date-time-trigger" type="button" aria-labelledby={id} aria-haspopup="dialog" disabled={disabled} onClick={() => {
      setCursor(new Date(`${value || min || new Date().toLocaleDateString('sv-SE')}T12:00:00`)); setOpen(true);
    }}><Icon name="calendar" size={18}/>{value ? value.split('-').reverse().join('/') : 'Escolher data'}</button>
    <Modal open={open} onClose={() => setOpen(false)} title="Data da partida" className="match-date-dialog">
      <div className="calendar-navigation">
        <button type="button" aria-label="Mês anterior" disabled={year <= 1900 || !!min && prefix <= min.slice(0, 7)} onClick={() => setCursor(new Date(year, month - 1, 1))}><Icon name="chevronLeft"/></button>
        <Choice label="Mês" value={String(month)} options={months} onChange={v => setCursor(new Date(year, Number(v), 1))}/>
        <Choice label="Ano" value={String(year)} options={Array.from({ length: 21 }, (_, i) => { const y = (min ? Number(min.slice(0,4)) : Math.min(year, new Date().getFullYear())) + i; return { value: String(y), label: String(y) }; })} onChange={v => setCursor(new Date(Number(v), month, 1))}/>
        <button type="button" aria-label="Próximo mês" disabled={year >= 2100 && month === 11} onClick={() => setCursor(new Date(year, month + 1, 1))}><Icon name="chevronRight"/></button>
      </div>
      <div className="match-calendar" role="group" aria-label="Dias do mês">
        {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(day => <small key={day}>{day}</small>)}
        {Array.from({ length: offset }, (_, i) => <span key={`empty-${i}`}/>)}
        {Array.from({ length: days }, (_, i) => {
          const date = `${prefix}-${pad(i + 1)}`;
          return <button type="button" key={date} aria-label={new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { dateStyle: 'full' })} aria-pressed={value === date} disabled={!!min && date < min} onClick={() => { onChange(date); setOpen(false); }}>{i + 1}</button>;
        })}
      </div>
      <p className="date-time-note">{min ? 'Escolha hoje ou uma data futura.' : 'Escolha o dia da partida.'}</p>
    </Modal>
  </div>;
}

export function MatchTimeField({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const [touched, setTouched] = useState(false);
  const id = useId();
  const error = touched && !!value && !validTimeInput(value);
  return <div className="field"><label className="field-label" htmlFor={id}>Horário</label>
    <div className="time-input-wrap"><Icon name="clock" size={18} /><input id={id} className="field-input" type="text" inputMode="numeric" placeholder="HH:MM" autoComplete="off" maxLength={5} value={value} disabled={disabled} aria-invalid={error || undefined} aria-describedby={error ? `${id}-error` : undefined} onChange={event => onChange(formatTimeInput(event.target.value))} onBlur={() => setTouched(true)} pattern="([01][0-9]|2[0-3]):[0-5][0-9]"/></div>
    {error && <span id={`${id}-error`} className="field-error">Use um horário de 00:00 a 23:59.</span>}
  </div>;
}
