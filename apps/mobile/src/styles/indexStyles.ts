import { StyleSheet } from 'react-native';
import { colors, typography } from '@ludora/design-tokens';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.fundo,
  },
  pageContainer: {
    flex: 1,
    backgroundColor: colors.fundo,
  },
  pagerView: {
    flex: 1,
  },
  flatListContent: {
    paddingBottom: 100,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },

  // PRÓXIMO JOGO
  seasonCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  seasonTitle: {
    color: colors.texto,
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.md,
  },
  seasonStatus: {
    color: colors.primaria,
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.sm,
  },

  // CARD PRINCIPAL (PARTIDA)
  mainCard: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
  },
  containerIcon: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  topCard: {
    flex: 1,
  },
  cardLabel: {
    color: colors.textoSecundario,
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.sm,
    marginBottom: 6,
  },
  teamName: {
    color: colors.texto,
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.llg,
    textTransform: 'uppercase',
  },
  
  hr: {
    height: 1,
    backgroundColor: colors.linha,
    marginVertical: 16,
  },

  // DADOS DA PARTIDA (DATA, HORA, LOCAL)
  rowSpaceBetween: {
    gap: 16,
  },
  cardHoraData: {
    flexDirection: 'row',
    gap: 32,
  },
  containerDataHora: {
    gap: 4,
  },
  containerTextDataHora: {
    gap: 2,
  },
  titleDataHora: {
    color: colors.textoSecundario,
    fontFamily: typography.fontFamily.corpo.medium,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  subTitleDataHora: {
    color: colors.texto,
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.sm,
  },
  
  containerLocalizacao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  txtLocalizacao: {
    color: colors.textoSecundario,
    fontFamily: typography.fontFamily.corpo.regular,
    fontSize: typography.fontSize.sm,
  },

  // BOTÃO VER DETALHES
  btnDetalhes: {
    backgroundColor: colors.primaria,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  txtDetalhes: {
    color: colors.texto,
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.sm,
  },

  // CARDS PEQUENOS (PONTUAÇÃO / VITÓRIAS)
  rowCards: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  smallCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 16,
  },
  smallCardContent: {
    marginTop: 8,
  },
  cardValue: {
    color: colors.texto,
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.xxl,
    marginBottom: 4,
  },
  iconRight: {
    position: 'absolute',
    right: 0,
    top: 0,
  },

  // SEÇÃO ÚLTIMAS PARTIDAS
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: colors.texto,
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.md,
  },
  seeAllButton: {
    color: colors.primaria,
    fontFamily: typography.fontFamily.corpo.medium,
    fontSize: typography.fontSize.sm,
  },
});