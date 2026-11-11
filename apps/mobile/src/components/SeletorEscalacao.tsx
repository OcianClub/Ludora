import { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '@ludora/icons';
import type { EquipePartida } from '../services/partidasCompartilhadas';
import { useTheme } from '../contexts/ThemeContext';

export const SeletorEscalacao = memo(function SeletorEscalacao({ equipes, timeSelecionado, onSelecionar }: {
  equipes: EquipePartida[];
  timeSelecionado?: number;
  onSelecionar: (timeId: number) => void;
}) {
  const { colors } = useTheme();
  if (equipes.length < 2) return null;
  return <View style={[styles.container, { backgroundColor: colors.card }]} accessibilityRole="tablist" accessibilityLabel="Escalações das equipes">
    {equipes.map((equipe) => {
      const selected = equipe.time_id === timeSelecionado;
      const color = selected ? colors.texto : colors.textoSecundario;
      return <TouchableOpacity key={equipe.time_id} accessibilityRole="tab" accessibilityLabel={`Escalação do ${equipe.clube.nome}`}
        accessibilityState={{ selected }} onPress={() => onSelecionar(equipe.time_id)} activeOpacity={0.8}
        style={[styles.option, { backgroundColor: selected ? colors.cardSecundario : 'transparent' }]}>
        <Icon name="group" size={17} color={color} />
        <Text style={[styles.label, { color }]} numberOfLines={1}>{equipe.clube.nome}</Text>
      </TouchableOpacity>;
    })}
  </View>;
});

const styles = StyleSheet.create({
  container: { width: '100%', alignSelf: 'stretch', flexDirection: 'row', padding: 4, gap: 4, borderRadius: 8 },
  option: { flex: 1, minWidth: 0, minHeight: 40, paddingHorizontal: 9, paddingVertical: 9, borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  label: { flexShrink: 1, fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 18 },
});
