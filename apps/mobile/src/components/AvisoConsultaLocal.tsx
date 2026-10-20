import { useMemo } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '@ludora/icons';
import { useTheme } from '../contexts/ThemeContext';
import { createStyles } from '../styles/avisoConsultaLocalStyles';

export function AvisoConsultaLocal({
  salvoEm,
  atualizando,
  onAtualizar,
}: {
  salvoEm: number;
  atualizando: boolean;
  onAtualizar: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const data = new Date(salvoEm).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      {atualizando ? (
        <ActivityIndicator size="small" color={colors.primaria} />
      ) : (
        <Icon name="wifi-off" size={19} color={colors.primaria} />
      )}
      <View style={styles.content}>
        <Text style={styles.title}>Exibindo cópia local</Text>
        <Text style={styles.description}>
          {atualizando
            ? 'Buscando dados atuais…'
            : 'Sem atualização do servidor.'}{' '}
          Consulta de {data}. Somente leitura.
        </Text>
      </View>
      <TouchableOpacity
        style={styles.button}
        disabled={atualizando}
        onPress={onAtualizar}
        accessibilityRole="button"
        accessibilityLabel="Atualizar os dados salvos"
        accessibilityState={{ disabled: atualizando }}
      >
        <Text style={styles.buttonText}>Atualizar</Text>
      </TouchableOpacity>
    </View>
  );
}
