import { StyleSheet } from "react-native";
import { typography, colors } from "@ludora/design-tokens";

const MARGEM = 20;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.fundo,
  },
  content: {
    flex: 1,
    paddingHorizontal: MARGEM,
    paddingTop: 22,
  },

  // ========================================
  // PERFIL
  // ========================================
  profileHeader: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 12,
  },

  avatar: {
    width: 78,
    height: 78,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardSecundario,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borda,
  },
  avatarLetra: {
    fontFamily: typography.fontFamily.titulo.bold,
    fontSize: 34,
    color: colors.texto,
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
    fontSize: 24,
    color: colors.texto,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  dataMembro: {
    fontFamily: typography.fontFamily.corpo.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textoSecundario,
    textTransform: "uppercase",
    letterSpacing: 0.7,
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
    fontFamily: typography.fontFamily.titulo.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.texto,
    letterSpacing: 0.2,
  },

  // ========================================
  // MENU
  // ========================================

  menu: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borda,
    overflow: "hidden",
  },
  menuItem: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  menuIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.fundoBotao,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.bordaBotao,
  },
  menuContent: {
    flex: 1,
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
  },

  // ========================================
  // LOGOUT
  // ========================================

  logoutButton: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 12,
    backgroundColor: colors.fundoErro,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.bordaErro,
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