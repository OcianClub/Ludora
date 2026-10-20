import { StyleSheet } from 'react-native';
import { typography } from '@ludora/design-tokens';
import type { ThemeColors } from '../contexts/ThemeContext';

export const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 20,
      marginBottom: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.fundoBotao,
      borderWidth: 1,
      borderColor: colors.bordaBotao,
    },
    content: { flex: 1, gap: 3 },
    title: {
      color: colors.texto,
      fontFamily: typography.fontFamily.corpo.semiBold,
      fontSize: 12,
    },
    description: {
      color: colors.textoSecundario,
      fontFamily: typography.fontFamily.corpo.regular,
      fontSize: 11,
      lineHeight: 16,
    },
    button: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    buttonText: {
      color: colors.primaria,
      fontFamily: typography.fontFamily.corpo.semiBold,
      fontSize: 12,
    },
  });
