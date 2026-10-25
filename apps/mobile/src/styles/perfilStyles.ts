import { StyleSheet } from "react-native";
import { typography } from "@ludora/design-tokens";
import type { ThemeColors } from '@/src/contexts/ThemeContext';

const MARGEM = 20;

export const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.fundo,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: MARGEM,
    paddingTop: 10,
    paddingBottom: 24,
  },
  sectionTabs: {
    flexDirection: 'row',
    gap: 4,
    marginHorizontal: MARGEM,
    marginBottom: 12,
    padding: 4,
    borderRadius: 10,
    backgroundColor: colors.card,
  },
  sectionTab: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 8,
    borderRadius: 7,
  },
  sectionTabActive: {
    backgroundColor: colors.fundoBotao,
  },
  sectionTabText: {
    fontFamily: typography.fontFamily.corpo.medium,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    color: colors.textoSecundario,
  },
  sectionTabTextActive: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.primaria,
  },
  sectionIntro: {
    gap: 6,
    marginBottom: 22,
  },
  pageSectionTitle: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: 20,
    color: colors.texto,
  },
  sectionDescription: {
    fontFamily: typography.fontFamily.corpo.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textoSecundario,
  },
  personalInfoRow: {
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.linha,
  },
  personalInfoLabel: {
    fontFamily: typography.fontFamily.corpo.regular,
    fontSize: 12,
    color: colors.textoSecundario,
  },
  personalInfoValue: {
    fontFamily: typography.fontFamily.corpo.medium,
    fontSize: 15,
    lineHeight: 22,
    color: colors.texto,
  },

  // ========================================
  // PERFIL
  // ========================================
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borda,
    backgroundColor: colors.card,
    marginBottom: 18,
  },
  profileIdentity: { flex: 1, minWidth: 0, gap: 4 },
  profileEmail: { fontFamily: typography.fontFamily.corpo.regular, color: colors.textoSecundario, fontSize: 13 },
  menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borda, marginLeft: 64 },
  avatarWrapper: {
    position: "relative",
    flexShrink: 0,
  },

  avatar: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.fundoBotao,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.bordaBotao,
  },
  avatarLetra: {
    fontFamily: typography.fontFamily.titulo.bold,
    fontSize: 28,
    color: colors.primaria,
  },
  avatarStatus: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 15,
    height: 15,
    borderRadius: 10,
    backgroundColor: colors.primaria,
    borderWidth: 3,
    borderColor: colors.fundo,
  },
  nomeUsuario: {
    fontFamily: typography.fontFamily.titulo.bold,
    fontSize: 22,
    color: colors.texto,
    marginBottom: 3,
  },
  dataMembro: {
    fontFamily: typography.fontFamily.corpo.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textoSecundario,
  },

  // ========================================
  // SEÇÕES
  // ========================================

  section: {
    marginBottom: 27,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 11,
  },
  sectionIndicator: {
    width: 4,
    height: 19,
    backgroundColor: colors.primaria,
    borderRadius: 1,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: 12,
    color: colors.textoSecundario,
    letterSpacing: 1,
  },

  // ========================================
  // MENU
  // ========================================

  menu: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borda,
    overflow: "hidden",
  },
  menuItem: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  themeItem: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  menuIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardSecundario,
    borderRadius: 10,
  },
  themeSettingRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  themePreviewWrapper: { width: 36, height: 36, backgroundColor: colors.cardSecundario, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  themeSettingTitle: { flex: 1, minWidth: 0 },
  themeCurrentValue: { flexShrink: 1, fontFamily: typography.fontFamily.corpo.regular, fontSize: 13, color: colors.textoSecundario },
  themePreview: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.textoSecundario, overflow: 'hidden', backgroundColor: colors.card },
  themePreviewHalf: { width: '50%', height: '100%', backgroundColor: colors.textoSecundario },
  themeSheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  themeBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  themeSheet: { backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 12, maxHeight: '85%' },
  themeSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  themeSheetTitle: { flex: 1, fontFamily: typography.fontFamily.corpo.semiBold, fontSize: 18, color: colors.texto },
  themeCloseButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  themeSheetList: { flexShrink: 1 },
  themeChoice: { minHeight: 56, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 16 },
  themeChoiceText: { flex: 1, fontFamily: typography.fontFamily.corpo.regular, fontSize: 15, color: colors.texto },
  themeChoiceTextSelected: { fontFamily: typography.fontFamily.corpo.semiBold },
  themeRadio: { width: 21, height: 21, borderRadius: 11, borderWidth: 1.5, borderColor: colors.textoSecundario, alignItems: 'center', justifyContent: 'center' },
  themeRadioSelected: { borderColor: colors.primaria },
  themeRadioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.primaria },
  menuContent: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 2,
  },
  menuTitulo: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.texto,
  },
  menuSubtitulo: {
    fontFamily: typography.fontFamily.corpo.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textoSecundario,
    lineHeight: 18,
  },

  // ========================================
  // LOGOUT
  // ========================================

  logoutButton: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borda,
  },
  logoutIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  logoutContent: {
    flex: 1,
    gap: 2,
  },
  logoutTitle: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.tituloErro,
  },
  logoutSubtitle: {
    fontFamily: typography.fontFamily.corpo.regular,
    fontSize: typography.fontSize.xs,
    color: colors.corpoErro,
  },

  // ========================================
  // MODAL
  // ========================================

  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
  },
  modalCard: {
    width: "100%",
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borda,
    padding: 24,
    alignItems: "center",
  },
  modalIcon: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.fundoErro,
    borderRadius: 10,
    marginBottom: 15,
  },
  modalTitulo: {
    fontFamily: typography.fontFamily.titulo.semiBold,
    fontSize: 20,
    color: colors.texto,
    marginBottom: 6,
  },
  modalSubtitulo: {
    fontFamily: typography.fontFamily.corpo.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textoSecundario,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  modalButtons: {
    width: "100%",
    flexDirection: "row",
    gap: 9,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardSecundario,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borda,
  },
  cancelText: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textoSecundario,
    letterSpacing: 0.5,
  },
  confirmButton: {
    flex: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.fundoErro,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.bordaErro,
  },
  confirmText: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.tituloErro,
    letterSpacing: 0.5,
  },
});
