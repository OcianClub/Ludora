import { StyleSheet } from "react-native";
import { typography, colors } from "@ludora/design-tokens";

const MARGEM = 20;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.fundo,
  },
  content: {
    paddingHorizontal: MARGEM,
    paddingTop: 22,
  },
  // ========================================
  // PERFIL
  // ========================================
  profileHeader: {
    alignItems: "center",
    marginBottom: 30,
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
  membroDesde: {
    fontFamily: typography.fontFamily.corpo.medium,
    fontSize: typography.fontSize.xs,
    color: colors.textoSecundario,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  // ========================================
  // SEÇÃO
  // ========================================
  section: {
    marginBottom: 23,
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
  },
  // ========================================
  // CARD DE INFORMAÇÕES
  // ========================================
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borda,
    paddingHorizontal: 13,
  },
  infoItem: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardSecundario,
    borderRadius: 10,
  },
  infoContent: {
    flex: 1,
    gap: 3,
  },
  infoLabel: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: 10,
    color: colors.textoSecundario,
    letterSpacing: 0.8,
  },
  infoValue: {
    fontFamily: typography.fontFamily.corpo.medium,
    fontSize: typography.fontSize.md,
    color: colors.texto,
  },
  infoValueEmpty: {
    color: colors.textoSecundario,
  },
  divider: {
    height: 1,
    backgroundColor: colors.linha,
    marginLeft: 52,
  },
  // ========================================
  // EDIÇÃO
  // ========================================
  editField: {
    paddingVertical: 10,
    gap: 6,
  },
  editLabel: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: 10,
    color: colors.textoSecundario,
    letterSpacing: 0.8,
  },
  inputWrapper: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.cardSecundario,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.primaria,
  },
  input: {
    flex: 1,
    fontFamily: typography.fontFamily.corpo.regular,
    fontSize: typography.fontSize.md,
    color: colors.texto,
    paddingVertical: 0,
  },
  // ========================================
  // AÇÕES
  // ========================================
  actions: {
    marginBottom: 26,
    gap: 4,
  },
  editButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borda,
  },
  editButtonText: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.texto,
    letterSpacing: 0.6,
  },
  saveButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primaria,
    borderRadius: 10,
  },
  saveButtonText: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.sm,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  cancelButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.textoSecundario,
    letterSpacing: 0.8,
  },
  // ========================================
  // ZONA DE PERIGO
  // ========================================
  dangerSection: {
    marginBottom: 20,
  },
  dangerIndicator: {
    width: 4,
    height: 19,
    backgroundColor: colors.vermelho,
    borderRadius: 1,
  },
  dangerTitle: {
    fontFamily: typography.fontFamily.titulo.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.tituloErro,
  },
  deleteButton: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.fundoErro,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.bordaErro,
  },
  deleteIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bordaErro,
    borderRadius: 10,
  },
  deleteContent: {
    flex: 1,
    gap: 2,
  },
  deleteTitle: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.md,
    color: colors.tituloErro,
  },
  deleteSubtitle: {
    fontFamily: typography.fontFamily.corpo.regular,
    fontSize: typography.fontSize.xs,
    color: colors.corpoErro,
  },
  // ========================================
  // TOAST
  // ========================================
  successToast: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 28,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 15,
    backgroundColor: colors.primaria,
    borderRadius: 10,
  },
  successText: {
    flex: 1,
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.sm,
    color: "#FFFFFF",
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
    alignItems: "center",
    padding: 24,
    backgroundColor: colors.card,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.borda,
  },
  modalIcon: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.fundoErro,
    borderRadius: 27,
    marginBottom: 15,
  },
  modalTitle: {
    fontFamily: typography.fontFamily.titulo.semiBold,
    fontSize: 20,
    color: colors.texto,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontFamily: typography.fontFamily.corpo.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textoSecundario,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 20,
  },
  modalButtons: {
    width: "100%",
    flexDirection: "row",
    gap: 9,
  },
  modalCancel: {
    flex: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardSecundario,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borda,
  },
  modalCancelText: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textoSecundario,
    letterSpacing: 0.5,
  },
  modalDelete: {
    flex: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.fundoErro,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.bordaErro,
  },
  modalDeleteText: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.tituloErro,
    letterSpacing: 0.5,
  },
});