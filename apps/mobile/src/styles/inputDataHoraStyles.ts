import { StyleSheet } from 'react-native';
import { colors, typography } from '@ludora/design-tokens';

export const styles = StyleSheet.create({
  rowDuplo: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  halfBlock: {
    flex: 1,
  },
  label: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.textoSecundario,
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardClaro,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 8,
  },
  inputText: {
    flex: 1,
    fontFamily: typography.fontFamily.corpo.regular,
    color: colors.texto,
    fontSize: 14,
  }
});