import test from 'node:test';
import assert from 'node:assert/strict';
import { groupMatches, matchPeriod, sortMatches } from '../src/utils/matchSchedule.ts';

const match = (id, status, data = '2026-09-22T00:00:00Z', horario = '18:00') => ({ id, status, data, horario });

test('prioridade: ao vivo, preparada, agendada, finalizada, cancelada; sem alterar a lista original', () => {
  const input = [match(1, 'CANCELADA'), match(2, 'FINALIZADA'), match(3, 'PREPARADA', undefined, '20:00'), match(4, 'AGENDADA'), match(5, 'AO_VIVO'), match(6, 'PREPARADA', undefined, '10:00')];
  assert.deepEqual(sortMatches(input, 'priority').map(p => p.id), [5, 6, 3, 4, 2, 1]);
  assert.deepEqual(input.map(p => p.id), [1, 2, 3, 4, 5, 6]);
});

test('ordem por horário ignora prioridade quando o usuário escolhe essa opção', () => {
  const input = [match(1, 'CANCELADA', undefined, '10:00'), match(2, 'AO_VIVO', undefined, '18:00')];
  assert.deepEqual(sortMatches(input, 'earliest').map(p => p.id), [1, 2]);
  assert.deepEqual(sortMatches(input, 'latest').map(p => p.id), [2, 1]);
});

test('a semana começa segunda e atravessa corretamente mês e ano', () => {
  assert.equal(matchPeriod('2026-09-28', 'week').key, '2026-09-28');
  assert.equal(matchPeriod('2026-10-04', 'week').key, '2026-09-28');
  assert.equal(matchPeriod('2026-10-05', 'week').key, '2026-10-05');
  assert.equal(matchPeriod('2027-01-01', 'week').key, '2026-12-28');
});

test('meses de anos diferentes não se misturam e meia-noite UTC não muda de dia', () => {
  const groups = groupMatches([match(1, 'AGENDADA', '2026-09-01T00:00:00Z'), match(2, 'AGENDADA', '2027-09-01T00:00:00Z')], 'month', 'latest');
  assert.deepEqual(groups.map(p => p.key), ['2027-09', '2026-09']);
  assert.equal(groups[1].days[0].date, '2026-09-01');
  assert.match(groups[1].days[0].label, /01 de setembro/);
});

test('mantém cabeçalhos por dia e aplica prioridade dentro de cada dia', () => {
  const groups = groupMatches([match(1, 'CANCELADA'), match(2, 'PREPARADA'), match(3, 'AGENDADA', '2026-09-23T00:00:00Z')], 'month', 'priority');
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].days.map(day => day.date), ['2026-09-22', '2026-09-23']);
  assert.deepEqual(groups[0].days[0].matches.map(p => p.id), [2, 1]);
  assert.deepEqual(groupMatches([], 'week', 'priority'), []);
});
