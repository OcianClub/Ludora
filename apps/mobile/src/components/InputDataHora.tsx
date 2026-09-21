import { Icon } from '@ludora/icons';
import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { colors } from '@ludora/design-tokens';
import { styles } from '../styles/inputDataHoraStyles';

interface InputDataHoraProps {
  data: string;
  horario: string;
  onChangeData: (texto: string) => void;
  onChangeHorario: (texto: string) => void;
}

export default function InputDataHora({ data, horario, onChangeData, onChangeHorario }: InputDataHoraProps) {
  return (
    <View style={styles.rowDuplo}>
      <View style={styles.halfBlock}>
        <Text style={styles.label}>DATA</Text>
        <View style={styles.inputRow}>
          <Icon name="calendar-outline" size={17} color={colors.textoSecundario} />
          <TextInput 
            style={styles.inputText} 
            value={data} 
            onChangeText={onChangeData} 
            placeholder="DD/MM" 
            placeholderTextColor={colors.textoSecundario} 
            keyboardType="numeric" 
            maxLength={5} 
          />
        </View>
      </View>
      
      <View style={styles.halfBlock}>
        <Text style={styles.label}>HORÁRIO</Text>
        <View style={styles.inputRow}>
          <Icon name="clock-outline" size={17} color={colors.textoSecundario} />
          <TextInput 
            style={styles.inputText} 
            value={horario} 
            onChangeText={onChangeHorario} 
            placeholder="00:00" 
            placeholderTextColor={colors.textoSecundario} 
            keyboardType="numeric" 
            maxLength={5} 
          />
        </View>
      </View>
    </View>
  );
}