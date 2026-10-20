import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Jogador } from '../src/services/mlService';
import { filtrarJogadoresScout } from '../src/utils/filtrosScout';

const atleta = (dados: Partial<Jogador>): Jogador => ({
  id_jogador: 1, nome: 'João', posicao: 'Goleiro', numCamisa: 1, idade: 16,
  perfil_ml: 'Paredão', scores_ml: null, nota_geral: 70, categoria: 'SUB-16',
  categoria_tipo: 'BASE', categoria_id: 1, time: 'Ludora', jogos_disputados: 2,
  gols: 0, assistencias: 0, defesas: 8, cartoes_amarelos: 0, cartoes_vermelhos: 0,
  faltas_cometidas: 0, ...dados,
});

test('perfil e busca se combinam, ignorando acentos e espaços externos', () => {
  const jogadores = [atleta({}), atleta({ id_jogador: 2, perfil_ml: 'Armador', nome: 'João Pedro' })];
  assert.deepEqual(filtrarJogadoresScout(jogadores, ' joao ', 'Paredão', 'NOTA').map(j => j.id_jogador), [1]);
  assert.equal(filtrarJogadoresScout(jogadores, 'goleiro', 'Todos', 'NOTA').length, 2);
  assert.equal(filtrarJogadoresScout(jogadores, 'inexistente', 'Todos', 'NOTA').length, 0);
});

test('ordenação por defesas não altera a lista de origem', () => {
  const jogadores = [atleta({ defesas: 3 }), atleta({ id_jogador: 2, defesas: 12 })];
  assert.deepEqual(filtrarJogadoresScout(jogadores, '', 'Todos', 'DEFESAS').map(j => j.id_jogador), [2, 1]);
  assert.deepEqual(jogadores.map(j => j.id_jogador), [1, 2]);
});

test('Sem dados e categorias sem atletas mantêm estados vazios corretos', () => {
  const jogadores = [atleta({ perfil_ml: 'Sem dados', nota_geral: 0 }), atleta({ id_jogador: 2 })];
  assert.deepEqual(filtrarJogadoresScout(jogadores, '', 'Sem dados', 'NOTA').map(j => j.id_jogador), [1]);
  assert.deepEqual(filtrarJogadoresScout([], '', 'Artilheiro', 'GOLS'), []);
});
