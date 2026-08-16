import { StyleSheet, Platform } from 'react-native';
import { colors, typography } from '@ludora/design-tokens';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.fundo,
  },
  
  // ── Header (Títulos) ──
  headerContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  tituloMain: {
    fontFamily: typography.fontFamily.titulo.bold,
    fontSize: typography.fontSize.xl,
    color: colors.texto,
    marginBottom: 6,
  },
  subtituloMain: {
    fontFamily: typography.fontFamily.corpo.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textoSecundario,
  },

  // ── Input de Busca ──
  searchContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: colors.borda,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: typography.fontFamily.corpo.regular,
    fontSize: typography.fontSize.sm,
    color: colors.texto,
  },

  // ── Seus Clubes (Carrossel Horizontal) ──
  seusClubesContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.textoSecundario,
    textTransform: 'uppercase',
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  seusClubesScroll: {
    paddingHorizontal: 24,
    gap: 16,
  },
  clubeAtalhoContainer: {
    alignItems: 'center',
    width: 64,
  },
  clubeAtalhoLogo: {
    width: 56,
    height: 56,
    backgroundColor: colors.primaria,
    borderRadius: 10,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  clubeAtalhoNome: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: 10,
    color: colors.texto,
    textAlign: 'center',
  },
  btnBuscarMais: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textoSecundario,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  // ── Lista de Clubes (Vertical) ──
  listaContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 6,
  },
  locationText: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.xs,
    color: colors.textoSecundario,
    textTransform: 'uppercase',
  },
  
  // ── Card do Clube ──
  clubeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  clubeCardLogo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    marginRight: 16,
    backgroundColor: colors.primaria
  },
 clubeCardInfo: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 10, // Dá um respiro antes do botão de seguir
  },
  clubeCardNomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 2, // Espaçamento moderno entre nome, verificação e badge
  },
  clubeCardNome: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.sm,
    color: colors.texto,
    flexShrink: 1, // OBRIGATÓRIO: Impede que o nome empurre os itens ao lado
  },
  badgeTecnico: {
    backgroundColor: colors.fundoAtencao,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  badgeTecnicoTxt: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: 8.5,
    color: colors.tituloAtencao,
  },
  clubeCardSub: {
    fontFamily: typography.fontFamily.corpo.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textoSecundario,
  },
  
  // ── Botões de Seguir ──
  btnSeguir: {
    backgroundColor: colors.primaria,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  txtBtnSeguir: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.xs,
    color: '#FFF',
  },
  btnSeguindo: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borda,
  },
  txtBtnSeguindo: {
    color: colors.textoSecundario,
  },

  // ── Rodapé (Convite) ──
  rodapeContainer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 16,
  },
  linhaSeparadora: {
    height: 1,
    backgroundColor: colors.linha,
    width: '100%',
    marginBottom: 16,
  },
  linhaRodape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoCinzaRodape: {
    color: colors.textoSecundario,
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.corpo.regular,
  },
  textoAzulRodape: {
    color: colors.primaria,
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.corpo.medium,
  },
});