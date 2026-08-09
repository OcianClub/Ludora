import { StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';

const MARGEM = 20;

export const styles = StyleSheet.create({

  // ── Layout base ──────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: MARGEM,
  },

  // ── Labels de seção ───────────────────────────────────────
  sectionLabel: {
    fontFamily: 'Creato-Bold',
    color: colors.azulClaro,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 24,
  },

  // ── Banner de edição ──────────────────────────────────────
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.amarelo + '15',
    borderBottomWidth: 1,
    borderBottomColor: colors.amarelo + '25',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  editBannerTxt: {
    fontFamily: 'Creato-Bold',
    color: colors.amarelo,
    fontSize: 11,
    letterSpacing: 0.5,
  },

  // ── Loading ───────────────────────────────────────────────
  loadingTxt: {
    fontFamily: 'Creato-Bold',
    color: colors.text_secondary,
    fontSize: 13,
  },

  // ── Categoria bloqueada (modo edição) ─────────────────────
  categoriaLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderStyle: 'dashed',
  },
  categoriaLockedNome: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 14,
    flex: 1,
  },
  categoriaLockedSub: {
    fontFamily: 'Creato-Bold',
    color: '#2a2a2a',
    fontSize: 10,
    letterSpacing: 0.5,
  },

  // ── Pills de categoria ────────────────────────────────────
  pillRow: {
    gap: 10,
    paddingVertical: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  pillActive: {
    backgroundColor: colors.primary + '18',
    borderColor: colors.primary + '60',
  },
  pillText: {
    fontFamily: 'Creato-Bold',
    fontSize: 13,
    color: colors.text_secondary,
  },
  pillTextActive: {
    color: colors.primary,
  },

  // ── Confronto ─────────────────────────────────────────────
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
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCircle: {
    backgroundColor: colors.primary + '15',
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
  trocarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  trocarTxt: {
    fontFamily: 'Creato-Bold',
    color: colors.azulClaro,
    fontSize: 9,
    letterSpacing: 0.8,
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

  // ── Mando de campo ────────────────────────────────────────
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

  // ── Stepper de rodada ─────────────────────────────────────
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
    height: 50,
    alignSelf: 'flex-start',
    width: 148,
  },
  stepperBtn: {
    width: 44,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222',
  },
  stepperBtnAtivo: {
    backgroundColor: colors.primary + '22',
  },
  stepperBtnDisabled: {
    opacity: 0.3,
  },
  stepperDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#2a2a2a',
  },
  stepperValue: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueTxt: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 18,
    letterSpacing: 0.5,
  },
  stepperValueZero: {
    color: '#333',
  },

  // ── Grupo pills (melhorado) ───────────────────────────────
  grupoPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  grupoPillAtivo: {
    backgroundColor: colors.primary + '22',
    borderColor: colors.primary + '88',
  },
  grupoPillTxt: {
    fontFamily: 'Creato-Bold',
    color: colors.text_secondary,
    fontSize: 14,
    letterSpacing: 1,
  },
  grupoPillTxtAtivo: {
    color: colors.primary,
  },

  // ── Inputs ────────────────────────────────────────────────
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

  // ── Resumo pré-salvar ─────────────────────────────────────
  resumoCard: {
    backgroundColor: '#6FCF97' + '0d',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#6FCF97' + '30',
    gap: 6,
    marginTop: 20,
  },
  resumoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resumoTxt: {
    fontFamily: 'Creato-Bold',
    color: colors.text_secondary,
    fontSize: 12,
    flex: 1,
  },

  // ── Botão salvar ──────────────────────────────────────────
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
  salvarText: {
    fontFamily: 'Creato-Bold',
    color: '#FFF',
    fontSize: 15,
    letterSpacing: 1.2,
  },

  // ── Modal ─────────────────────────────────────────────────
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
  handle: {
    alignItems: 'center',
    paddingBottom: 12,
  },
  handleBar: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#2a2a2a',
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
  modalSub: {
    fontFamily: 'Creato-Bold',
    color: colors.text_secondary,
    fontSize: 11,
    letterSpacing: 0.5,
    marginTop: 2,
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
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: colors.primary + '22',
    borderWidth: 1,
    borderColor: colors.primary + '55',
    alignItems: 'center',
    justifyContent: 'center',
  },
});