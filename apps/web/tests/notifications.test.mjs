import test from 'node:test';
import assert from 'node:assert/strict';
import { groupNotices } from '../src/utils/notifications.ts';

test('avisos são agrupados por dia local e ordenados do mais novo para o mais antigo', () => {
  const now = new Date(2026, 9, 23, 20);
  const item = (id, date) => ({ id, criada_em: date.toISOString() });
  const today = item(1, new Date(2026, 9, 23, 18));
  const yesterday = item(2, new Date(2026, 9, 22, 17));
  const old = item(3, new Date(2026, 9, 18, 19));
  const rows = [old, yesterday, today];
  const groups = groupNotices(rows, now);
  assert.equal(groups[0].label, 'Hoje');
  assert.equal(groups[1].label, 'Ontem');
  assert.match(groups[2].label, /18 de outubro de 2026/);
  assert.deepEqual(groups.flatMap(group => group.notices.map(item => item.id)), [1, 2, 3]);
  assert.deepEqual(rows.map(item => item.id), [3, 2, 1], 'Não modifica a resposta original');
});

test('avisos com o mesmo horário têm desempate estável pelo identificador', () => {
  const now = new Date(2026, 9, 23);
  const date = now.toISOString();
  assert.deepEqual(groupNotices([{ id: 1, criada_em: date }, { id: 9, criada_em: date }], now)[0].notices.map(item => item.id), [9, 1]);
  assert.deepEqual(groupNotices([], now), []);
});
