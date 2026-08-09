import { StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';

export const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Filtros ──────────────────────────────────────────────
  filtrosWrapper: {
    height: 54,
    marginVertical: 4,
    justifyContent: 'center',
  },
  filtrosContent: {
    gap: 8,
    alignItems: 'center',
    flexDirection: 'row',
  },
  filtroPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#1a1a1a',
  },
  filtroPillAtivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filtroPillTxt: {
    color: colors.text,
    fontFamily: 'Creato-Bold',
    fontSize: 12,
    letterSpacing: 0.5,
  },

  // ── Empty ────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyTxt: {
    color: colors.text_secondary,
    fontFamily: 'Creato-Regular',
    fontSize: 14,
  },

  // ── Lista de partidas ────────────────────────────────────
  listaContent: {
    padding: 16,
    gap: 14,
  },
  rodadaLabel: {
    color: colors.azulClaro,
    fontFamily: 'Creato-Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  rodadaJogos: {
    gap: 8,
  },

  // ── Card partida ─────────────────────────────────────────
  cardPartida: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#252525',
  },
  cardPartidaPreparar: {
    borderColor: '#a855f722',
  },
  cardTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardCategoriaTxt: {
    color: colors.text_secondary,
    fontFamily: 'Creato-Bold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusTxt: {
    fontFamily: 'Creato-Bold',
    fontSize: 11,
  },
  placarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeTxt: {
    color: colors.text,
    fontFamily: 'Creato-Bold',
    fontSize: 13,
    flex: 1,
  },
  timeTxtDireita: {
    textAlign: 'right',
  },
  placarCentro: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  placarTxt: {
    color: colors.text,
    fontFamily: 'Creato-Bold',
    fontSize: 22,
  },
  placarDash: {
    color: colors.text_secondary,
    fontFamily: 'Creato-Bold',
    fontSize: 16,
  },
  placarInfo: {
    color: colors.text_secondary,
    fontFamily: 'Creato-Regular',
    fontSize: 11,
    marginTop: 2,
  },
  localTxt: {
    color: '#444',
    fontFamily: 'Creato-Regular',
    fontSize: 11,
    marginTop: 8,
  },
  btnPreparar: {
    marginTop: 10,
    backgroundColor: '#a855f718',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#a855f7',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  btnPrepararTxt: {
    color: '#a855f7',
    fontFamily: 'Creato-Bold',
    fontSize: 13,
  },

  // ── Modal detalhes ───────────────────────────────────────
  modalDetalhesOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalDetalhesBack: {
    flex: 1,
  },
  modalDetalhesContent: {
    backgroundColor: '#111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
  },
  dragHandle: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  dragBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2a2a2a',
  },
  modalDetalhesScroll: {
    padding: 20,
    paddingTop: 10,
  },
  modalDetalhesTitulo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalDetalhesTituloTxt: {
    color: colors.text,
    fontFamily: 'Creato-Bold',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },

  // Placar grande no modal
  placarCard: {
    backgroundColor: '#0d0d0d',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  placarGrandeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placarGrandeTxt: {
    color: colors.primary,
    fontFamily: 'Creato-Bold',
    fontSize: 32,
  },
  placarGrandeDash: {
    color: '#2a2a2a',
    fontFamily: 'Creato-Bold',
    fontSize: 28,
  },
  placarGrandeStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  placarGrandeInfoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
  },
  placarGrandeInfoTxt: {
    color: colors.text_secondary,
    fontFamily: 'Creato-Regular',
    fontSize: 12,
  },

  // Stats
  secaoLabel: {
    color: colors.azulClaro,
    fontFamily: 'Creato-Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  statJogadorCard: {
    backgroundColor: '#0d0d0d',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  statJogadorNome: {
    color: colors.text,
    fontFamily: 'Creato-Bold',
    fontSize: 13,
    marginBottom: 8,
  },
  statBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statBadgeTxt: {
    fontFamily: 'Creato-Bold',
    fontSize: 11,
  },

  // Convocados
  convocadosScroll: {
    marginBottom: 16,
  },
  convocadosRow: {
    flexDirection: 'row',
    gap: 8,
  },
  convocadoCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    minWidth: 72,
    borderWidth: 1,
    borderColor: '#252525',
  },
  convocadoNum: {
    color: colors.primary,
    fontFamily: 'Creato-Bold',
    fontSize: 16,
  },
  convocadoNome: {
    color: colors.text,
    fontFamily: 'Creato-Bold',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  convocadoPosicao: {
    color: colors.text_secondary,
    fontFamily: 'Creato-Regular',
    fontSize: 10,
  },

  // Botões ação
  acoesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnAcao: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 13,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  btnAcaoTxt: {
    fontFamily: 'Creato-Bold',
    fontSize: 13,
  },
  btnPreparaModal: {
    marginTop: 10,
    backgroundColor: '#a855f718',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#a855f7',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },

  // Modal status
  modalStatusOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalStatusCard: {
    backgroundColor: '#111',
    borderRadius: 18,
    padding: 20,
    width: '100%',
    gap: 6,
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  modalStatusTitulo: {
    color: colors.text,
    fontFamily: 'Creato-Bold',
    fontSize: 15,
    marginBottom: 6,
  },
  statusOpcao: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#1a1a1a',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusOpcaoAtiva: {
    borderWidth: 1,
  },
  statusOpcaoTxt: {
    fontFamily: 'Creato-Bold',
    fontSize: 14,
    flex: 1,
  },
});