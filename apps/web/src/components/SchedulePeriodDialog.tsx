import { useState } from 'react';
import { Btn, Input, Modal } from './UI';
import { Icon } from './Icon';

export function SchedulePeriodDialog({ inicio, fim, onClose, onApply }: {
  inicio: string;
  fim: string;
  onClose: () => void;
  onApply: (inicio: string, fim: string) => void;
}) {
  const [start, setStart] = useState(inicio);
  const [end, setEnd] = useState(fim);
  const [year, setYear] = useState(() => Number(inicio.slice(0, 4)) || new Date().getFullYear());
  const [error, setError] = useState('');

  function monthRange(month: number) {
    const last = new Date(year, month + 1, 0).getDate();
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    setStart(`${prefix}-01`);
    setEnd(`${prefix}-${last}`);
    setError('');
  }

  return <Modal open title="Escolher período" className="schedule-period-dialog" onClose={onClose}>
    <div className="schedule-year-picker">
      <button type="button" aria-label="Ano anterior" disabled={year <= 1900} onClick={() => setYear(value => value - 1)}><Icon name="chevronLeft" /></button>
      <strong><Icon name="calendar" />{year}</strong>
      <button type="button" aria-label="Próximo ano" disabled={year >= 2100} onClick={() => setYear(value => value + 1)}><Icon name="chevronRight" /></button>
    </div>
    <div className="schedule-month-picker" role="group" aria-label="Escolher mês">
      {Array.from({ length: 12 }, (_, month) => {
        const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        return <button type="button" key={month} aria-pressed={start === `${prefix}-01` && end === `${prefix}-${new Date(year, month + 1, 0).getDate()}`}
          onClick={() => monthRange(month)}>{new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</button>;
      })}
    </div>
    <Btn variant="ghost" onClick={() => { setStart(`${year}-01-01`); setEnd(`${year}-12-31`); setError(''); }}>Ano inteiro</Btn>
    <fieldset className="schedule-custom-range">
      <legend>Ou defina um intervalo</legend>
      <Input label="De" type="date" value={start} onChange={event => setStart(event.target.value)} />
      <Input label="Até" type="date" value={end} onChange={event => setEnd(event.target.value)} />
    </fieldset>
    {error && <p className="notice-error" role="alert">{error}</p>}
    <div className="collection-dialog-actions">
      <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
      <Btn onClick={() => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
          setError('Informe as duas datas, com o início anterior ou igual ao fim.');
          return;
        }
        onApply(start, end);
      }}>Aplicar período</Btn>
    </div>
  </Modal>;
}
