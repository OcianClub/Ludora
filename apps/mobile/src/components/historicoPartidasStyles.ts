import { StyleSheet } from 'react-native';
import { colors, typography } from '@ludora/design-tokens';

export const styles = StyleSheet.create({
  cardWrapper: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  matchCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },

  // ── TIMES ──
  timeUm: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  timeDois: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  escudoBackground: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.cardSecundario,
    justifyContent: 'center',
    alignItems: 'center',
  },
  escudoTime: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  txtTimeUm: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: 11.5,
    color: colors.texto,
    textAlign: 'center',
  },
  txtTimeDois: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: 11.5,
    color: colors.texto,
    textAlign: 'center',
  },

  // ── PLACAR E DATA ──
  placarContainer: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dataJogo: {
    fontFamily: typography.fontFamily.corpo.regular,
    fontSize: 11.5,
    color: colors.textoSecundario,
  },
  golsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  txtGol: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.lg,
    color: colors.texto,
  },
  traco: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.textoSecundario,
  },

  // ── ÍCONE ESTATÍSTICA ──
  statsIcon: {
    paddingLeft: 8,
  }
});