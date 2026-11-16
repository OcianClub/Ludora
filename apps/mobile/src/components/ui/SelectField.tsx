import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '@ludora/icons';
import { useTheme } from '../../contexts/ThemeContext';
import { AppSheet } from './AppSheet';
import { RadioOption } from './RadioOption';
export function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const { colors: c } = useTheme();
  const [open, setOpen] = useState(false);
  return <View style={{ gap: 8 }}><Text style={{ color: c.texto, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>{label}</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label}: ${options.find(o => o.value === value)?.label || 'Selecione'}`} accessibilityState={{ expanded: open }} onPress={() => setOpen(true)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: open ? c.primaria : c.borda, backgroundColor: c.card }}>
      <Text numberOfLines={1} style={{ flex: 1, color: c.texto, fontFamily: 'Inter_400Regular', fontSize: 13 }}>{options.find(o => o.value === value)?.label || 'Selecione'}</Text><Icon name="chevron-down" size={16} color={c.textoSecundario} />
    </TouchableOpacity>
    {open && <AppSheet title={label} onClose={() => setOpen(false)} contentStyle={{ gap: 4 }}>{options.map(o => <RadioOption key={o.value} label={o.label} selected={value === o.value} onPress={() => { onChange(o.value); setOpen(false); }} />)}</AppSheet>}
  </View>;
}
