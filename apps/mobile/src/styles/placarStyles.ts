import { StyleSheet, Dimensions } from "react-native";
import { colors } from "@/src/theme/colors";

const { width: windowWidth } = Dimensions.get('window');
export const MARGEM_CONTEUDO = 16;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingTop: 8,
    paddingBottom: 40,
  },
  pagerView: {
    flex: 1,
  },

  atualizadoText: {
    fontFamily: 'Creato-Regular',
    color: colors.text_secondary,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },

  // ── Banner ──────────────────────────────────────────────
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: MARGEM_CONTEUDO,
    marginTop: 12,
    marginBottom: 12,
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    gap: 12,
  },
  bannerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0e78ff18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerCampeonato: { fontFamily: 'Creato-Bold', color: colors.text, fontSize: 15, letterSpacing: 1 },
  bannerSub: { fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 11, marginTop: 2, letterSpacing: 0.4 },

  // ── Filtros 1 e 2 (Divisão / Sub) ──────────────────────
  chipScroll: { flexGrow: 0, flexShrink: 0, marginBottom: 8 },
  chipRow: { paddingHorizontal: MARGEM_CONTEUDO, paddingVertical: 4, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 12, letterSpacing: 0.4 },
  chipTextActive: { color: '#fff' },

  // ── Filtro 3 (Grupo: A / B / C / Geral) ────────────────
  grupoScroll: { flexGrow: 0, flexShrink: 0, marginBottom: 12 },
  grupoRow: { paddingHorizontal: MARGEM_CONTEUDO, gap: 10, flexDirection: 'row', alignItems: 'center', },
  grupoTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center'
  },
  grupoTabAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  grupoTabText: { 
    fontFamily: 'Creato-Bold', 
    color: colors.text_secondary, 
    fontSize: 13, 
    letterSpacing: 0.4,
    textAlign: 'center'
  },  
grupoTabTextAtivo: { color: '#fff' },

  // ── Toggle (PlacarStyles) ──────────────────────────────
  toggleContainer: {
    flexDirection: 'row',
    marginHorizontal: MARGEM_CONTEUDO,
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontFamily: 'Creato-Bold',
    color: colors.text_secondary,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  toggleTextActive: {
    color: colors.text,
    letterSpacing: 0.8,
  },

  // ── Card Ocian ──────────────────────────────────────────
  ocianCard: {
    marginHorizontal: MARGEM_CONTEUDO,
    backgroundColor: '#0e78ff0f',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#0e78ff44',
    padding: 18,
    marginBottom: 16,
    marginTop: 4,
  },
  ocianHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  ocianIcone: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0e78ff33',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ocianIniciais: { fontFamily: 'Creato-Bold', color: colors.azulClaro, fontSize: 11, letterSpacing: 0.5 },
  ocianNome: { fontFamily: 'Creato-Bold', color: colors.text, fontSize: 15 },
  ocianPos:  { fontFamily: 'Creato-Regular', color: colors.azulClaro, fontSize: 12, marginTop: 2 },
  ocianBadge: {
    backgroundColor: '#0e78ff22',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#0e78ff44',
  },
  ocianBadgeText: { fontFamily: 'Creato-Bold', color: colors.azulClaro, fontSize: 9, letterSpacing: 1.2 },
  ocianStats: { flexDirection: 'row', gap: 6 },
  ocianStatItem: { flex: 1, backgroundColor: '#0e78ff18', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  ocianStatValue: { fontFamily: 'Creato-Bold', color: colors.text, fontSize: 15 },
  ocianStatLabel: { fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 9, letterSpacing: 1, marginTop: 2 },

  // ── Tabela ──────────────────────────────────────────────
  tableContainer: {
    marginHorizontal: MARGEM_CONTEUDO,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#111111',
    alignItems: 'center',
  },
  thText: {
    fontFamily: 'Creato-Bold',
    color: colors.text_secondary,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  colPosHeader:  { width: 36, paddingLeft: 4 },
  colStatHeader: { width: 28, textAlign: 'center' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  tableRowOcian: {
    backgroundColor: '#0e78ff12',
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#252525',
  },

  // ── Barras laterais e bordas ─────────────────────────────
  serieBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: 2,
  },
  ocianBorda: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.primary ?? '#0e78ff',
    borderRadius: 2,
  },

  // ── Células ─────────────────────────────────────────────
  tdText: { fontFamily: 'Creato-Regular', color: colors.text, fontSize: 13 },
  colPos: { width: 36, paddingLeft: 10 },
  colPosText: { fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 13, width: 36, paddingLeft: 4 },
  colClube: { flex: 1 },
  colStat: { width: 28, textAlign: 'center' },
  colDestaque: { fontFamily: 'Creato-Bold', fontSize: 13 },
  colStatDestaque: { fontFamily: 'Creato-Bold', fontSize: 13 },
  ocianColor:  { color: colors.azulClaro },

  // ── Clube ───────────────────────────────────────────────
  clubeContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  clubeIcone: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333', // Base mantida do campeonato.tsx
    justifyContent: 'center',
    alignItems: 'center',
  },
  clubeIconeOcian: { backgroundColor: '#0e78ff22' },
  clubeIniciais: { fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 9, letterSpacing: 0.5 },
  clubeIniciaisOcian: { color: colors.azulClaro },
  clubeTextoContainer: { flex: 1 },
  clubeText: { fontFamily: 'Creato-Regular', color: colors.text, fontSize: 13, flexWrap: 'wrap', flex: 1 },
  ocianTextBold: { fontFamily: 'Creato-Bold', color: colors.text },
  ocianHighlightColor: { color: colors.azulClaro, fontFamily: 'Creato-Bold' },

  // ── Legenda ──────────────────────────────────────────────
  legendContainer: {
    marginHorizontal: MARGEM_CONTEUDO,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    gap: 10,
  },
  legendTitle: {
    fontFamily: 'Creato-Bold',
    color: colors.text_secondary,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4 
  },
  legendGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 10 
  },
  legendItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    width: '46%' 
  },
  legendDot: { 
    width: 8, 
    height: 8,
     borderRadius: 4 
    },
  legendText: { 
    fontFamily: 'Creato-Bold', 
    color: colors.text_secondary, 
    fontSize: 10, 
    letterSpacing: 0.8 
  },

  // ── Empty / Erro ────────────────────────────────────────
  emptyState: { 
    alignItems: 'center', 
    paddingTop: 80, 
    paddingHorizontal: 40 
  },
  emptyTitle: { 
    fontFamily: 'Creato-Bold', 
    color: colors.text, 
    fontSize: 16,
     marginBottom: 8, 
     textAlign: 'center'
     },
  emptyText: { 
    fontFamily: 'Creato-Regular', 
    color: colors.text_secondary, 
    fontSize: 13, 
    textAlign: 'center', 
    lineHeight: 20 
  },

  // ── Skeleton ────────────────────────────────────────────
  skeleton: { height: 14, borderRadius: 6, backgroundColor: '#2a2a2a' },
});