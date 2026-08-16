import { StyleSheet } from 'react-native';
import { colors, typography } from '@ludora/design-tokens';

export const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: colors.fundo,
  },
  container: {
    flex: 1,
    backgroundColor: colors.fundo,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 40,
  },

  // ── Botão Voltar ──
  btnVoltar: {
    position: 'absolute',
    top: 56,
    left: 20,
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  // ── Cabeçalho e Títulos ──
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  logoContainer: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  titulo: {
    fontFamily: typography.fontFamily.titulo.bold,
    fontSize: 26,
    color: colors.texto,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  subtitulo: {
    fontFamily: typography.fontFamily.corpo.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textoSecundario,
    textAlign: 'center',
    lineHeight: typography.lineHeight.normal * typography.fontSize.sm,
  },

  // ── Formulário e Inputs ──
  form: {
    width: '100%',
    gap: 16, // Espaçamento entre os inputs
  },
  inputLabel: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: 10,
    color: colors.textoSecundario,
    letterSpacing: 1.2,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.borda,
    gap: 12,
  },
  inputRowFocado: {
    borderColor: colors.primaria + '80',
    backgroundColor: colors.primaria + '08',
  },
  inputRowErro: {
    borderColor: colors.vermelho + '60',
  },
  olho: {
    padding: 6
  },
  input: {
    flex: 1,
    fontFamily: typography.fontFamily.corpo.regular,
    color: colors.texto,
    fontSize: 15,
  },

  // ── Alertas de Erro ──
  erroContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.fundoErro,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.bordaErro,
  },
  erroTxt: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.corpoErro,
    fontSize: 13,
    flex: 1,
  },

  // ── Botões Principais e Rodapé ──
  bottomSection: {
    marginTop: 32,
    width: '100%',
  },
  btnContinuar: {
    backgroundColor: colors.primaria,
    borderRadius: 10,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 24,
  },
  btnContinuarDisabled: {
    opacity: 0.5,
  },
  txtBtnContinuar: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: '#FFF',
    fontSize: 14,
    letterSpacing: 1.2,
  },
  rodape: {
    alignItems: 'center',
  },
  linhaSeparadora: {
    height: 1,
    backgroundColor: colors.linha,
    width: '100%',
    marginBottom: 20,
  },
  linhaRodape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoCinzaRodape: {
    color: colors.textoSecundario,
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.corpo.regular,
  },
  textoAzulRodape: {
    color: colors.primaria,
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.corpo.medium,
  },
});