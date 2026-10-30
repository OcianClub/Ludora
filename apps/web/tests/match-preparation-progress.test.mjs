import test from 'node:test';
import assert from 'node:assert/strict';
import { preparationStorageKey, resolvePreparationStep } from '../src/utils/matchPreparation.ts';

const data = (overrides = {}) => ({
  podePreparar: true,
  partida: { status: 'AGENDADA', data: '2026-11-20', horario: '19:30', titulares_necessarios: 5 },
  minhaEquipeId: 1,
  equipes: [{ id: 1, pronta: false, escalacao: Array.from({ length: 6 }, (_, i) => ({ titular: i < 5, numCamisa: i + 1 })) }],
  ...overrides,
});
test('retoma dados, escalação e revisão sem avançar automaticamente uma escolha anterior', () => {
  for (const step of [0, 1, 2]) assert.equal(resolvePreparationStep(data(), String(step)), step);
  assert.equal(resolvePreparationStep(data(), null), 1);
  assert.equal(resolvePreparationStep(data({ equipes: [{ ...data().equipes[0], pronta: true }] }), null), 2);
});
test('revalida a escalação e os dados antes de restaurar a revisão', () => {
  assert.equal(resolvePreparationStep(data({ equipes: [{ id: 1, escalacao: [] }] }), '2'), 1);
  assert.equal(resolvePreparationStep(data({ partida: { ...data().partida, horario: '25:00' } }), '2'), 0);
  assert.equal(resolvePreparationStep(data({ podePreparar: false }), '2'), 0);
  assert.equal(resolvePreparationStep(data({ partida: { ...data().partida, status: 'AO_VIVO' } }), '2'), 0);
  assert.equal(resolvePreparationStep(data(), 'corrompido'), 0);
});
test('separa o progresso por usuário, clube e partida', () => {
  const keys = [preparationStorageKey(1, 2, '3'), preparationStorageKey(1, 4, '3'), preparationStorageKey(2, 2, '3'), preparationStorageKey(1, 2, '4')];
  assert.equal(new Set(keys).size, 4);
});
