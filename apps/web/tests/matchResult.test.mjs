import test from 'node:test';
import assert from 'node:assert/strict';
import { matchWinner, matchResultText } from '../src/utils/matchResult.ts';

const data = {
  partida: {
    mandante_id: 10, visitante_id: 20, gols_mandante: 2, gols_visitante: 1,
    mandante: { nome: 'Ocian' }, visitante: { nome: 'Santos' }, categoria: { nome: 'sub-7' },
    data: '2026-10-30T00:00:00Z', horario: '19:30',
  },
  equipes: [{ time_id: 10, escalacao: [{ jogador_id: 1, jogador: { nome: 'Gabriel' } }] }, { time_id: 20, escalacao: [] }],
  eventos: [
    { id: 2, tipo: 'GOL', time_id: 10, gol_contra: true, jogador_id: 2, jogador: { nome: 'Luiz' }, periodo: 2 },
    { id: 1, tipo: 'GOL', time_id: 10, jogador_id: 1, periodo: 1, minuto: 4 },
    { id: 3, tipo: 'GOL', time_id: 20, periodo: 2 },
  ],
};

test('resultado usa o placar oficial, identifica vencedor e empate', () => {
  assert.deepEqual(matchWinner(data), { id: 10, name: 'Ocian' });
  const awayWin = { ...data, partida: { ...data.partida, gols_visitante: 4 } };
  assert.deepEqual(matchWinner(awayWin), { id: 20, name: 'Santos' });
  const draw = { ...data, partida: { ...data.partida, gols_visitante: 2 } };
  assert.equal(matchWinner(draw), null);
  assert.match(matchResultText(draw), /Empate/);
});

test('texto sem nomes omite os jogadores e preserva confronto, data e categoria', () => {
  const text = matchResultText(data);
  assert.match(text, /Ocian 2 × 1 Santos/);
  assert.match(text, /30\/10\/2026/);
  assert.match(text, /SUB-7/);
  assert.doesNotMatch(text, /Gabriel|Luiz|Acontecimentos/);
});

test('nomes incluem lances na ordem, autoria do gol contra e pendências sem inventar autor', () => {
  const text = matchResultText(data, true);
  assert.match(text, /Gol: Gabriel/);
  assert.match(text, /Gol contra: Luiz · ponto para Ocian/);
  assert.match(text, /Jogador não identificado · Santos/);
  assert.ok(text.indexOf('Gabriel') < text.indexOf('Luiz'));
});

test('funciona para equipe externa e partida sem eventos', () => {
  const noEvents = { ...data, equipes: [], eventos: [] };
  assert.doesNotMatch(matchResultText(noEvents, true), /Acontecimentos|undefined|null/);
  const external = { ...data, equipes: [], eventos: [data.eventos[2]] };
  assert.match(matchResultText(external, true), /Gol: Equipe externa · Santos/);
  assert.doesNotMatch(matchResultText(external, true), /Jogador não identificado/);
});
