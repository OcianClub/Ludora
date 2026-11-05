import { StyleSheet } from "react-native";
import { typography } from "@ludora/design-tokens";
import type { ThemeColors } from '@/src/contexts/ThemeContext';

import { MARGEM_TELA } from './layout';

const MARGEM = MARGEM_TELA;

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
  profileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  profileTitle: {
    color: colors.texto,
    fontFamily: typography.fontFamily.titulo.bold,
    fontSize: 27,
  },
  outlineAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.borda,
    borderRadius: 7,
    paddingHorizontal: 13,
  },
  outlineActionText: {
    color: colors.textoSecundario,
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: 13,
  },
  sessionBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.linha,
    paddingTop: 16,
    gap: 14,
  },
  sessionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clubCard: { backgroundColor: colors.card, borderColor: colors.borda, borderWidth: 1, borderRadius: 10, padding: 16, gap: 14 },
  clubCrest: { width: 38, height: 38, borderRadius: 8, backgroundColor: colors.cardSecundario, alignItems: 'center', justifyContent: 'center' },
  clubImage: { width: 29, height: 29 },
  sectionTabs: {
    flexDirection: 'row',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.linha,
    padding: 4,
    borderRadius: 10,
    backgroundColor: colors.card,
  },
  sectionTab: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    paddingVertical: 8,
    borderRadius: 7,
  },
  sectionTabActive: {
    backgroundColor: colors.cardSecundario,
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
    color: colors.texto,
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
  themeSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    padding: 14,
  },
  themeDescription: { flex: 1, minWidth: 106, gap: 4 },
  themeControl: { flexDirection: 'row', gap: 2, padding: 3, backgroundColor: colors.fundo, borderRadius: 9 },
  themeOption: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 7 },
  themeOptionActive: { backgroundColor: colors.cardSecundario },
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
