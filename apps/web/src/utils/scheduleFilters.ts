import type { Partida } from '../services/api';

export type PeriodoAgenda = 'all' | 'today' | 'week' | 'month' | 'custom';

function diaLocal(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function intervaloAgenda(periodo: PeriodoAgenda, inicio = '', fim = '', now = new Date()) {
  if (periodo === 'all') return { inicio: '', fim: '' };
  if (periodo === 'custom') return { inicio, fim };
  if (periodo === 'today') return { inicio: diaLocal(now), fim: diaLocal(now) };
  if (periodo === 'month') return {
    inicio: diaLocal(new Date(now.getFullYear(), now.getMonth(), 1)),
    fim: diaLocal(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return { inicio: diaLocal(monday), fim: diaLocal(sunday) };
}

export function grupoSituacao(status: string) {
  if (status === 'AO_VIVO') return 'live';
  if (status === 'FINALIZADA') return 'past';
  if (status === 'CANCELADA') return 'cancelled';
  return 'next';
}

export function ordenarAgenda(matches: Partida[], porCategoria = false, historico = false) {
  return [...matches].sort((a, b) => {
    const category = porCategoria ? (a.categoria?.nome || '').localeCompare(b.categoria?.nome || '', 'pt-BR', { numeric: true }) : 0;
    const time = `${a.data.slice(0, 10)} ${a.horario || '23:59'}`.localeCompare(`${b.data.slice(0, 10)} ${b.horario || '23:59'}`);
    return category || (historico ? -time : time) || a.id - b.id;
  });
}

export function agruparAgenda(matches: Partida[], hoje = diaLocal(new Date())) {
  const groups: Record<'live' | 'today' | 'upcoming' | 'overdue' | 'finished' | 'cancelled', Partida[]> = {
    live: [], today: [], upcoming: [], overdue: [], finished: [], cancelled: [],
  };
  for (const match of matches) {
    if (match.status === 'AO_VIVO') groups.live.push(match);
    else if (match.status === 'FINALIZADA') groups.finished.push(match);
    else if (match.status === 'CANCELADA') groups.cancelled.push(match);
    else {
      const day = match.data.slice(0, 10);
      groups[day === hoje ? 'today' : day > hoje ? 'upcoming' : 'overdue'].push(match);
    }
  }
  return groups;
}

export function rotuloDiaAgenda(day: string, now = new Date()) {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (day === diaLocal(now)) return 'Hoje';
  if (day === diaLocal(tomorrow)) return 'Amanhã';
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}
