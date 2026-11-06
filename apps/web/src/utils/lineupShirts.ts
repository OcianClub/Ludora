import type { EscalacaoItem } from '../services/api';

export function validShirtNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 99;
}

export function parseShirtNumber(value: string): number | null {
  const text = value.trim();
  if (!/^[0-9]{1,2}$/.test(text)) return null;
  const number = Number(text);
  return validShirtNumber(number) ? number : null;
}

export function formatShirtNumber(value: unknown): string {
  return validShirtNumber(value) ? String(value).padStart(2, '0') : '—';
}

export function reconcileLineupShirts(lineup: EscalacaoItem[], changes: Map<number, number | null | undefined>) {
  const removed: number[] = [];
  const next = lineup.flatMap(item => {
    if (!changes.has(item.jogador_id)) return [item];
    const shirt = changes.get(item.jogador_id);
    if (!validShirtNumber(shirt)) { removed.push(item.jogador_id); return []; }
    return [{ ...item, numCamisa: shirt, jogador: item.jogador ? { ...item.jogador, numCamisa: shirt } : undefined }];
  });
  return { lineup: next, removed, changed: next.length !== lineup.length || next.some((item, index) => item.numCamisa !== lineup[index].numCamisa) };
}
