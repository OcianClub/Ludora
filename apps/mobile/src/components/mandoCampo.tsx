import { Icon } from '@ludora/icons';
import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { createStyles } from '../styles/mandoCampoStyles';
import { useTheme } from '@/src/contexts/ThemeContext';

interface MandoCampoProps {
  emCasa: boolean;
  onChange: (emCasa: boolean) => void;
}

export default function MandoCampo({ emCasa, onChange }: MandoCampoProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const opcoes = [
    { label: 'EM CASA', icon: 'home-outline' as const, value: true },
    { label: 'FORA', icon: 'bus-side' as const, value: false }
  ];

  return (
    <View style={styles.container}>
      {opcoes.map(opt => (
        <TouchableOpacity
          key={opt.label}
          style={[styles.btn, emCasa === opt.value && styles.btnAtivo]}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.8}
        >
          <Icon
            name={opt.icon} 
            size={18} 
            color={emCasa === opt.value ? colors.primaria : colors.textoSecundario} 
          />
          <Text style={[styles.txt, emCasa === opt.value && styles.txtAtivo]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
