import { useState } from 'react';
import { Choice } from './CollectionControls';
import { birthDate, birthYearLimits } from '../utils/playerForm';
import { Icon } from './Icon';
import './BirthDateField.css';
export function BirthDateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [parts, setParts] = useState(() => value ? value.split('-') : ['', '', '']);
  const { min, max } = birthYearLimits();
  const [year, month, day] = parts;
  const days = month ? new Date(Date.UTC(Number(year) || 2000, Number(month), 0)).getUTCDate() : 31;
  function update(index: number, value: string) {
    const next = [...parts]; next[index] = value;
    if (next[1] && Number(next[2]) > new Date(Date.UTC(Number(next[0]) || 2000, Number(next[1]), 0)).getUTCDate()) next[2] = '';
    setParts(next); onChange(birthDate(next[0], next[1], next[2]));
  }
  const option = (value: number) => ({ value: String(value).padStart(2, '0'), label: String(value) });
  return <fieldset className="birth-date-field full">
    <legend><Icon name="calendar" size={17} />Data de nascimento</legend>
    <div className="birth-fields">
      <Choice label="Dia" placeholder="Dia" value={day} onChange={v => update(2, v)} options={Array.from({length:days},(_,i)=>option(i+1))} />
      <Choice label="Mês" placeholder="Mês" value={month} onChange={v => update(1, v)} options={['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((label,i) => ({value:String(i+1).padStart(2,'0'),label}))} />
      <Choice label="Ano" placeholder="Ano" value={year} onChange={v => update(0, v)} options={Array.from({length: max-min+1}, (_,i) => option(max-i))} />
    </div>
    <small className="birth-date-hint">Nascimentos de {min} a {max}. O sub é definido pela idade na temporada.</small>
  </fieldset>;
}
