import React from 'react';
import { TouchableOpacity, View, Text, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@ludora/design-tokens';
import { styles } from '../styles/teamSelectorCardStyles';

interface Team {
  id: number;
  nome: string;
  escudo: string | null;
}

interface TeamSelectorCardProps {
  time: Team | null;
  tipo: 'MANDANTE' | 'VISITANTE';
  onPress: () => void;
}

// Sub-componente interno para renderizar o escudo ou as iniciais
function EscudoTime({ escudo, nome, size = 48 }: { escudo: string | null; nome: string; size?: number }) {
  if (escudo) {
    return (
      <Image
        source={{ uri: escudo }}
        style={{ width: size, height: size, resizeMode: 'contain', borderRadius: 8, marginBottom: 8 }}
      />
    );
  }
  return (
    <View style={[styles.escudoPlaceholder, { width: size, height: size, borderRadius: 8, marginBottom: 8 }]}>
      <Text style={[styles.escudoPlaceholderText, { fontSize: size * 0.28 }]}>
        {nome.split(' ').map(p => p[0]).join('').slice(0, 3).toUpperCase()}
      </Text>
    </View>
  );
}

export default function TeamSelectorCard({ time, tipo, onPress }: TeamSelectorCardProps) {
  return (
    <TouchableOpacity 
      style={[styles.card, time !== null && styles.cardSelecionado]} 
      activeOpacity={0.8} 
      onPress={onPress}
    >
      {time ? (
        <>
          <EscudoTime escudo={time.escudo} nome={time.nome} size={48} />
          <Text style={styles.label}>{tipo}</Text>
          <Text style={styles.nomeTime} numberOfLines={2}>{time.nome}</Text>
          
          <View style={styles.trocarBtn}>
            <MaterialCommunityIcons name="swap-horizontal" size={11} color={colors.primaria} />
            <Text style={styles.trocarTxt}>TROCAR</Text>
          </View>
        </>
      ) : (
        <>
          <View style={styles.addIconCircle}>
            <MaterialCommunityIcons name="plus" size={26} color={colors.primaria} />
          </View>
          <Text style={styles.label}>{tipo}</Text>
          <Text style={styles.subTexto}>Selecionar time</Text>
        </>
      )}
    </TouchableOpacity>
  );
}