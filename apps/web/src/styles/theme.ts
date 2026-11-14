import { darkColors, interfaceColors, lightColors, liveBadgeColors } from '../../../../packages/design-tokens/src/colors';
import { lightPositionStrokeWidth } from '../../../../packages/design-tokens/src/positions';

// Traduz os tokens compartilhados para os nomes já usados no CSS do web.
export type ThemePreference = 'system' | 'light' | 'dark';
export function getThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem('ludora_tema');
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch { return 'system'; }
}
const lightTokens = {
  'primaria-hover': lightColors.hover.primaria,
  'card-hover-claro': lightColors.hover.card,
  'linha-hover-claro': lightColors.hover.linhaTabela,
  'controle-hover-claro': lightColors.hover.controle,
  'agendada-fundo-claro': lightColors.statusPartida.agendada.fundo,
  'agendada-texto-claro': lightColors.statusPartida.agendada.texto,
  'preparada-fundo-claro': lightColors.statusPartida.preparada.fundo,
  'preparada-texto-claro': lightColors.statusPartida.preparada.texto,
  'derrota-claro': lightColors.statusPartida.derrota,
  'position-stroke': String(lightPositionStrokeWidth),
};

const scoutProfiles = {
  scorer: 'Artilheiro',
  playmaker: 'Armador',
  keeper: 'Paredão',
  mixed: 'Misto',
  pending: 'Sem dados',
} as const;

function interfaceTokens(theme: keyof typeof interfaceColors) {
  const palette = interfaceColors[theme];
  const tokens: Record<string, string> = {
    'categoria-trilho': palette.categoria.trilho,
    'categoria-ativo': palette.categoria.ativo,
    'categoria-texto-ativo': palette.categoria.textoAtivo,
    'categoria-sub-fundo': palette.categoria.sub.fundo,
    'categoria-sub-borda': palette.categoria.sub.borda,
    'categoria-sub-hover': palette.categoria.sub.hover,
    'categoria-sub-borda-hover': palette.categoria.sub.bordaHover,
    'contador-fundo': palette.contador.fundo,
    'contador-texto': palette.contador.texto,
    'contador-fundo-ativo': palette.contador.fundoAtivo,
    'contador-texto-ativo': palette.contador.textoAtivo,
    'acordeao-hover': palette.acordeao.hover,
    'acordeao-ao-vivo-hover': palette.acordeao.aoVivoHover,
    'acordeao-controle-hover': palette.acordeao.controleHover,
  };
  for (const [name, profile] of Object.entries(scoutProfiles)) {
    const { fundo, texto } = palette.perfilScout[profile];
    tokens[`scout-${name}-fundo`] = fundo;
    tokens[`scout-${name}-texto`] = texto;
  }
  for (const [name, color] of Object.entries(palette.posicoes)) tokens[`posicao-${name}`] = color;
  for (const [name, color] of Object.entries(palette.cargos)) tokens[`cargo-${name.toLowerCase()}`] = color;
  for (const [name, { fundo, texto, destaque }] of Object.entries(palette.chaves)) {
    tokens[`paulista-${name.toLowerCase()}`] = texto;
    tokens[`paulista-${name.toLowerCase()}-fundo`] = fundo;
    tokens[`paulista-${name.toLowerCase()}-destaque`] = destaque;
  }
  return tokens;
}

export function applyTheme(preference = getThemePreference()) {
  const light = preference === 'light' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches);
  const colors = light ? lightColors : darkColors;
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  document.documentElement.style.colorScheme = light ? 'light' : 'dark';
  const tokens = {
    ...interfaceTokens(light ? 'light' : 'dark'),
    primaria: colors.primaria, fundo: colors.fundo,
    'fundo-card': colors.card, 'fundo-card-sec': colors.cardSecundario,
    'fundo-card-claro': colors.cardClaro,
    'superficie-neutra': light ? lightColors.superficieNeutra : darkColors.cardSecundario,
    borda: colors.borda, linha: colors.linha,
    texto: colors.texto, 'texto-sec': colors.textoSecundario,
    'texto-sobre-primaria': colors.textoSobrePrimaria,
    amarelo: colors.amarelo, vermelho: colors.vermelho,
    ciano: colors.ciano, laranja: colors.laranja,
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
  for (const [name, value] of Object.entries(lightTokens)) {
    if (light) document.documentElement.style.setProperty(`--${name}`, value);
    else document.documentElement.style.removeProperty(`--${name}`);
  }
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
