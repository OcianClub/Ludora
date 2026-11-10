const zone = { timeZone: 'America/Sao_Paulo' };
const dayKey = (value: Date) => value.toLocaleDateString('sv-SE', zone);
const dayNumber = (value: Date) => Date.parse(`${dayKey(value)}T00:00:00Z`) / 86400000;

/** Agrupa pela última finalização, sem confundir criação/comentários com encerramento. */
export function agruparFinalizados<T extends { finalizadoEm?: string | null }>(items: T[], now = new Date()) {
  const today = dayNumber(now);
  const weekday = new Date(today * 86400000).getUTCDay();
  const monday = today - (weekday + 6) % 7;
  const groups = new Map<string, { key: string; label: string; items: T[] }>();
  const timestamp = (item: T) => item.finalizadoEm ? Date.parse(item.finalizadoEm) : NaN;
  const sorted = [...items].sort((a, b) => (Number.isFinite(timestamp(b)) ? timestamp(b) : -Infinity) - (Number.isFinite(timestamp(a)) ? timestamp(a) : -Infinity));
  for (const item of sorted) {
    const date = new Date(timestamp(item));
    let key = 'unknown', label = 'Data de encerramento indisponível';
    if (Number.isFinite(date.getTime())) {
      const day = dayNumber(date), delta = today - day;
      if (delta === 0) { key = 'today'; label = 'Hoje'; }
      else if (delta === 1) { key = 'yesterday'; label = 'Ontem'; }
      else if (day >= monday && day <= today) { key = 'week'; label = 'Esta semana'; }
      else if (day >= monday - 7 && day < monday) { key = 'previous-week'; label = 'Semana passada'; }
      else {
        key = dayKey(date).slice(0, 7);
        const year = key.slice(0, 4);
        label = date.toLocaleDateString('pt-BR', { ...zone, month: 'long', ...(year !== dayKey(now).slice(0, 4) ? { year: 'numeric' } : {}) });
        label = label[0].toUpperCase() + label.slice(1);
      }
    }
    const group = groups.get(key) || { key, label, items: [] };
    group.items.push(item); groups.set(key, group);
  }
  return [...groups.values()];
}
