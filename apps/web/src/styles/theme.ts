import { darkColors, lightColors, liveBadgeColors } from '../../../../packages/design-tokens/src/colors';

// Traduz os tokens compartilhados para os nomes já usados no CSS do web.
export type ThemePreference = 'system' | 'light' | 'dark';
export function getThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem('ludora_tema');
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch { return 'system'; }
}
export function applyTheme(preference = getThemePreference()) {
  const light = preference === 'light' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches);
  const colors = light ? lightColors : darkColors;
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  document.documentElement.style.colorScheme = light ? 'light' : 'dark';
  const tokens = {
    primaria: colors.primaria, fundo: colors.fundo,
    'fundo-card': colors.card, 'fundo-card-sec': colors.cardSecundario,
    'fundo-card-claro': colors.cardClaro, borda: colors.borda, linha: colors.linha,
    texto: colors.texto, 'texto-sec': colors.textoSecundario,
    'texto-sobre-primaria': colors.textoSobrePrimaria,
    amarelo: colors.amarelo, vermelho: colors.vermelho,
    'vermelho-destaque': colors.vermelhoDestaque,
    'fundo-botao': colors.fundoBotao, 'borda-botao': colors.bordaBotao,
    'fundo-erro': colors.fundoErro, 'borda-erro': colors.bordaErro,
    'titulo-erro': colors.tituloErro, 'corpo-erro': colors.corpoErro,
    'fundo-atencao': colors.fundoAtencao,
    'borda-atencao': colors.bordaAtencao,
    'titulo-atencao': colors.tituloAtencao,
    'corpo-atencao': colors.corpoAtencao,
    'icone-atencao': colors.iconeAtencao,
    'resultado-empate': light ? '#F4B942' : colors.amarelo,
    'ao-vivo-fundo': liveBadgeColors.fundo,
    'ao-vivo-borda': liveBadgeColors.borda,
    'ao-vivo-texto': liveBadgeColors.texto,
    'ao-vivo-indicador': liveBadgeColors.indicador,
  };
  for (const [name, value] of Object.entries(tokens)) {
    document.documentElement.style.setProperty(`--${name}`, value);
  }
}

export function setThemePreference(preference: ThemePreference) {
  localStorage.setItem('ludora_tema', preference);
  applyTheme(preference);
  window.dispatchEvent(new Event('ludora:theme-change'));
}
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => applyTheme());
