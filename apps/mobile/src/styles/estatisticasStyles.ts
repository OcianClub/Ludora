import { StyleSheet, Dimensions } from 'react-native';
import { colors } from '@/src/theme/colors';

const { width } = Dimensions.get('window');
const MARGEM = 16;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centralizado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 40,
  },

  // ── Busca ──────────────────────────────────────────────────────────
  buscaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: MARGEM,
    marginBottom: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  buscaInput: {
    flex: 1,
    fontFamily: 'Creato-Regular',
    color: colors.text,
    fontSize: 14,
  },

  // ── Lista ──────────────────────────────────────────────────────────
  listaContent: {
    paddingHorizontal: MARGEM,
    paddingTop: 4,
  },
  txtCarregando: {
    fontFamily: 'Creato-Regular',
    color: colors.text_secondary,
    fontSize: 13,
  },
  txtErro: {
    fontFamily: 'Creato-Bold',
    color: '#555',
    fontSize: 14,
    textAlign: 'center',
  },
  btnRetry: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  txtBtnRetry: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 13,
  },

  // ── Card Jogador (Lista) ───────────────────────────────────────────
  cardJogador: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: '#262626',
  },
  cardNumCamisa: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
  },
  cardNumCamisaTxt: {
    fontFamily: 'Creato-Bold',
    fontSize: 13,
  },
  cardInfos: {
    flex: 1,
  },
  cardNome: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 15,
  },
  cardSub: {
    fontFamily: 'Creato-Regular',
    color: colors.text_secondary,
    fontSize: 12,
    marginTop: 2,
  },
  cardDireita: {
    alignItems: 'flex-end',
    gap: 4,
  },
  cardBadgePerfil: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  cardBadgePerfilTxt: {
    fontFamily: 'Creato-Bold',
    fontSize: 10,
    letterSpacing: 0.6,
  },
  cardNota: {
    fontFamily: 'Creato-Bold',
    color: colors.text_secondary,
    fontSize: 11,
  },

  // ── Modal Scout ────────────────────────────────────────────────────
  scoutContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: MARGEM,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: colors.background,
  },
  scoutBtnVoltar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoutHeaderTitulo: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 16,
    letterSpacing: 1,
  },
  scoutContent: {
    paddingHorizontal: MARGEM,
    paddingTop: 8,
  },

  scoutIdentidade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#161616',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 20,
  },
  scoutAvatarNum: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoutAvatarNumTxt: {
    fontFamily: 'Creato-Bold',
    fontSize: 22,
  },
  scoutNome: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 18,
  },
  scoutPosicao: {
    fontFamily: 'Creato-Regular',
    color: colors.text_secondary,
    fontSize: 13,
  },
  scoutChip: {
    backgroundColor: '#262626',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#333',
  },
  scoutChipTxt: {
    fontFamily: 'Creato-Bold',
    color: colors.text_secondary,
    fontSize: 10,
  },
  scoutNotaContainer: {
    alignItems: 'center',
  },
  scoutNotaLabel: {
    fontFamily: 'Creato-Bold',
    color: colors.text_secondary,
    fontSize: 9,
    letterSpacing: 1,
  },
  scoutNota: {
    fontFamily: 'Creato-Bold',
    fontSize: 36,
  },

  // ── Seção Radar / Barras ───────────────────────────────────────────
  scoutHexContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 10,
  },
  scoutSecaoLabel: {
    fontFamily: 'Creato-Bold',
    color: colors.azulClaro,
    fontSize: 11,
    letterSpacing: 1.4,
    marginBottom: 16,
    marginTop: 4,
  },
  scoutScoresGrid: {
    width: '100%',
    marginTop: 24,
    gap: 12,
  },
  scoutScoreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scoutScoreLabel: {
    fontFamily: 'Creato-Bold',
    color: colors.text_secondary,
    fontSize: 10,
    width: 95,
  },
  scoutScoreBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#262626',
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoutScoreBar: {
    height: 6,
    borderRadius: 3,
  },
  scoutScoreVal: {
    fontFamily: 'Creato-Bold',
    fontSize: 12,
    width: 28,
    textAlign: 'right',
  },
  scoutSemDados: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 32,
  },
  scoutSemDadosTxt: {
    fontFamily: 'Creato-Regular',
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
  },

  // ── Grid das Estatísticas (UX Premium Corrigido) ─────────────────────────────
  scoutStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  scoutStatCard: {
    backgroundColor: '#161616', 
    borderRadius: 16, 
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#262626',
    width: (width - (MARGEM * 2) - 24) / 3 - 0.5, 
  },
  scoutStatValor: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 22, 
    marginTop: 8,
  },
  scoutStatLabel: {
    fontFamily: 'Creato-Regular',
    color: colors.text_secondary,
    fontSize: 11, 
    marginTop: 2,
  },

  // ── Eficiência ─────────────────────────────────────────────────────
  scoutEficienciaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  scoutEficienciaCard: {
    flex: 1,
    backgroundColor: '#161616',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#262626',
  },
  scoutEficienciaValor: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 26,
    marginTop: 8,
  },
  scoutEficienciaLabel: {
    fontFamily: 'Creato-Regular',
    color: colors.text_secondary,
    fontSize: 11,
    marginTop: 4,
  },
});