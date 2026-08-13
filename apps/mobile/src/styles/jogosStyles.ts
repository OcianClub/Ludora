import { StyleSheet } from 'react-native';
import { colors, typography } from '@ludora/design-tokens';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.fundo,
  },
  
  // ── FILTRO PRINCIPAL (TELA JOGOS) ──
  filtersContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 16,
  },
  singleFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  filterBtnText: {
    flex: 1,
    fontFamily: typography.fontFamily.corpo.medium,
    color: colors.texto,
    fontSize: typography.fontSize.sm,
    marginLeft: 16,
  },
  
  // ── LISTA DE PARTIDAS ──
  content: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  daySection: {
    marginBottom: 24,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
    marginTop: 16,
  },
  dateBar: {
    width: 3,
    height: 20,
    backgroundColor: colors.primaria,
    borderRadius: 2,
  },
  dateText: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.texto,
    fontSize: typography.fontSize.sm,
    textTransform: 'uppercase',
  },

  // ── CARD DA PARTIDA ──
  matchCard: {
    backgroundColor: colors.card,
    borderRadius: 10,
    marginBottom: 16,
    padding: 16,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontFamily: typography.fontFamily.corpo.regular,
    color: colors.texto,
    fontSize: typography.fontSize.sm,
  },
  separator: {
    width: 1,
    height: 12,
    backgroundColor: colors.borda,
  },
  catText: {
    fontFamily: typography.fontFamily.corpo.regular,
    color: colors.texto,
    fontSize: typography.fontSize.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaria,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 10,
  },
  badgeText: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.texto,
    fontSize: 10,
    letterSpacing: 0.5,
  },

  // CORPO DO CARD (TIMES E PLACAR)
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  teamCol: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
  },
  teamLogo: {
    width: 46,
    height: 46,
    resizeMode: 'contain',
  },
  fundoImg: {
    backgroundColor: colors.cardSecundario,
    borderRadius: 10,
    padding: 4
  },
  teamName: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.texto,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  placarCentral: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
  placarText: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.texto,
    fontSize: typography.fontSize.xl,
  },
  vsText: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.textoSecundario,
    fontSize: typography.fontSize.sm,
  },

  // RODAPÉ DO CARD
  cardFooterDivider: {
    height: 1,
    backgroundColor: colors.linha,
    marginBottom: 12,
    marginHorizontal: -16, 
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    fontFamily: typography.fontFamily.corpo.regular,
    color: colors.texto,
    fontSize: typography.fontSize.xs,
  },

  // ── MODAL DE FILTROS ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.texto,
    fontSize: typography.fontSize.lg,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cardSecundario,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSectionLabel: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.textoSecundario,
    fontSize: typography.fontSize.sm,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  
  // SELETOR DE DATA
  dateSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardClaro,
    borderWidth: 1,
    borderColor: colors.borda,
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
  },
  dateSelectorText: {
    flex: 1,
    fontFamily: typography.fontFamily.corpo.medium,
    color: colors.texto,
    fontSize: typography.fontSize.sm,
    marginLeft: 12,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  monthGridItem: {
    width: '23%', 
    paddingVertical: 10,
    backgroundColor: colors.fundo,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borda,
    alignItems: 'center',
  },
  monthGridItemActive: {
    borderColor: colors.primaria,
    backgroundColor: colors.fundoBotao,
  },
  monthGridText: {
    fontFamily: typography.fontFamily.corpo.medium,
    color: colors.textoSecundario,
    fontSize: typography.fontSize.sm,
  },
  monthGridTextActive: {
    color: colors.primaria,
  },

  // OPÇÕES DE STATUS
  statusOptionsContainer: {
    gap: 12,
    marginBottom: 32,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardClaro,
    borderWidth: 1,
    borderColor: colors.borda,
    borderRadius: 10,
    padding: 14,
  },
  statusItemActive: {
    borderColor: colors.primaria,
  },
  statusItemText: {
    fontFamily: typography.fontFamily.corpo.medium,
    color: colors.texto,
    fontSize: typography.fontSize.sm,
  },
  
  // BOTÃO APLICAR
  applyBtn: {
    backgroundColor: colors.primaria,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyBtnText: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    color: colors.texto,
    fontSize: typography.fontSize.sm,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    shadowColor: colors.primaria,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 10, 
    justifyContent: 'center',
    alignItems: 'center',
  }
});