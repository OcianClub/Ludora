import { Text, View, type StyleProp, type TextStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { getPositionDefinition, positionStrokeWidth } from '@ludora/design-tokens';
import { useTheme } from '@/src/contexts/ThemeContext';

export function PositionIcon({ position, decorative = false }: { position: string; decorative?: boolean }) {
  const { colors } = useTheme();
  const definition = getPositionDefinition(position);
  if (!definition) return null;
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={colors[definition.color]}
    strokeWidth={positionStrokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}
    accessible={!decorative} accessibilityRole="image" accessibilityLabel={definition.label}>
    {definition.paths.map((path, index) => <Path key={index} d={path.d}/>)}
  </Svg>;
}
export function PositionLabel({ position, textStyle, suffix = '' }: { position: string; textStyle?: StyleProp<TextStyle>; suffix?: string }) {
  const label = getPositionDefinition(position)?.label || position || 'Posição não informada';
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 }} accessible accessibilityLabel={`${label}${suffix}`}>
    <PositionIcon position={position} decorative/><Text style={[{ flexShrink: 1 }, textStyle]}>{label}{suffix}</Text>
  </View>;
}
