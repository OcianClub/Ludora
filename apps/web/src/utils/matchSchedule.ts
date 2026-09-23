import type { Partida } from '../services/api';

export type GroupMode = 'month' | 'week';
export type SortMode = 'priority' | 'earliest' | 'latest';
export const STATUS_PRIORITY: Record<string, number> = { AO_VIVO: 0, PREPARADA: 1, AGENDADA: 2, FINALIZADA: 3, CANCELADA: 4 };

function calendarDate(value: string) { return new Date(`${value.slice(0, 10)}T12:00:00Z`); }
function labelDate(date: Date, options: Intl.DateTimeFormatOptions) {
  return date.toLocaleDateString('pt-BR', { ...options, timeZone: 'UTC' });
}

export function matchPeriod(value: string, mode: GroupMode) {
  const date = calendarDate(value);
  if (mode === 'month') return { key: value.slice(0, 7), label: labelDate(date, { month: 'long', year: 'numeric' }) };
  // Segunda-feira inicia a semana, inclusive quando ela atravessa mês/ano.
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  const end = new Date(date);
  end.setUTCDate(end.getUTCDate() + 6);
  return { key: date.toISOString().slice(0, 10), label: `${labelDate(date, { day: '2-digit', month: 'short', year: 'numeric' })} — ${labelDate(end, { day: '2-digit', month: 'short', year: 'numeric' })}` };
}

export function sortMatches(matches: Partida[], mode: SortMode) {
  return [...matches].sort((a, b) => {
    const priority = mode === 'priority' ? (STATUS_PRIORITY[a.status] ?? 5) - (STATUS_PRIORITY[b.status] ?? 5) : 0;
    const date = `${a.data.slice(0, 10)} ${a.horario || '99:99'}`.localeCompare(`${b.data.slice(0, 10)} ${b.horario || '99:99'}`);
    return priority || (mode === 'latest' ? -date : date) || a.id - b.id;
  });
}

export function groupMatches(matches: Partida[], mode: GroupMode, order: SortMode) {
  const periods = new Map<string, { key: string; label: string; days: Map<string, Partida[]> }>();
  for (const match of matches) {
    const period = matchPeriod(match.data, mode);
    if (!periods.has(period.key)) periods.set(period.key, { ...period, days: new Map() });
    const day = match.data.slice(0, 10);
    const days = periods.get(period.key)!.days;
    days.set(day, [...(days.get(day) || []), match]);
  }
  const compareDates = (a: string, b: string) => order === 'latest' ? b.localeCompare(a) : a.localeCompare(b);
  return [...periods.values()].sort((a, b) => compareDates(a.key, b.key)).map(period => ({
    key: period.key, label: period.label,
    days: [...period.days.entries()].sort(([a], [b]) => compareDates(a, b)).map(([date, games]) => ({
      date, label: labelDate(calendarDate(date), { weekday: 'long', day: '2-digit', month: 'long' }),
      matches: sortMatches(games, order),
    })),
  }));
}
