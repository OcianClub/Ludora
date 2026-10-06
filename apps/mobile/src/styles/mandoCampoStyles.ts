import { StyleSheet } from 'react-native';
import { typography } from '@ludora/design-tokens';
import type { ThemeColors } from '@/src/contexts/ThemeContext';

export const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardClaro,
    backgroundColor: colors.card,
  },
  btnAtivo: {
    borderColor: colors.primaria,
    backgroundColor: colors.fundoBotao,
  },
  txt: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.textoSecundario,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  txtAtivo: {
    color: colors.primaria,
  }
});
