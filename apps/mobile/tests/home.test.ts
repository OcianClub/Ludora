import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acoesDaPartidaNaHome, agendaDaCategoria, resultadoDoClube, resumirPartidas } from '../src/utils/resumoPartidas';

const agora = new Date(2026, 9, 18, 12);
const partida = (id: number, extras = {}) => ({
  id, data: '2026-10-18T00:00:00.000Z', horario: '14:00', status: 'AGENDADA',
  emCasa: true, gols_mandante: 0, gols_visitante: 0, ...extras,
});

test('torcedor acompanha a partida sem ações de preparação ou início', () => {
  assert.deepEqual(acoesDaPartidaNaHome(partida(1), false, agora), { preparar: false, iniciar: false });
});

test('gestor não prepara ou inicia partida registrada pelo clube adversário', () => {
  assert.deepEqual(acoesDaPartidaNaHome(partida(1, { somente_leitura:true }), true, agora), { preparar:false, iniciar:false });
});
test('gestor prepara jogo futuro, mas só inicia o jogo no dia marcado', () => {
  assert.deepEqual(acoesDaPartidaNaHome(partida(1, { data: '2026-10-19' }), true, agora), { preparar: true, iniciar: false });
  assert.deepEqual(acoesDaPartidaNaHome(partida(1), true, agora), { preparar: true, iniciar: true });
  assert.deepEqual(acoesDaPartidaNaHome(partida(1, { status: 'PREPARADA' }), true, agora), { preparar: true, iniciar: true });
});
test('gestor não recebe ações de iniciar/preparar em jogos ao vivo, encerrados ou cancelados', () => {
  for (const status of ['AO_VIVO', 'FINALIZADA', 'CANCELADA']) {
    assert.deepEqual(acoesDaPartidaNaHome(partida(1, { status }), true, agora), { preparar: false, iniciar: false });
  }
  assert.deepEqual(acoesDaPartidaNaHome(null, true, agora), { preparar: false, iniciar: false });
});
test('agenda limita a dois próximos jogos, ordena por data/hora e não repete o destaque', () => {
  const lista = [partida(4, { data: '2026-10-22' }), partida(3, { data: '2026-10-19', horario: '18:00' }),
    partida(1), partida(2, { data: '2026-10-19', horario: '10:00' })];
  const antes = JSON.stringify(lista);
  assert.equal(resumirPartidas(lista, agora).proximoJogo?.id, 1);
  assert.deepEqual(agendaDaCategoria(lista, agora).map(p => p.id), [2, 3]);
  assert.equal(JSON.stringify(lista), antes);
});
test('partida ao vivo deixa os dois próximos agendamentos disponíveis na agenda', () => {
  assert.deepEqual(agendaDaCategoria([partida(1, { status: 'AO_VIVO' }), partida(2),
    partida(3, { data: '2026-10-19', status: 'PREPARADA' })], agora).map(p => p.id), [2, 3]);
});
test('agenda não mostra partidas antigas, canceladas ou finalizadas', () => {
  assert.deepEqual(agendaDaCategoria([partida(1, { data: '2026-10-17' }),
    partida(2, { status: 'CANCELADA' }), partida(3, { status: 'FINALIZADA' })], agora), []);
  assert.deepEqual(agendaDaCategoria([partida(1)], agora), []);
  assert.deepEqual(agendaDaCategoria([], agora), []);
});
test('sequência V/E/D considera o clube selecionado, em casa e fora', () => {
  assert.equal(resultadoDoClube(partida(1, { gols_mandante: 2 })), 'V');
  assert.equal(resultadoDoClube(partida(1, { gols_mandante: 2, emCasa: false })), 'D');
  assert.equal(resultadoDoClube(partida(1, { gols_visitante: 3, emCasa: false })), 'V');
  assert.equal(resultadoDoClube(partida(1, { gols_mandante: 2, gols_visitante: 2 })), 'E');
});
