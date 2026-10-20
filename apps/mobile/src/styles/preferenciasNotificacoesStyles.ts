import { StyleSheet } from 'react-native';
import { typography } from '@ludora/design-tokens';
import type { ThemeColors } from '@/src/contexts/ThemeContext';

export const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    sheet: {
      maxHeight: '90%',
      flexShrink: 1,
      backgroundColor: colors.fundo,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
      gap: 12,
    },
    titulo: {
      flex: 1,
      fontFamily: typography.fontFamily.titulo.semiBold,
      fontSize: 24,
      color: colors.texto,
    },
    fechar: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      gap: 14,
    },
    descricao: {
      fontFamily: typography.fontFamily.corpo.regular,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textoSecundario,
    },
    aviso: {
      padding: 14,
      borderRadius: 10,
      backgroundColor: colors.fundoBotao,
      color: colors.texto,
      fontFamily: typography.fontFamily.corpo.regular,
      fontSize: 13,
      lineHeight: 20,
    },
    erro: {
      fontFamily: typography.fontFamily.corpo.regular,
      fontSize: 13,
      lineHeight: 20,
      color: colors.tituloErro,
    },
    loading: {
      paddingVertical: 24,
      gap: 12,
      alignItems: 'center',
    },
    retry: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    link: {
      fontFamily: typography.fontFamily.corpo.semiBold,
      color: colors.primaria,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 10,
      overflow: 'hidden',
    },
    clube: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      gap: 12,
    },
    identidade: {
      flex: 1,
      gap: 3,
    },
    nome: {
      fontFamily: typography.fontFamily.corpo.semiBold,
      fontSize: 16,
      color: colors.texto,
    },
    label: {
      fontFamily: typography.fontFamily.corpo.medium,
      fontSize: 14,
      color: colors.texto,
    },
    opcao: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      paddingVertical: 14,
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borda,
    },
  });
