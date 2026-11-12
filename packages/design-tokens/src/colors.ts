export const darkColors  = {
  // Base
  primaria: '#0E78FF',
  fundo: '#0B0D12',

  // Tipografia
  texto: '#F2E9D8',
  textoSecundario: '#8B8D94',
  textoSobrePrimaria: '#F2E9D8',

  // Layout & Cards
  card: '#14171F',
  cardSecundario: '#212531',
  borda: '#2A3040',
  linha: '#191E2A',
  cardClaro: '#1B1E27',

  // Cores sólidas puras
  amarelo: '#F0B84E',
  ciano: '#36C5DB',
  laranja: '#F58A38',
  vermelho: '#FF4D00',
  vermelhoDestaque: '#F05A4F',

  // Botões
  fundoBotao: '#091526',
  bordaBotao: '#1E4C88',

  // Feedback: Erro
  fundoErro: '#2B1319',
  bordaErro: '#5C1F2A',
  tituloErro: '#F5677E',
  corpoErro: '#C77A88',

  // Feedback: Atenção
  fundoAtencao: '#2A2011',
  bordaAtencao: '#5C4A1F',
  tituloAtencao: '#F0B84E',
  corpoAtencao: '#C7A56E',
  iconeAtencao: '#6B4E12',
} as const;

export const lightColors = {
  // Base
  primaria: '#0863D8',
  fundo: '#F2F2EF',

  // Tipografia
  texto: '#212328',
  textoSecundario: '#525762',
  textoSobrePrimaria: '#FFFFFF',

  // Layout e cards
  card: '#FFFFFF',
  cardSecundario: '#EAEAE6',
  borda: '#DEDFD9',
  linha: '#E6E6E1',
  cardClaro: '#F6F6F3',

  // Cores semânticas
  amarelo: '#C98A0B',
  ciano: '#087E96',
  laranja: '#B6530E',
  vermelho: '#D63F00',
  vermelhoDestaque: '#D14439',

  // Botões e seleção
  fundoBotao: '#E7F0FF',
  bordaBotao: '#9DC1EE',

  // Feedback de erro
  fundoErro: '#FAE6E4',
  bordaErro: '#EBBDB8',
  tituloErro: '#B3263E',
  corpoErro: '#8C4452',

  // Feedback de atenção
  fundoAtencao: '#FAEFD0',
  bordaAtencao: '#E8D08A',
  tituloAtencao: '#8A5A00',
  corpoAtencao: '#7A5C1E',
  iconeAtencao: '#C98A0B',

  // Interação em superfícies claras
  hover: {
    primaria: '#0755BA',
    card: '#F7F7F4',
    linhaTabela: '#ECEDE7',
    controle: '#E6E7E0',
  },

  statusPartida: {
    agendada: { fundo: '#E5EFFC', texto: '#214E81' },
    preparada: { fundo: '#E0F1E9', texto: '#17614B' },
    derrota: '#C9344D',
  },
} as const;

export const interfaceColors = {
  light: {
    categoria: {
      trilho: lightColors.cardSecundario,
      ativo: lightColors.card,
      textoAtivo: lightColors.texto,
      sub: { fundo: lightColors.card, borda: '#C8CBC4', hover: '#E1E8F2', bordaHover: '#9EAEC4' },
    },
    contador: { fundo: '#DEE4EB', texto: '#303F53', fundoAtivo: '#D4E5FE', textoAtivo: '#13498D' },
    acordeao: { hover: '#E8E9E3', aoVivoHover: '#E7EDF5', controleHover: '#DADCD4' },
    perfilScout: {
      Artilheiro: { fundo: '#D4E5FE', texto: '#123F80' },
      Armador: { fundo: '#E9DDF8', texto: '#492873' },
      Paredão: { fundo: '#D1EBE3', texto: '#124B41' },
      Misto: { fundo: '#F4E3BC', texto: '#604309' },
      'Sem dados': { fundo: '#E1E5EC', texto: '#384455' },
    },
    posicoes: { amarelo: '#724706', primaria: lightColors.primaria, ciano: '#00566B', laranja: '#8A3309' },
    chaves: {
      OURO: { fundo: '#F6EACB', texto: '#6F4500' },
      PRATA: { fundo: '#E1E7F0', texto: '#3B4C65' },
      BRONZE: { fundo: '#F3E2D6', texto: '#783E20' },
      RUBI: { fundo: '#F7E2EB', texto: '#862547' },
    },
    cargos: { ADMIN: lightColors.primaria, TECNICO: '#744A07', MESARIO: '#085C4D', OLHEIRO: '#57358C', TORCEDOR: lightColors.textoSecundario },
  },
  dark: {
    categoria: {
      trilho: darkColors.card,
      ativo: darkColors.cardSecundario,
      textoAtivo: darkColors.texto,
      sub: { fundo: darkColors.card, borda: darkColors.borda, hover: darkColors.cardClaro, bordaHover: '#434D61' },
    },
    contador: { fundo: darkColors.cardSecundario, texto: '#BDC5D3', fundoAtivo: '#243B5C', textoAtivo: '#C3DBFF' },
    acordeao: { hover: darkColors.cardClaro, aoVivoHover: darkColors.cardClaro, controleHover: '#2C3549' },
    perfilScout: {
      Artilheiro: { fundo: '#193657', texto: '#A3CCFF' },
      Armador: { fundo: '#362848', texto: '#DEC8FF' },
      Paredão: { fundo: '#1A3B37', texto: '#92E4D0' },
      Misto: { fundo: '#40341F', texto: '#F7D488' },
      'Sem dados': { fundo: '#2B3241', texto: '#CFD5DF' },
    },
    posicoes: { amarelo: darkColors.amarelo, primaria: darkColors.primaria, ciano: darkColors.ciano, laranja: darkColors.laranja },
    chaves: {
      OURO: { fundo: darkColors.fundo, texto: darkColors.amarelo },
      PRATA: { fundo: darkColors.fundo, texto: '#BDC8D8' },
      BRONZE: { fundo: darkColors.fundo, texto: '#C08B60' },
      RUBI: { fundo: darkColors.fundo, texto: '#D87991' },
    },
    cargos: { ADMIN: darkColors.primaria, TECNICO: darkColors.amarelo, MESARIO: '#43C9AC', OLHEIRO: '#B4A0E4', TORCEDOR: darkColors.textoSecundario },
  },
} as const;

export const colors = darkColors;

export const liveBadgeColors = {
  fundo: '#36171E',
  borda: '#853247',
  texto: '#FFFFFF',
  indicador: '#F43F5E',
} as const;
