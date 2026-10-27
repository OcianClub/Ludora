export function categorySnap(index: number, distance: number, velocity: number, itemWidth: number, count: number) {
  'worklet';
  if (Math.abs(distance) < 20 && Math.abs(velocity) < .3) return index;
  const projected = index - (distance + velocity * 180) / itemWidth;
  return Math.max(0, Math.min(count - 1, Math.round(projected)));
}

export function pageDestination(origin: number, position: number, velocity: number, count: number) {
  'worklet';
  const distance = position - origin;
  if (Math.abs(distance) < .22 && Math.abs(velocity) < .45) return origin;
  const projected = position + velocity * .18;
  const direction = projected > origin + .16 ? 1 : projected < origin - .16 ? -1 : 0;
  return Math.max(0, Math.min(count - 1, origin + direction));
}
