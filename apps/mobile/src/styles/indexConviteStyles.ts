import { StyleSheet } from 'react-native';
import { colors, typography } from '@ludora/design-tokens';


export const styles = StyleSheet.create({
container: {
  flex: 1,
  backgroundColor: colors.fundo,
},
header: {
  paddingHorizontal: 24,
  paddingVertical: 12,
  alignItems: 'flex-start',
},
btnVoltar: {
  width: 42,
  height: 42,
  borderRadius: 10,
  backgroundColor: colors.card,
  alignItems: 'center',
  justifyContent: 'center',
},
content: {
  flex: 1,
  paddingHorizontal: 24,
  justifyContent: 'center',
  gap: 40,
},
  title: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.texto,
    fontSize: typography.fontSize.xxl
  },
  subtitle: {
    fontFamily: typography.fontFamily.corpo.regular,
    color: colors.textoSecundario,
    fontSize: typography.fontSize.md
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    height: 54,
    color: colors.texto,
    paddingRight: 56,
  },
  inputRow: {
    position: 'relative'
  },
  iconColar: {
    padding: 6,
    position: 'absolute',
    top: 10,
    right: 10,
  },
    rodape: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    alignItems: 'center',
    gap: 18,
    marginBottom: 10
  },
  btnContinuar: {
    backgroundColor: colors.primaria,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    width: '100%'
  },
  txtBtn: {
    fontSize: 14,
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.texto
  },
  semConviteTxt: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.primaria
  }
});
