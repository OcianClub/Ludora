import { test } from 'node:test';
import assert from 'node:assert/strict';
import { intervaloAgenda, ordenarAgenda, rotuloDiaAgenda, grupoSituacao, agruparAgenda } from '../src/utils/scheduleFilters.ts';

test('atalhos usam dias locais e delimitam a semana de segunda a domingo', () => {
  const date = new Date(2026, 9, 25, 23, 30);
  assert.deepEqual(intervaloAgenda('today', '', '', date), { inicio: '2026-10-25', fim: '2026-10-25' });
  assert.deepEqual(intervaloAgenda('week', '', '', date), { inicio: '2026-10-19', fim: '2026-10-25' });
  assert.deepEqual(intervaloAgenda('month', '', '', new Date(2024, 1, 20)), { inicio: '2024-02-01', fim: '2024-02-29' });
  assert.deepEqual(intervaloAgenda('all'), { inicio: '', fim: '' });
  assert.deepEqual(intervaloAgenda('custom', '2025-12-31', '2026-01-01'), { inicio: '2025-12-31', fim: '2026-01-01' });
});

test('ordenação respeita horário, categoria numérica e histórico sem alterar a origem', () => {
  const matches = [
    { id: 1, data: '2026-10-26', horario: '20:00', categoria: { nome: 'sub-12' } },
    { id: 2, data: '2026-10-25', horario: '19:30', categoria: { nome: 'sub-7' } },
    { id: 3, data: '2026-10-25', horario: '18:00', categoria: { nome: 'sub-10' } },
  ];
  assert.deepEqual(ordenarAgenda(matches).map(match => match.id), [3, 2, 1]);
  assert.deepEqual(ordenarAgenda(matches, true).map(match => match.id), [2, 3, 1]);
  assert.deepEqual(ordenarAgenda(matches, false, true).map(match => match.id), [1, 2, 3]);
  assert.deepEqual(matches.map(match => match.id), [1, 2, 3]);
});

test('grupos preservam estados de gestão e rótulos atravessam o fim do ano', () => {
  assert.equal(grupoSituacao('PREPARADA'), 'next');
  assert.equal(grupoSituacao('AGENDADA'), 'next');
  assert.equal(grupoSituacao('AO_VIVO'), 'live');
  assert.equal(rotuloDiaAgenda('2026-12-31', new Date(2026, 11, 31)), 'Hoje');
  assert.equal(rotuloDiaAgenda('2027-01-01', new Date(2026, 11, 31)), 'Amanhã');
});

test('agenda separa hoje, futuro e pendências, priorizando o status sem duplicar partidas', () => {
  const matches = [
    { id: 1, status: 'AO_VIVO', data: '2026-10-20T00:00:00Z' },
    { id: 2, status: 'AO_VIVO', data: '2026-10-26T00:00:00Z' },
    { id: 3, status: 'AGENDADA', data: '2026-10-26T00:00:00Z' },
    { id: 4, status: 'PREPARADA', data: '2026-10-27T00:00:00Z' },
    { id: 5, status: 'AGENDADA', data: '2026-10-25T00:00:00Z' },
    { id: 6, status: 'FINALIZADA', data: '2026-10-26T00:00:00Z' },
    { id: 7, status: 'CANCELADA', data: '2026-10-27T00:00:00Z' },
    { id: 8, status: 'PREPARADA', data: '2026-10-26T23:59:59Z' },
  ];
  const groups = agruparAgenda(matches, '2026-10-26');
  assert.deepEqual(Object.fromEntries(Object.entries(groups).map(([key, games]) => [key, games.map(game => game.id)])), {
    live: [1, 2], today: [3, 8], upcoming: [4], overdue: [5], finished: [6], cancelled: [7],
  });
  const ids = Object.values(groups).flat().map(game => game.id);
  assert.equal(ids.length, matches.length);
  assert.equal(new Set(ids).size, matches.length);
});
