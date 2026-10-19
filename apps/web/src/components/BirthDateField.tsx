import { useState } from 'react';
import { Choice } from './CollectionControls';
import { birthDate, birthYearLimits } from '../utils/playerForm';
export function BirthDateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [parts, setParts] = useState(() => value ? value.split('-') : ['', '', '']);
  const { min, max } = birthYearLimits();
  const [year, month, day] = parts;
  const days = year && month ? new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate() : 31;
  function update(index: number, value: string) {
    const next = [...parts]; next[index] = value;
    if (next[0] && next[1] && Number(next[2]) > new Date(Date.UTC(Number(next[0]), Number(next[1]), 0)).getUTCDate()) next[2] = '';
    setParts(next); onChange(birthDate(next[0], next[1], next[2]));
  }
  const option = (value: number) => ({ value: String(value).padStart(2, '0'), label: String(value) });
  return <div className="full"><span className="field-label">Data de nascimento</span><div className="birth-fields">
    <Choice label="Ano" value={year} onChange={v => update(0, v)} options={Array.from({length: max-min+1}, (_,i) => option(max-i))} />
    <Choice label="Mês" value={month} onChange={v => update(1, v)} options={['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((label,i) => ({value:String(i+1).padStart(2,'0'),label}))} />
    <Choice label="Dia" value={day} onChange={v => update(2, v)} options={Array.from({length:days},(_,i)=>option(i+1))} />
  </div><small className="text-muted">Anos permitidos: {min} a {max}. Idade considerada na temporada: 4 a 18 anos.</small></div>;
}
