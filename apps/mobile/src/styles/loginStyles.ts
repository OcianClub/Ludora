import { StyleSheet } from 'react-native';
import { colors, typography } from '@ludora/design-tokens';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.fundo,
    justifyContent: 'flex-start',
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
    gap: 16, 
  },
  spacer: {
    flex: 1,
  },
  footer: {
    width: '100%',
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
  olho: {
    padding: 6,
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
    color: colors.tituloErro,
    fontSize: 13,
    flex: 1,
  },

  // ── Botões e Rodapé ──
  btnEntrar: {
    backgroundColor: colors.primaria,
    borderRadius: 10,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  btnEntrarDisabled: {
    opacity: 0.5,
  },
  txtBtnEntrar: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: '#FFF',
    fontSize: 14,
  },
  linhaCadastro: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  textoCinza: {
    fontFamily: typography.fontFamily.corpo.regular,
    color: colors.textoSecundario,
    fontSize: typography.fontSize.sm,
  },
  textoAzul: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.primaria,
    fontSize: typography.fontSize.sm,
  },
});