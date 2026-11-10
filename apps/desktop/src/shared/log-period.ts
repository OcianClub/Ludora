export const PERIODOS_LOG = [
  { value: 'live', label: 'Ao vivo' },
  { value: '60', label: 'Última hora' },
  { value: '240', label: 'Últimas 4 horas' },
  { value: '1440', label: 'Últimas 24 horas' },
  { value: '2880', label: 'Últimos 2 dias' },
  { value: '10080', label: 'Últimos 7 dias' },
  { value: '20160', label: 'Últimos 14 dias' },
  { value: '43200', label: 'Últimos 30 dias' },
] as const;
export type PeriodoLog = typeof PERIODOS_LOG[number]['value'];

export function dentroDoPeriodo(ts: string, periodo: PeriodoLog, agora: number) {
  if (periodo === 'live') return true;
  const instante = Date.parse(ts);
  return Number.isFinite(instante) && instante >= agora - Number(periodo) * 60000 && instante <= agora;
}
