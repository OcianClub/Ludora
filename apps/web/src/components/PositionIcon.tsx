import { getPositionDefinition, positionStrokeWidth } from '../../../../packages/design-tokens/src/positions';
import { Tooltip } from './Tooltip';

export function PositionIcon({ position, tooltip = true, decorative = false }: { position: string; tooltip?: boolean; decorative?: boolean }) {
  const definition = getPositionDefinition(position);
  if (!definition) return null;
  const vector = <svg className="position-icon" data-position-icon={definition.label} width="24" height="24" viewBox="0 0 24 24"
    style={{ width: 24, height: 24, flexShrink: 0, color: `var(--${definition.color})`, verticalAlign: 'middle' }}
    role={decorative || tooltip ? undefined : 'img'} aria-label={decorative || tooltip ? undefined : definition.label} aria-hidden={decorative || tooltip || undefined}
    fill="none" stroke="currentColor" strokeWidth={positionStrokeWidth} strokeLinecap="round" strokeLinejoin="round">
    {definition.paths.map((path, index) => <path key={index} d={path.d}/>)}
  </svg>;
  return tooltip ? <Tooltip label={definition.label} position={position}>{vector}</Tooltip> : vector;
}
