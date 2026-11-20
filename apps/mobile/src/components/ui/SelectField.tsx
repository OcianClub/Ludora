import { radius, spacing, touchTarget } from "@ludora/design-tokens";
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '@ludora/icons';
import { useTheme } from '../../contexts/ThemeContext';
import { AppSheet } from './AppSheet';
import { RadioOption } from './RadioOption';
export function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const { colors: c } = useTheme();
  const [open, setOpen] = useState(false);
  return <View style={{ gap: spacing.sm }}><Text style={{ color: c.texto, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${options.find(o => o.value === value)?.label || 'Selecione'}`} accessibilityState={{ expanded: open }} onPress={() => setOpen(true)}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: touchTarget, paddingHorizontal: spacing.md, borderRadius: radius.control, borderWidth: 1, borderColor: open ? c.primaria : c.borda, backgroundColor: open || pressed ? c.superficieNeutra : c.card })}>
      <Text numberOfLines={1} style={{ flex: 1, color: c.texto, fontFamily: 'Inter_400Regular', fontSize: 13 }}>{options.find(o => o.value === value)?.label || 'Selecione'}</Text><Icon name="chevron-down" size={16} color={c.textoSecundario} />
    </Pressable>
    {open && <AppSheet title={label} onClose={() => setOpen(false)} contentStyle={{ gap: spacing.xs }}>{options.map(o => <RadioOption key={o.value} label={o.label} selected={value === o.value} onPress={() => { onChange(o.value); setOpen(false); }} />)}</AppSheet>}
  </View>;
}
