import type { Jogador } from '../src/services/mlService';

const categorias = [7, 8, 9, 10, 12, 14, 16, 18];
const perfis = ['Artilheiro', 'Armador', 'Paredão', 'Sem dados'];

export function gerarJogadoresScout(quantidade: number): Jogador[] {
  return Array.from({ length: quantidade }, (_, indice) => ({
    id_jogador: indice + 1,
    nome: `Atleta ${indice % 3 === 0 ? 'João' : 'Maria'} ${indice}`,
    posicao: indice % 4 === 0 ? 'Goleiro' : 'Ala',
    numCamisa: indice % 99,
    idade: 14,
    perfil_ml: perfis[Math.floor(indice / 8) % 4],
    scores_ml: null,
    nota_geral: (indice * 37) % 100,
    categoria: `SUB-${categorias[indice % 8]}`,
    categoria_tipo: indice % 8 < 4 ? 'INICIACAO' : 'BASE',
    categoria_id: (indice % 8) + 1,
    time: 'Clube',
    jogos_disputados: indice % 12,
    gols: (indice * 13) % 30,
    assistencias: (indice * 7) % 20,
    defesas: indice % 15,
    cartoes_amarelos: indice % 3,
    cartoes_vermelhos: 0,
    faltas_cometidas: indice % 7,
  }));
}
