import { StyleSheet } from 'react-native';
import { colors, typography } from '@ludora/design-tokens';


export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.fundo,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  
  // ── SECTIONS ──
  sectionLabel: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: 12,
    color: '#FFF',
    marginBottom: 10,
    marginTop: 24,
    textTransform: 'uppercase',
  },

  // ── DROPDOWN (COMPETIÇÃO) ──
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.cardSecundario,
    gap: 12,
  },
  dropdownText: {
    flex: 1,
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.texto,
  },

  // ── CATEGORIA (PILLS) ──
  pillRow: {
    gap: 12,
    paddingVertical: 4,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardSecundario,
  },
  pillActive: {
    backgroundColor: colors.primaria,
    borderColor: colors.primaria,
  },
  pillText: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textoSecundario,
  },
  pillTextActive: {
    color: '#FFF',
  },

  // ── CONFRONTO ──
  confrontoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    position: 'relative',
  },
  timeCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 8,
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardSecundario,
    height: 140,
  },
  timeCardSelecionado: {
    borderColor: colors.primaria,
  },
  addIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.fundo,
    borderWidth: 1.5,
    borderColor: colors.cardSecundario,
    borderStyle: 'dashed', 
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  timeCardLabel: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: 11,
    color: colors.texto,
    textTransform: 'uppercase',
  },
  timeCardSub: {
    fontFamily: typography.fontFamily.corpo.medium,
    fontSize: 12,
    color: colors.primaria,
    marginTop: 4,
  },
  timeCardNome: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: 12,
    color: colors.texto,
    textAlign: 'center',
    marginTop: 12,
    textTransform: 'uppercase',
  },
  
  // Bolinha VS centralizada
  vsBadgeContainer: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: [{ translateX: -16 }, { translateY: -16 }],
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 100,
    backgroundColor: colors.primaria,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.fundo, 
  },
  vsText: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: 12,
    color: '#FFF',
  },

  // ── MANDO DE CAMPO ──
  mandoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  mandoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.cardSecundario,
    gap: 8,
  },
  mandoBtnAtivo: {
    borderColor: colors.primaria,
    backgroundColor: colors.fundoBotao,
  },
  mandoTxt: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: 11,
    color: colors.textoSecundario,
    textTransform: 'uppercase',
  },
  mandoTxtAtivo: {
    color: colors.primaria,
  },

  // ── DATA E HORÁRIO ──
  rowDuplo: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 20,
  },
  halfBlock: {
    flex: 1,
  },
  halfLabel: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: 12,
    color: '#FFF',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: colors.cardSecundario,
    gap: 12,
  },
  inputText: {
    flex: 1,
    fontFamily: typography.fontFamily.corpo.regular,
    fontSize: typography.fontSize.sm,
    color: colors.texto,
  },

  // ── BOTÃO SALVAR ──
  salvarBtn: {
    marginTop: 32,
    borderRadius: 10,
    overflow: 'hidden',
  },
  salvarGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  salvarBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  salvarText: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.md,
    color: '#FFF',
  },

  // ── MODAL GENÉRICO E DE TIMES ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end', 
  },
  modalContent: {
    backgroundColor: colors.fundo,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.lg,
    color: colors.texto,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardSecundario,
  },
  
  // ITENS DO MODAL (TIMES E COMPETIÇÃO)
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.cardSecundario,
    backgroundColor: colors.card,
    borderRadius: 10,
    marginBottom: 12,
    gap: 16,
  },
  modalItemActive: {
    borderColor: colors.primaria,
  },
  modalItemText: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.texto,
  },
  modalItemSub: {
    fontFamily: typography.fontFamily.corpo.regular,
    fontSize: 11,
    color: colors.textoSecundario,
    marginTop: 2,
  },
  modalIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // ── BUSCA NO MODAL DE TIMES ──
  buscaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: colors.cardSecundario,
    gap: 12,
    marginBottom: 24,
  },
  buscaText: {
    flex: 1,
    fontFamily: typography.fontFamily.corpo.regular,
    fontSize: typography.fontSize.sm,
    color: colors.texto,
  },
  subCategoriaText: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: 10,
    color: colors.textoSecundario,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 4,
  },
  // ── PLACEHOLDER DE ESCUDO ──
  escudoPlaceholder: {
    backgroundColor: colors.cardSecundario,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardSecundario,
  },
  escudoPlaceholderText: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.textoSecundario,
  },
});