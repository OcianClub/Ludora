import { colors } from '../../../../packages/design-tokens/src/colors';

// Traduz os tokens compartilhados para os nomes já usados no CSS do web.
export function applyTheme() {
  const tokens = {
    primaria: colors.primaria, fundo: colors.fundo,
    'fundo-card': colors.card, 'fundo-card-sec': colors.cardSecundario,
    'fundo-card-claro': colors.cardClaro, borda: colors.borda, linha: colors.linha,
    texto: colors.texto, 'texto-sec': colors.textoSecundario,
    amarelo: colors.amarelo, vermelho: colors.vermelho,
    'fundo-botao': colors.fundoBotao, 'borda-botao': colors.bordaBotao,
    'fundo-erro': colors.fundoErro, 'borda-erro': colors.bordaErro,
    'titulo-erro': colors.tituloErro, 'corpo-erro': colors.corpoErro,
    'fundo-atencao': colors.fundoAtencao,
  };
  for (const [name, value] of Object.entries(tokens)) {
    document.documentElement.style.setProperty(`--${name}`, value);
  }
}
