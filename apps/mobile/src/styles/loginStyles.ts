import { StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';

export const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 60,
  },

  btnVoltar: {
    position: 'absolute',
    top: 56,
    left: 20,
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  logoContainer: {
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: colors.primary + '18',
    borderWidth: 1.5,
    borderColor: colors.primary + '50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  titulo: {
    fontFamily: 'Creato-Bold',
    fontSize: 26,
    color: colors.text,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  subtitulo: {
    fontFamily: 'Creato-Regular',
    fontSize: 14,
    color: colors.text_secondary,
    marginBottom: 32,
    textAlign: 'center',
  },

  form: {
    width: '100%',
    gap: 12,
  },

  inputLabel: {
    fontFamily: 'Creato-Bold',
    fontSize: 10,
    color: colors.text_secondary,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    gap: 12,
  },
  inputRowFocado: {
    borderColor: colors.primary + '80',
    backgroundColor: colors.primary + '08',
  },
  inputRowErro: {
    borderColor: colors.vermelho + '60',
  },
  input: {
    flex: 1,
    fontFamily: 'Creato-Regular',
    color: colors.text,
    fontSize: 15,
  },

  requisitos: {
    gap: 4,
    paddingHorizontal: 4,
  },
  requisitoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  requisitoTxt: {
    fontFamily: 'Creato-Regular',
    fontSize: 11,
    color: '#444',
  },
  requisitoOk: {
    color: '#22c55e',
  },

  btnEntrar: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  btnEntrarDisabled: {
    opacity: 0.5,
  },
  txtBtnEntrar: {
    fontFamily: 'Creato-Bold',
    color: '#FFF',
    fontSize: 14,
    letterSpacing: 1.2,
  },

  btnCadastro: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  txtCadastro: {
    fontFamily: 'Creato-Regular',
    color: colors.text_secondary,
    fontSize: 14,
  },
  txtCadastroDestaque: {
    fontFamily: 'Creato-Bold',
    color: colors.azulClaro,
  },

  erroContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.vermelho + '15',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.vermelho + '40',
  },
  erroTxt: {
    fontFamily: 'Creato-Bold',
    color: colors.vermelho,
    fontSize: 13,
    flex: 1,
  },
});