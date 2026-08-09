import { StyleSheet } from "react-native";
import { colors } from "@/src/theme/colors";

const MARGEM_CONTEUDO = 20;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background, 
  },
  content: {
    paddingTop: 10,
  },
  
  // --- FILTROS (MÊS E STATUS LADO A LADO) ---
  filtersContainer: {
    marginBottom: 20,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: MARGEM_CONTEUDO,
    marginBottom: 16,
    gap: 12,
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a', 
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  filterBtnText: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 14,
  },
  
  tipoSwitchContainer: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginHorizontal: MARGEM_CONTEUDO,
    marginBottom: 16,
  },
  tipoSwitchBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tipoSwitchBtnAtivo: {
    backgroundColor: colors.primary + '22',
  },
  tipoSwitchTxt: {
    fontFamily: 'Creato-Bold',
    color: colors.text_secondary,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  tipoSwitchTxtAtivo: {
    color: colors.primary,
  },

  // --- LISTAGEM E DATAS ---
  daySection: {
    paddingHorizontal: MARGEM_CONTEUDO,
    marginBottom: 10,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateBar: {
    width: 4,
    height: 24,
    backgroundColor: colors.primary, 
    marginRight: 10,
    borderRadius: 2,
  },
  dateText: {
    fontFamily: 'Creato-Bold',
    fontSize: 16,
    color: colors.text,
    letterSpacing: 0.8,
  },

  // --- CARDS DE PARTIDA ---
  matchCard: {
    backgroundColor: '#1a1a1a', 
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
    fontFamily: 'Creato-Medium',
    color: colors.text,
    fontSize: 14,
  },
  separator: {
    width: 1,
    height: 14,
    backgroundColor: colors.text_secondary, 
  },
  catText: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 14,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary, 
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
  },
  badgeText: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 10,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  teamCol: {
    alignItems: 'center',
    width: 90,
    gap: 8,
  },
  teamLogo: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  teamName: {
    fontFamily: 'Creato-Bold',
    color: colors.text,
    fontSize: 12,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  versusText: {
    fontFamily: 'Creato-Bold',
    fontSize: 20,
    color: colors.text,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.background,
    paddingTop: 12,
  },
  locationText: {
    fontFamily: 'Creato-Regular',
    color: colors.text_secondary,
    fontSize: 13,
  },

  // --- BOTÃO FLUTUANTE (FAB) ---
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- MODAIS SELETORES (GENÉRICO) ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)', 
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: 'Creato-Bold',
    fontSize: 18,
    color: colors.text,
  },
  
  // --- LISTA DO MODAL DE STATUS ---
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  statusItemActive: {
    backgroundColor: colors.primary + '18',
  },
  statusItemText: {
    fontFamily: 'Creato-Medium',
    color: colors.text_secondary,
    fontSize: 15,
  },
  statusItemTextActive: {
    color: colors.text,
    fontFamily: 'Creato-Bold',
  },

  // --- GRID DO MODAL DE MÊS ---
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  monthGridItem: {
    width: '30%', 
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a'
  },
  monthGridItemActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  monthGridText: {
    fontFamily: 'Creato-Medium',
    color: colors.text_secondary,
    fontSize: 14,
  },
  monthGridTextActive: {
    color: colors.text,
    fontFamily: 'Creato-Bold',
  },
});