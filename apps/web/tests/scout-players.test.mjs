import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasAssessment, nextScoutOrder, searchScout, sortScout, scoutOrderStartsAscending, SCOUT_TABLE_COLUMNS } from '../src/utils/scoutPlayers.ts';

test('nota zero válida não equivale a atleta sem avaliação', () => {
  assert.equal(hasAssessment({ perfil_ml: 'Armador', nota_geral: 0 }), true);
  assert.equal(hasAssessment({ perfil_ml: 'Sem dados', nota_geral: 0 }), false);
  assert.equal(hasAssessment({ perfil_ml: 'Artilheiro', nota_geral: NaN }), false);
  assert.equal(hasAssessment({ perfil_ml: 'Paredão', nota_geral: null }), false);
});

test('cada ordenação alterna as duas direções e volta ao padrão no terceiro clique', () => {
  for (const { value } of SCOUT_TABLE_COLUMNS) {
    const first = nextScoutOrder(null, value, false);
    const second = nextScoutOrder(first.ordem, value, first.direcao === 'asc');
    const third = nextScoutOrder(second.ordem, value, second.direcao === 'asc');
    assert.equal(first.ordem, value);
    assert.equal(first.direcao, scoutOrderStartsAscending(value) ? 'asc' : 'desc');
    assert.equal(second.ordem, value);
    assert.notEqual(second.direcao, first.direcao);
    assert.deepEqual(third, { ordem: '', direcao: '' });
  }
  assert.deepEqual(nextScoutOrder('goals', 'assists', true), { ordem: 'assists', direcao: 'desc' });
});

test('tabela ordena posição, idade e perfil sem transformar dados ausentes em zero', () => {
  const players = [
    { id: 1, nome: 'João', posicao: 'Alas', idade: 12, perfil_ml: 'Armador', nota_geral: 0 },
    { id: 2, nome: 'Ethan', posicao: 'Fixo', idade: 13, perfil_ml: 'Artilheiro', nota_geral: 54 },
    { id: 3, nome: 'Adam', posicao: 'Goleiro', perfil_ml: 'Sem dados', nota_geral: 0 },
  ];
  assert.deepEqual(sortScout(players, 'position').map(p => p.id), [1, 2, 3]);
  assert.deepEqual(sortScout(players, 'position', false).map(p => p.id), [3, 2, 1]);
  assert.deepEqual(sortScout(players, 'age', false).map(p => p.id), [2, 1, 3]);
  assert.deepEqual(sortScout(players, 'age', true).map(p => p.id), [1, 2, 3]);
  assert.deepEqual(sortScout(players, 'profile').map(p => p.id), [1, 2, 3]);
  assert.deepEqual(sortScout(players, 'profile', false).map(p => p.id), [2, 1, 3]);
});
test('ordenação usa a métrica escolhida e mantém ausências no fim', () => {
  const players = [
    { id: 1, nome: 'João', totalPartidas: 6, totalGols: 1, totalAssistencias: 3, numCamisa: 6, perfil_ml: 'Armador', nota_geral: 0 },
    { id: 2, nome: 'Ethan', totalPartidas: 8, totalGols: 6, totalAssistencias: 0, numCamisa: 9, perfil_ml: 'Artilheiro', nota_geral: 54 },
    { id: 3, nome: 'Adam', totalPartidas: 0, totalGols: 0, totalAssistencias: 0, numCamisa: null, perfil_ml: 'Sem dados', nota_geral: 0 },
  ];
  assert.deepEqual(sortScout(players, 'rating').map(player => player.id), [2, 1, 3]);
  assert.deepEqual(sortScout(players, 'assists').map(player => player.id), [1, 3, 2]);
  assert.deepEqual(sortScout(players, 'shirt').map(player => player.id), [1, 2, 3]);
  assert.deepEqual(sortScout(players, 'rating', true).map(player => player.id), [3, 1, 2]);
  assert.deepEqual(sortScout(players, 'shirt', false).map(player => player.id), [2, 1, 3]);
  assert.deepEqual(sortScout(players, 'goals', true).map(player => player.id), [3, 1, 2]);
  assert.deepEqual(players.map(player => player.id), [1, 2, 3]);
  assert.equal(searchScout('  João Vítor '), 'joao vitor');
});
