import { StyleSheet } from 'react-native';
import { typography } from '@ludora/design-tokens';
import type { ThemeColors } from '@/src/contexts/ThemeContext';

export const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      marginHorizontal: 20,
      marginTop: 20,
      marginBottom: 24,
      gap: 14,
    },
    titulo: {
      fontFamily: typography.fontFamily.titulo.semiBold,
      fontSize: 23,
      color: colors.texto,
    },
    subtitulo: {
      fontFamily: typography.fontFamily.corpo.semiBold,
      fontSize: 14,
      color: colors.texto,
    },
    resultado: {
      backgroundColor: colors.fundoBotao,
      borderRadius: 10,
      padding: 16,
      gap: 7,
    },
    resultadoTexto: {
      fontFamily: typography.fontFamily.corpo.semiBold,
      fontSize: 14,
      color: colors.primaria,
    },
    placar: {
      fontFamily: typography.fontFamily.titulo.semiBold,
      fontSize: 22,
      color: colors.texto,
    },
    descricao: {
      fontFamily: typography.fontFamily.corpo.regular,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textoSecundario,
    },
    metricas: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    metrica: {
      flex: 1,
      minWidth: 85,
      backgroundColor: colors.card,
      padding: 12,
      borderRadius: 10,
      gap: 4,
    },
    numero: {
      fontFamily: typography.fontFamily.titulo.semiBold,
      fontSize: 26,
      color: colors.texto,
    },
    destaque: {
      padding: 14,
      borderRadius: 10,
      backgroundColor: colors.card,
      gap: 5,
    },
    label: {
      fontFamily: typography.fontFamily.corpo.medium,
      fontSize: 13,
      color: colors.texto,
    },
    nomes: {
      fontFamily: typography.fontFamily.corpo.semiBold,
      fontSize: 15,
      color: colors.primaria,
    },
    preferencia: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
    },
    flex: {
      flex: 1,
      gap: 4,
    },
    botao: {
      backgroundColor: colors.primaria,
      borderRadius: 10,
      padding: 14,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    botaoTexto: {
      fontFamily: typography.fontFamily.corpo.semiBold,
      fontSize: 14,
      color: colors.textoSobrePrimaria,
    },
    rodape: {
      fontFamily: typography.fontFamily.corpo.regular,
      fontSize: 11,
      lineHeight: 16,
      color: colors.textoSecundario,
      textAlign: 'center',
    },
    aviso: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 10,
      gap: 12,
    },
    avisoTexto: {
      backgroundColor: colors.fundoAtencao,
      color: colors.corpoAtencao,
      fontFamily: typography.fontFamily.corpo.regular,
      fontSize: 13,
      lineHeight: 19,
      padding: 14,
      borderRadius: 10,
    },
    botaoSecundario: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    link: {
      color: colors.primaria,
      fontFamily: typography.fontFamily.corpo.semiBold,
    },
    desabilitado: {
      opacity: 0.6,
    },
  });
