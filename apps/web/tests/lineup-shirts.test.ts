import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatShirtNumber, parseShirtNumber, reconcileLineupShirts } from '../src/utils/lineupShirts';

test('1 e 01 têm o mesmo valor e apresentação 01; rejeita entrada inválida', () => {
  for (const value of ['1', '01', ' 1 ']) assert.equal(formatShirtNumber(parseShirtNumber(value)), '01');
  assert.equal(formatShirtNumber(9), '09');
  assert.equal(formatShirtNumber(10), '10');
  assert.equal(formatShirtNumber(99), '99');
  for (const value of ['00', '100', '-1', '1.5', '1e1', '1⚽', '', '1️⃣']) assert.equal(parseShirtNumber(value), null);
});

test('reconcilia titulares e reservas sem camisa sem promover reserva nem perder alterações locais', () => {
  const lineup = [
    { jogador_id: 1, numCamisa: 1, titular: true },
    { jogador_id: 2, numCamisa: 2, titular: false },
    { jogador_id: 3, numCamisa: 3, titular: false },
  ];
  const result = reconcileLineupShirts(lineup, new Map([[1, null], [3, undefined]]));
  assert.deepEqual(result.removed, [1, 3]);
  assert.deepEqual(result.lineup, [lineup[1]]);
  assert.equal(result.lineup[0].titular, false);
  assert.equal(result.changed, true);
  assert.equal(lineup.length, 3);
});

test('troca camisas mantendo os papéis e detecta quando não há alteração', () => {
  const lineup = [{ jogador_id: 1, numCamisa: 1, titular: true }, { jogador_id: 2, numCamisa: 2, titular: false }];
  const result = reconcileLineupShirts(lineup, new Map([[1, 2], [2, 1]]));
  assert.deepEqual(result.lineup.map(item => [item.numCamisa, item.titular]), [[2, true], [1, false]]);
  assert.deepEqual(result.removed, []);
  assert.equal(reconcileLineupShirts(lineup, new Map([[1, 1]])).changed, false);
});
