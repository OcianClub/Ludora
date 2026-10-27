export function formatTimeInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0,4);
  return digits.length > 2 ? `${digits.slice(0,2)}:${digits.slice(2)}` : digits;
}
export function validTimeInput(value: string): boolean { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
