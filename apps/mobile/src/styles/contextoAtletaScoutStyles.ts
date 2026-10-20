import { StyleSheet } from 'react-native';
import { typography } from '@ludora/design-tokens';
import type { ThemeColors } from '@/src/contexts/ThemeContext';

export const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      gap: 12,
      marginBottom: 24,
    },
    titulo: {
      fontFamily: typography.fontFamily.titulo.semiBold,
      fontSize: 22,
      color: colors.texto,
    },
    subtitulo: {
      fontFamily: typography.fontFamily.corpo.semiBold,
      fontSize: 14,
      color: colors.texto,
    },
    descricao: {
      fontFamily: typography.fontFamily.corpo.regular,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textoSecundario,
    },
    label: {
      fontFamily: typography.fontFamily.corpo.medium,
      fontSize: 13,
      color: colors.texto,
    },
    base: {
      flexDirection: 'row',
      gap: 10,
      padding: 14,
      borderRadius: 10,
      backgroundColor: colors.fundoBotao,
    },
    flex: {
      flex: 1,
      gap: 4,
    },
    medias: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    media: {
      flex: 1,
      minWidth: 88,
      gap: 5,
      padding: 12,
      borderRadius: 10,
      backgroundColor: colors.card,
    },
    valor: {
      fontFamily: typography.fontFamily.titulo.semiBold,
      fontSize: 26,
      color: colors.primaria,
    },
    cabecalho: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      gap: 4,
    },
    coluna: {
      width: 30,
      textAlign: 'center',
      color: colors.texto,
      fontFamily: typography.fontFamily.corpo.medium,
      fontSize: 13,
    },
    partida: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      gap: 4,
      borderRadius: 10,
      backgroundColor: colors.card,
    },
    loading: {
      minHeight: 100,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    avisoContainer: {
      padding: 14,
      borderRadius: 10,
      backgroundColor: colors.card,
      gap: 10,
    },
    aviso: {
      fontFamily: typography.fontFamily.corpo.regular,
      fontSize: 13,
      lineHeight: 20,
      color: colors.textoSecundario,
      backgroundColor: colors.card,
      borderRadius: 10,
      padding: 14,
    },
    botao: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    link: {
      fontFamily: typography.fontFamily.corpo.semiBold,
      fontSize: 13,
      color: colors.primaria,
    },
  });
