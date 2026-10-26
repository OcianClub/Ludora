import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasAssessment, searchScout, sortScout } from '../src/utils/scoutPlayers.ts';

test('nota zero válida não equivale a atleta sem avaliação', () => {
  assert.equal(hasAssessment({ perfil_ml: 'Armador', nota_geral: 0 }), true);
  assert.equal(hasAssessment({ perfil_ml: 'Sem dados', nota_geral: 0 }), false);
  assert.equal(hasAssessment({ perfil_ml: 'Artilheiro', nota_geral: NaN }), false);
  assert.equal(hasAssessment({ perfil_ml: 'Paredão', nota_geral: null }), false);
});
test('ordenação usa a métrica escolhida e mantém ausências no fim', () => {
  const players = [
    { id: 1, nome: 'João', totalGols: 1, totalAssistencias: 3, numCamisa: 6, perfil_ml: 'Armador', nota_geral: 0 },
    { id: 2, nome: 'Ethan', totalGols: 6, totalAssistencias: 0, numCamisa: 9, perfil_ml: 'Artilheiro', nota_geral: 54 },
    { id: 3, nome: 'Adam', totalGols: 0, totalAssistencias: 0, numCamisa: null, perfil_ml: 'Sem dados', nota_geral: 0 },
  ];
  assert.deepEqual(sortScout(players, 'rating').map(player => player.id), [2, 1, 3]);
  assert.deepEqual(sortScout(players, 'assists').map(player => player.id), [1, 3, 2]);
  assert.deepEqual(sortScout(players, 'shirt').map(player => player.id), [1, 2, 3]);
  assert.deepEqual(players.map(player => player.id), [1, 2, 3]);
  assert.equal(searchScout('  João Vítor '), 'joao vitor');
});
