// Geometry is shared by the DOM SVG and react-native-svg renderers.
// Every drawing fits the same 16 × 16 area inside a 24 × 24 viewBox.
export const positionDefinitions = {
  goalkeeper: { label: 'Goleiro', color: 'amarelo', paths: [
    { d: 'M4.5 19.5V4.5h15v15M4.5 9H8m8 0h3.5M8 17h8' },
    { d: 'M14.5 12.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM12 10v2.5l2 1' },
  ] },
  defender: { label: 'Fixo', color: 'primaria', paths: [
    { d: 'm12 4.5 7 3V12c0 3.5-3.5 6-7 7.5-3.5-1.5-7-4-7-7.5V7.5Z' },
    { d: 'M12 8v8m-3-5h6' },
  ] },
  wing: { label: 'Ala', color: 'ciano', paths: [
    { d: 'M11 17c0-5-3-5-6-11.5m0 4V5.5h4M13 17c0-5 3-5 6-11.5m-4 0h4v4' },
    { d: 'M9 19.5v-1m6 1v-1' },
  ] },
  pivot: { label: 'Pivô', color: 'laranja', paths: [
    { d: 'M18.5 12A6.5 6.5 0 1 1 12 5.5M16 4.5h3.5V8m0-3.5-5.5 5.5' },
    { d: 'M13.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z' },
  ] },
} as const;
export const positionStrokeWidth = 1.6;
export function getPositionDefinition(position: string | null | undefined) {
  const name = (position || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const key = name === 'goleiro' ? 'goalkeeper' : name === 'fixo' ? 'defender' : name.startsWith('ala') ? 'wing' : name === 'pivo' ? 'pivot' : null;
  return key ? positionDefinitions[key] : undefined;
}
