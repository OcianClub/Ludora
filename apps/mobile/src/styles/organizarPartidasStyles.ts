import { StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';

const MARGEM = 20;

export const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: MARGEM,
    paddingTop: 6,
    paddingBottom: 40,
  },

  sectionLabel: {
    fontFamily: 'Creato-Bold',
    color: colors.azulClaro,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 24,
  },

  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  dropdownText: {
    flex: 1,
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 14,
  },

  tipoSwitchContainer: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 12,
  },
  tipoSwitchBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 9,
  },
  tipoSwitchBtnAtivo: {
    backgroundColor: colors.primary + '22',
  },
  tipoSwitchTxt: {
    fontFamily: 'Creato-Bold',
    color: colors.text_secondary,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  tipoSwitchTxtAtivo: {
    color: colors.primary,
  },

  pillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
    gap: 10,
    paddingVertical: 4,
  },
  pill: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    fontFamily: 'Creato-Bold',
    color: colors.text_secondary,
    fontSize: 13,
  },
  pillTextActive: {
    color: colors.text,
  },

  confrontoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    minHeight: 140,
    justifyContent: 'center',
  },
  timeCardSelecionado: {
    borderColor: colors.azulClaro,
    backgroundColor: '#0e78ff10',
  },
  addIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary + '40',
    borderStyle: 'dashed',
  },
  timeCardLabel: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 11,
    letterSpacing: 1,
  },
  timeCardSub: {
    fontFamily: 'Creato-Regular',
    color: colors.text_secondary,
    fontSize: 11,
    textAlign: 'center',
  },
  timeCardNome: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 12,
    textAlign: 'center',
  },
  vsBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    marginHorizontal: -8,
  },
  vsText: {
    fontFamily: 'Creato-Bold',
    color: '#FFF',
    fontSize: 13,
    letterSpacing: 1,
  },

  mandoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  mandoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  mandoBtnAtivo: {
    backgroundColor: colors.primary + '18',
    borderColor: colors.primary + '55',
  },
  mandoTxt: {
    fontFamily: 'Creato-Bold',
    fontSize: 12,
    color: colors.text_secondary,
    letterSpacing: 0.8,
  },
  mandoTxtAtivo: {
    color: colors.primary,
  },

  rowDuplo: {
    flexDirection: 'row',
    gap: 14,
  },
  halfBlock: {
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  inputText: {
    fontFamily: 'Creato-Regular',
    color: colors.text,
    fontSize: 14,
    flex: 1,
  },
  explorarText: {
    fontFamily: 'Creato-Bold',
    color: colors.azulClaro,
    fontSize: 12,
    letterSpacing: 0.8,
  },

  escalacaoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  escalacaoBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  escalacaoBtnLabel: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 14,
  },
  escalacaoBtnBadge: {
    backgroundColor: colors.primary + '33',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  escalacaoBtnBadgeText: {
    fontFamily: 'Creato-Bold',
    color: colors.primary,
    fontSize: 10,
  },

  salvarBtn: {
    marginTop: 32,
    borderRadius: 14,
    overflow: 'hidden',
  },
  salvarGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  salvarBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  salvarText: {
    fontFamily: 'Creato-Bold',
    color: '#FFF',
    fontSize: 15,
    letterSpacing: 1.2,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: MARGEM,
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    gap: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 16,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  modalItemActive: {
    backgroundColor: '#0e78ff18',
  },
  modalItemText: {
    fontFamily: 'Creato-Regular',
    color: colors.text_secondary,
    fontSize: 14,
  },
  modalItemTextActive: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
  },

  escalacaoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: MARGEM,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
    gap: 12,
  },
  escalacaoModalTitle: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 16,
    letterSpacing: 1,
    flex: 1,
  },
  escalacaoModalSubtitle: {
    fontFamily: 'Creato-Regular',
    color: colors.text_secondary,
    fontSize: 12,
  },
  escalacaoModalDica: {
    fontFamily: 'Creato-Regular',
    color: colors.text_secondary,
    fontSize: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  escalacaoModalVazio: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  escalacaoModalVazioTitulo: {
    fontFamily: 'Creato-Bold',
    color: colors.text_secondary,
    fontSize: 14,
    textAlign: 'center',
  },
  escalacaoModalVazioSub: {
    fontFamily: 'Creato-Regular',
    color: '#444',
    fontSize: 12,
    textAlign: 'center',
  },

  jogadorSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: '#252525',
  },
  jogadorSelectRowActive: {
    borderColor: colors.primary + '88',
    backgroundColor: colors.primary + '12',
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  jogadorNumero: {
    width: 30,
    height: 30,
    borderRadius: 7,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jogadorNumeroText: {
    fontFamily: 'Creato-Bold',
    color: '#fff',
    fontSize: 12,
  },
  jogadorSelectNome: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 13,
    flex: 1,
  },
  jogadorSelectPos: {
    fontFamily: 'Creato-Regular',
    color: colors.text_secondary,
    fontSize: 11,
  },
  titularBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  titularBtnAtivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  titularBtnInativo: {
    backgroundColor: '#2a2a2a',
    borderColor: '#333',
  },
  titularBtnText: {
    fontFamily: 'Creato-Bold',
    fontSize: 11,
  },
  titularBtnTextAtivo: {
    color: '#fff',
  },
  titularBtnTextInativo: {
    color: colors.text_secondary,
  },

  applyEscalacaoBtn: {
    backgroundColor: colors.primary,
    margin: MARGEM,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  applyEscalacaoBtnDisabled: {
    opacity: 0.5,
  },
  applyEscalacaoBtnText: {
    fontFamily: 'Creato-Bold',
    color: '#fff',
    fontSize: 14,
    letterSpacing: 0.8,
  },

  escudoPlaceholder: {
    backgroundColor: '#1e1e1e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  escudoPlaceholderText: {
    fontFamily: 'Creato-Bold',
    color: colors.text_secondary,
  },
});