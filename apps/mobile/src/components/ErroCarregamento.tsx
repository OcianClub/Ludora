import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Icon } from '@ludora/icons';
import { typography } from '@ludora/design-tokens';
import { useTheme } from '@/src/contexts/ThemeContext';

type Props = {
  titulo?: string;
  descricao?: string;
  onTentarNovamente: () => void;
  compacto?: boolean;
};

/** Feedback amigável para falhas de rede/carregamento.
 * Não expõe mensagens técnicas da API ao usuário e mantém uma saída clara.
 */
export function ErroCarregamento({
  titulo = 'Não foi possível carregar agora',
  descricao = 'Confira sua conexão e tente novamente.',
  onTentarNovamente,
  compacto = false,
}: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={[styles.container, compacto && styles.compacto]} accessibilityRole="alert">
      <View style={styles.iconWrap}>
        <Icon name="wifi-off" size={compacto ? 18 : 22} color={colors.tituloErro} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{titulo}</Text>
        <Text style={styles.description}>{descricao}</Text>
        <TouchableOpacity
          onPress={onTentarNovamente}
          style={styles.retry}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Tentar carregar novamente"
        >
          <Text style={styles.retryText}>Tentar novamente</Text>
          <Icon name="arrow-right" size={16} color={colors.tituloErro} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      gap: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.bordaErro,
      backgroundColor: colors.fundoErro,
      borderRadius: 10,
    },
    compacto: { paddingVertical: 12 },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
    },
    content: { flex: 1, gap: 3 },
    title: {
      color: colors.tituloErro,
      fontFamily: typography.fontFamily.corpo.semiBold,
      fontSize: 14,
    },
    description: {
      color: colors.corpoErro,
      fontFamily: typography.fontFamily.corpo.regular,
      fontSize: 13,
      lineHeight: 18,
    },
    retry: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingTop: 7,
      paddingBottom: 1,
    },
    retryText: {
      color: colors.tituloErro,
      fontFamily: typography.fontFamily.corpo.semiBold,
      fontSize: 13,
    },
  });
}
