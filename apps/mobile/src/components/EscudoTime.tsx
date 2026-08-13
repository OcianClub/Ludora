import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, typography } from '@ludora/design-tokens';

interface EscudoTimeProps {
  escudo: string | null;
  nome: string;
  size?: number;
}

export default function EscudoTime({ escudo, nome, size = 48 }: EscudoTimeProps) {
  if (escudo) {
    return (
      <Image
        source={{ uri: escudo }}
        style={{ width: size, height: size, resizeMode: 'contain', borderRadius: size * 0.2 }}
      />
    );
  }
  
  return (
    <View style={[styles.placeholder, { width: size, height: size, borderRadius: size * 0.25 }]}>
      <Text style={[styles.placeholderText, { fontSize: size * 0.28 }]}>
        {nome.split(' ').map(p => p[0]).join('').slice(0, 3).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.cardSecundario,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borda,
  },
  placeholderText: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.textoSecundario,
  }
});