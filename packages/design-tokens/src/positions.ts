// Geometry is shared by the DOM SVG and react-native-svg renderers.
// Every drawing fits the same 16 × 16 area inside a 24 × 24 viewBox.
export const positionDefinitions = {
  goalkeeper: { label: 'Goleiro', color: 'amarelo', paths: [
    { d: 'M8.5 19.5v-2l-3.4-4.1a1.1 1.1 0 0 1 1.6-1.5l1.8 1.8V7a1 1 0 0 1 2 0v4-5a1 1 0 0 1 2 0v5-5.5a1 1 0 0 1 2 0V11v-4a1 1 0 0 1 2 0v7.5l-1.5 3v2Z' },
    { d: 'M8.5 17.5H15' },
  ] },
  defender: { label: 'Fixo', color: 'primaria', paths: [
    { d: 'm12 4.5 7 3V12c0 3.5-3.5 6-7 7.5-3.5-1.5-7-4-7-7.5V7.5Z' },
    { d: 'm8.5 11.5 2.5 2.5 4.5-4.5' },
  ] },
  wing: { label: 'Ala', color: 'ciano', paths: [
    { d: 'M15.5 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z' },
    { d: 'm11 10 3-2 3 3h2.5M14 8l-2 6 4 5.5M12 14H8l-3.5 5.5M11 10H7.5l-2 3' },
  ] },
  pivot: { label: 'Pivô', color: 'laranja', paths: [
    { d: 'M19.5 12a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z' },
    { d: 'm12 8.5 3.3 2.4-1.25 3.9h-4.1l-1.25-3.9ZM12 8.5v-4m3.3 6.4 3.8-1.25m-5.05 5.15 2.35 3.35m-6.45-3.35L7.6 18.15m1.1-7.25L4.9 9.65' },
  ] },
} as const;
export const positionStrokeWidth = 1.6;
export function getPositionDefinition(position: string | null | undefined) {
  const name = (position || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const key = name === 'goleiro' ? 'goalkeeper' : name === 'fixo' ? 'defender' : name.startsWith('ala') ? 'wing' : name === 'pivo' ? 'pivot' : null;
  return key ? positionDefinitions[key] : undefined;
}
