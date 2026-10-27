export function playerAge(birth: string, today = new Date()): number {
  const [year, month, day] = birth.slice(0,10).split('-').map(Number);
  return today.getFullYear() - year - (today.getMonth()+1 < month || today.getMonth()+1 === month && today.getDate() < day ? 1 : 0);
}
