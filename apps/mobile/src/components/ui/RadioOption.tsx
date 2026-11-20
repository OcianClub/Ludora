import { radius, spacing } from "@ludora/design-tokens";
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
export function RadioOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors: c } = useTheme();
  return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected }} aria-checked={selected} onPress={onPress}
    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, padding: spacing.md, borderRadius: radius.badge, backgroundColor: selected || pressed ? c.superficieNeutra : 'transparent' })}>
    <Text style={{ flex: 1, minWidth: 0, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, color: c.texto }}>{label}</Text>
    <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: selected ? 5 : 1, borderColor: selected ? c.primaria : c.textoSecundario, backgroundColor: c.card }} />
  </Pressable>;
}
