import { StyleSheet } from 'react-native';
import { typography } from '@ludora/design-tokens';
import type { ThemeColors } from '@/src/contexts/ThemeContext';

export const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 142,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.borda,
  },
  cardSelecionado: {
    borderColor: colors.bordaBotao,
  },
  addIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.cardSecundario,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borda,
    borderStyle: 'dashed',
  },
  label: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.textoSecundario,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 4,
  },
  nomeTime: {
    width: '100%',
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.texto,
    fontSize: 13,
    textAlign: 'center',
  },
  subTexto: {
    fontFamily: typography.fontFamily.corpo.regular,
    color: colors.textoSecundario,
    fontSize: 11,
    textAlign: 'center',
  },
  trocarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    backgroundColor: colors.cardSecundario,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  trocarTxt: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.primaria,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  escudoPlaceholder: {
    backgroundColor: colors.cardSecundario,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borda,
  },
  escudoPlaceholderText: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.textoSecundario,
  }
});
