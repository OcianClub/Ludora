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
    paddingTop: 8,
  },

  // ── SEGMENTED CONTROL TOPO (3 ABAS) ──
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: MARGEM,
    marginVertical: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentBtnAtivo: {
    backgroundColor: colors.cinza,
  },
  segmentTxt: {
    fontFamily: 'Creato-Bold',
    color: colors.text_secondary,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  segmentTxtAtivo: {
    color: colors.text,
  },

  // ── TOGGLE INICIAÇÃO / BASE (SÓ OCIAN) ──
  tipoSwitchContainer: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 16,
  },
  tipoSwitchBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tipoSwitchBtnAtivo: {
    backgroundColor: colors.primary + '22',
  },
  tipoSwitchTxt: {
    fontFamily: 'Creato-Bold',
    color: colors.text_secondary,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  tipoSwitchTxtAtivo: {
    color: colors.primary,
  },

  // ── BREADCRUMB E TÍTULOS (ADVERSÁRIOS) ──
  btnVoltarCategorias: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 4,
  },
  txtVoltarCategorias: {
    fontFamily: 'Creato-Bold',
    color: colors.azulClaro,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  sectionLabel: {
    fontFamily: 'Creato-Bold',
    color: colors.text_secondary,
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 12,
    marginTop: 4,
  },

  // ── PILLS (BOTÕES PARA SELECIONAR SUBS) ──
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

  // ── GRID DE CATEGORIAS (USADO NO OCIAN E ADVERSÁRIOS) ──
  gridCategorias: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardCategoriaOcian: {
    width: '48%',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    gap: 10,
  },
  iconCircleOcian: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catOcianNome: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 16,
  },
  catOcianBadgeTxt: {
    fontFamily: 'Creato-Regular',
    color: colors.text_secondary,
    fontSize: 11,
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },

  // ── LISTA DE TIMES E CAMPEONATOS ──
  buscaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  buscaInput: {
    flex: 1,
    fontFamily: 'Creato-Regular',
    color: colors.text,
    fontSize: 14,
  },
  cardLista: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  cardNome: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 15,
  },
  cardSub: {
    fontFamily: 'Creato-Regular',
    color: colors.text_secondary,
    fontSize: 12,
    marginTop: 2,
  },
  cardAcoes: {
    flexDirection: 'row',
    gap: 8,
  },
  btnAcao: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.azulClaro + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAcaoDanger: {
    backgroundColor: colors.vermelho + '18',
  },
  escudoLista: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
    borderRadius: 8,
  },
  escudoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  escudoIniciais: {
    fontFamily: 'Creato-Bold',
    color: colors.azulClaro,
    fontSize: 14,
  },

  // ── FAB E EMPTY STATES ──
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 16,
  },
  emptyText: {
    fontFamily: 'Creato-Bold',
    color: '#444',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  emptyBtnText: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 13,
  },

  // ── MODAIS GENÉRICOS ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  modalTitulo: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 17,
  },
  modalSubtitulo: {
    fontFamily: 'Creato-Regular',
    color: colors.text_secondary,
    fontSize: 13,
    marginTop: 2,
  },
  modalBotoes: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btnNao: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  txtNao: {
    fontFamily: 'Creato-Bold',
    color: colors.text_secondary,
    fontSize: 13,
  },
  btnSim: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.vermelho + '22',
    borderWidth: 1,
    borderColor: colors.vermelho,
  },
  txtSim: {
    fontFamily: 'Creato-Bold',
    color: colors.vermelho,
    fontSize: 13,
  },

  // ── WIZARD DE CAMPEONATO (UI NOVA) ──
  wizardProgress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  wizardDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#333',
  },
  wizardDotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  wizardOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#333',
    gap: 16,
  },
  wizardOptionIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wizardOptionTitle: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 16,
  },
  wizardOptionSub: {
    fontFamily: 'Creato-Regular',
    color: colors.text_secondary,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },

  // ── LISTA DE JOGADORES (ELENCO E CHECKBOX) ──
  cardJogadorModal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    padding: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    gap: 12,
  },
  jogadorCamisa: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  jogadorCamisaTxt: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 13,
  },
  jogadorNome: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 14,
  },
  jogadorPosicao: {
    fontFamily: 'Creato-Regular',
    color: colors.text_secondary,
    fontSize: 12,
  },

  // ── FORMULÁRIOS ──
  escudoPicker: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3a3a3a',
    borderStyle: 'dashed',
    gap: 6,
    alignSelf: 'center',
  },
  escudoPickerImg: {
    width: 90,
    height: 90,
    borderRadius: 12,
    resizeMode: 'contain',
  },
  escudoPickerTxt: {
    fontFamily: 'Creato-Regular',
    color: colors.text_secondary,
    fontSize: 11,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    width: '100%',
  },
  input: {
    flex: 1,
    fontFamily: 'Creato-Regular',
    color: colors.text,
    fontSize: 14,
  },
  btnSalvar: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  btnSalvarTxt: {
    fontFamily: 'Creato-Bold',
    color: '#FFF',
    fontSize: 14,
    letterSpacing: 0.8,
  },
});