import { StyleSheet } from 'react-native';
import { typography } from '@ludora/design-tokens';
import type { ThemeColors } from '@/src/contexts/ThemeContext';

export const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
    filterBarContainer: {
      paddingBottom: 10,
    },
    filterSummary: {
      flex: 1,
      gap: 3,
    },
    filterStatusText: {
      fontFamily: typography.fontFamily.corpo.regular,
      color: colors.textoSecundario,
      fontSize: 12,
    },
    singleFilterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.linha,
    },
    filterBtnText: {
      fontFamily: typography.fontFamily.corpo.medium,
      color: colors.texto,
      fontSize: typography.fontSize.sm,
    },

    // ── LISTA DE PARTIDAS ──
    content: {
      paddingHorizontal: 20,
      paddingBottom: 56,
    },
    agendaHeading: {
      marginTop: 20,
      marginBottom: 12,
      gap: 4,
    },
    agendaTitle: {
      fontFamily: typography.fontFamily.corpo.semiBold,
      fontSize: 17,
      color: colors.texto,
    },
    agendaDescription: {
      fontFamily: typography.fontFamily.corpo.regular,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textoSecundario,
    },
    matchStatus: {
      fontFamily: typography.fontFamily.corpo.medium,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textoSecundario,
      marginBottom: 14,
    },
    moreButton: {
      minHeight: 44,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    moreText: {
      fontFamily: typography.fontFamily.corpo.semiBold,
      fontSize: 13,
      color: colors.primaria,
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
    dateBarHoje: {
      backgroundColor: colors.primaria,
      width: 4,
    },
    dateText: {
      fontFamily: typography.fontFamily.corpo.semiBold,
      color: colors.texto,
      fontSize: typography.fontSize.sm,
      textTransform: 'uppercase',
    },
    dateTextHoje: {
      color: colors.primaria,
    },

    // ── CARD DA PARTIDA ──
    matchCard: {
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'transparent',
      marginBottom: 16,
      padding: 16,
    },
    matchCardHoje: {
      borderColor: colors.primaria,
    },
    matchCardAoVivo: {
      borderColor: colors.bordaBotao,
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
      flex: 1,
      minWidth: 0,
    },
    cardBadges: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
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
    todayBadge: {
      backgroundColor: colors.fundoBotao,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    todayBadgeText: {
      color: colors.primaria,
      fontFamily: typography.fontFamily.corpo.semiBold,
      fontSize: 9,
    },
    liveBadge: {
      backgroundColor: "#36171e",
    },
    liveBadgeText: {
      color: "white"
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#b12440',
    },
    badge: {
      width: 70,
      minHeight: 22,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardSecundario ,
      paddingHorizontal: 6,
      paddingVertical: 4,
      borderRadius: 6,
      gap: 6,
    },
    badgeText: {
      fontFamily: typography.fontFamily.corpo.semiBold,
      color: colors.textoSobrePrimaria,
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
      padding: 4,
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
      width: 54,
      height: 54,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
