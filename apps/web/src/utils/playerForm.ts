export const digitsOnly = (value: string) => value.replace(/[^0-9]/g, '');
export function formatCpf(value: string) {
  const digits = digitsOnly(value).slice(0, 11);
  return digits.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}
// Nomes podem ter acentos, espaços, apóstrofos e hífens. Não aceitam emojis/controles.
export const cleanName = (value: string) => value.replace(/[\u200D\uFE0F\u20E3]/g, '').replace(/[^\p{L}\p{M} '\u2019-]/gu, '').slice(0, 120);
export function birthYearLimits(now = new Date()) {
  const year = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(now));
  return { min: year - 18, max: year - 4 };
}
export function birthDate(year: string, month: string, day: string) {
  if (!year || !month || !day) return '';
  const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : '';
}
