import test from 'node:test';
import assert from 'node:assert/strict';
import { pendingGoal, eventAuthorTeam, canIdentifyGoal, eventScores } from '../src/utils/matchEvents.ts';
const data = { partida: { mandante_id: 10, visitante_id: 20 }, podeSumula: false, podePreparar: true, equipes: [{ time_id: 10, clube_id: 2 }, { time_id: 20, clube_id: 3 }] };

test('mini placar respeita a sequência de gols e gols contra sem contar assistências', () => {
  const scores = eventScores({ ...data, partida: { ...data.partida, gols_mandante: 2, gols_visitante: 1 }, eventos: [
    { id: 4, tipo: 'GOL', time_id: 10, gol_contra: true }, { id: 3, tipo: 'ASSISTENCIA', time_id: 20 },
    { id: 2, tipo: 'GOL', time_id: 20 }, { id: 1, tipo: 'GOL', time_id: 10 },
  ] });
  assert.deepEqual([...scores], [[4, '2 - 1'], [2, '1 - 1'], [1, '1 - 0']]);
});

test('pendência distingue gol de equipe cadastrada, externo, gol contra e outros eventos', () => {
  assert.equal(pendingGoal(data, { tipo: 'GOL', time_id: 10 }), true);
  assert.equal(pendingGoal(data, { tipo: 'GOL', time_id: 10, jogador_id: 101 }), false);
  assert.equal(pendingGoal(data, { tipo: 'FALTA', time_id: 10 }), false);
  const external = { ...data, equipes: data.equipes.slice(0, 1) };
  assert.equal(pendingGoal(external, { tipo: 'GOL', time_id: 20 }), false);
  assert.equal(pendingGoal(external, { tipo: 'GOL', time_id: 20, gol_contra: true }), true);
  assert.equal(eventAuthorTeam(data, { tipo: 'GOL', time_id: 20, gol_contra: true }), 10);
});

test('clube identifica apenas seus gols pendentes; operador pode corrigir autoria', () => {
  const goal = { tipo: 'GOL', time_id: 20 };
  assert.equal(canIdentifyGoal(data, goal, 2), false);
  assert.equal(canIdentifyGoal(data, goal, 3), true);
  assert.equal(canIdentifyGoal({ ...data, podePreparar: false }, goal, 3), false);
  assert.equal(canIdentifyGoal(data, { ...goal, jogador_id: 201 }, 3), false);
  assert.equal(canIdentifyGoal({ ...data, podeSumula: true }, { ...goal, jogador_id: 201 }, 2), true);
});
