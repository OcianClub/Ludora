import test from 'node:test';
import assert from 'node:assert/strict';
import { dataHome, hojeCalendario, nomeCategoria, resultadoPartida, resumoCategoria } from '../src/utils/homeDashboard.ts';

const match = (id, status, data, extra = {}) => ({
  id, status, data, horario: '18:00', categoria: { id: 1, nome: 'sub-7' },
  gols_mandante: 2, gols_visitante: 1, emCasa: true, ...extra,
});

test('partida ao vivo tem prioridade mesmo antiga; próximos jogos seguem data e horário', () => {
  const input = [
    match(1, 'AGENDADA', '2026-10-24', { horario: '20:00' }),
    match(2, 'AO_VIVO', '2026-10-20'),
    match(3, 'AGENDADA', '2026-10-24', { horario: '10:00' }),
    match(4, 'AGENDADA', '2026-10-19'),
    match(5, 'AO_VIVO', '2026-10-20', { categoria: { nome: 'sub-8' } }),
  ];
  const summary = resumoCategoria(input, 'SUB 7', '2026-10-23');
  assert.equal(summary.principal.id, 2);
  assert.deepEqual(summary.seguintes.map(p => p.id), [3, 1]);
  assert.deepEqual(input.map(p => p.id), [1, 2, 3, 4, 5]);
});

test('sem ao vivo, próximo jogo não aparece repetido na sequência', () => {
  const input = [match(1, 'AGENDADA', '2026-10-24'), match(2, 'PREPARADA', '2026-10-25')];
  const summary = resumoCategoria(input, 'sub-7', '2026-10-23');
  assert.equal(summary.principal.id, 1);
  assert.deepEqual(summary.seguintes.map(p => p.id), [2]);
});

test('histórico limita cinco jogos, ordena por horário e calcula resultados do clube visitante', () => {
  const input = Array.from({ length: 12 }, (_, i) => match(i + 1, 'FINALIZADA', `2026-10-${String(i + 1).padStart(2, '0')}`));
  const summary = resumoCategoria(input, 'sub-7', '2026-10-23');
  assert.deepEqual(summary.historico.map(p => p.id), [12, 11, 10, 9, 8]);
  assert.deepEqual(summary.totais, { V: 5, E: 0, D: 0 });
  assert.equal(resultadoPartida(match(1, 'FINALIZADA', '2026-10-20', { emCasa: false })), 'D');
  assert.equal(resultadoPartida(match(1, 'FINALIZADA', '2026-10-20', { gols_visitante: 2 })), 'E');
});

test('datas de calendário não mudam de dia por conversão de fuso e categoria vazia é segura', () => {
  assert.match(dataHome('2026-10-01T00:00:00.000Z'), /01 de out/);
  assert.equal(hojeCalendario(new Date(2026, 9, 23, 15, 30)), '2026-10-23');
  assert.equal(nomeCategoria(' Sub 7 '), 'SUB-7');
  assert.equal(resumoCategoria([], 'sub-7', '2026-10-23').principal, undefined);
});
