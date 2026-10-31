import test from 'node:test';
import assert from 'node:assert/strict';
import { ordenarAgenda } from '../src/utils/scheduleFilters.ts';

test('agenda ordena por dia e horário, com desempate estável e histórico invertido', () => {
  const rows = [
    { id: 3, data: '2026-11-02', horario: '09:00' },
    { id: 2, data: '2026-11-01', horario: '19:00' },
    { id: 4, data: '2026-11-01', horario: '9:00' },
    { id: 1, data: '2026-11-01', horario: '19:00' },
  ];
  assert.deepEqual(ordenarAgenda(rows).map(row => row.id), [4, 1, 2, 3]);
  assert.deepEqual(ordenarAgenda(rows, false, true).map(row => row.id), [3, 1, 2, 4]);
  assert.equal(rows[0].id, 3);
});
