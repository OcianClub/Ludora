import { StyleSheet } from 'react-native';
import { typography } from '@ludora/design-tokens';
import type { ThemeColors } from '@/src/contexts/ThemeContext';

export const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    barra: {
      backgroundColor: colors.fundo,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borda,
      paddingHorizontal: 12,
      paddingTop: 0,
      elevation: 0,
      shadowOpacity: 0,
    },
    item: {
      marginHorizontal: 4,
      paddingTop: 0,
      paddingBottom: 3,
    },
    areaIcone: {
      height: 30,
    },
    icone: {
      width: 44,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
    },
    iconeSelecionado: {
      backgroundColor: colors.fundoBotao,
    },
    label: {
      fontFamily: typography.fontFamily.corpo.medium,
      fontSize: 12,
      lineHeight: 17,
      includeFontPadding: false,
      textAlign: 'center',
    },
    labelSelecionado: {
      fontFamily: typography.fontFamily.corpo.semiBold,
    },
  });
