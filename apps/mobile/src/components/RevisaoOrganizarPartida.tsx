import { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@ludora/icons';
import { useTheme } from '@/src/contexts/ThemeContext';
import { createStyles } from '@/src/styles/organizarPartidasStyles';
import type { RevisaoPartida } from '@/src/utils/organizarPartida';
import { PainelOrganizarPartida } from './PainelOrganizarPartida';

type Props = {
  revisao: RevisaoPartida;
  salvando: boolean;
  erro: string;
  onConfirmar: () => void;
  onFechar: () => void;
};

export function RevisaoOrganizarPartida({
  revisao,
  salvando,
  erro,
  onConfirmar,
  onFechar,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const linhas = [
    ['Clube', revisao.clubeNome],
    ['Competição', revisao.competicao],
    ['Mandante', revisao.mandante],
    ['Visitante', revisao.visitante],
    ['Data', revisao.dataTexto],
    ['Horário', revisao.dados.horario],
    ['Mando', revisao.dados.emCasa ? 'Em casa' : 'Fora'],
    ['Local', revisao.dados.local],
  ];

  return (
    <PainelOrganizarPartida
      titulo="Revisar partida"
      subtitulo="Confira principalmente a categoria antes de confirmar."
      onFechar={onFechar}
      bloqueado={salvando}
    >
      <ScrollView
        style={styles.selectorList}
        contentContainerStyle={styles.reviewContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.reviewCategory}>
          <Text style={styles.reviewCategoryLabel}>Categoria da partida</Text>
          <Text style={styles.reviewCategoryName}>{revisao.categoria.nome}</Text>
          <Text style={styles.reviewCategoryLabel}>
            {revisao.categoria.tipo === 'INICIACAO' ? 'Iniciação' : 'Base'}
          </Text>
        </View>
        {linhas.map(([titulo, valor]) => (
          <View key={titulo} style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>{titulo}</Text>
            <Text style={styles.reviewValue}>{valor}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.reviewActions}>
        {!!erro && (
          <Text style={styles.fieldError} accessibilityRole="alert">
            {erro}
          </Text>
        )}
        <TouchableOpacity
          style={[styles.saveButton, salvando && styles.disabled]}
          onPress={onConfirmar}
          disabled={salvando}
          accessibilityRole="button"
          accessibilityState={{ disabled: salvando, busy: salvando }}
        >
          {salvando ? (
            <ActivityIndicator size="small" color={colors.textoSobrePrimaria} />
          ) : (
            <Icon name="check" size={19} color={colors.textoSobrePrimaria} />
          )}
          <Text style={styles.saveText}>
            {salvando ? 'Criando partida…' : 'Confirmar e criar'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.reviewEditButton}
          onPress={onFechar}
          disabled={salvando}
          accessibilityRole="button"
          accessibilityState={{ disabled: salvando }}
        >
          <Text style={styles.reviewEditText}>Voltar e editar</Text>
        </TouchableOpacity>
      </View>
    </PainelOrganizarPartida>
  );
}
