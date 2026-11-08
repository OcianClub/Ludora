import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GestaoPartida } from '../src/services/sharedMatches';
import { matchInsights } from '../src/utils/matchInsights';

function fixture() {
  const p = (id: number) => ({ jogador_id: id, numCamisa: id, jogador: { nome: `Atleta ${id}` } });
  const data = {
    partida: { mandante_id: 10, visitante_id: 20, gols_mandante: 9, gols_visitante: 1, mandante: { nome: 'Ocian' }, visitante: { nome: 'Santos' } },
    equipes: [ { time_id: 10, publicada_em: '2026-11-07', escalacao: [p(1), p(2), p(3)] }, { time_id: 20, publicada_em: '2026-11-07', escalacao: [p(4)] } ],
    eventos: [
      { tipo: 'GOL', time_id: 10, jogador_id: 1, periodo: 1 }, { tipo: 'GOL', time_id: 10, jogador_id: 2, periodo: 2 },
      { tipo: 'ASSISTENCIA', time_id: 10, jogador_id: 1, periodo: 1 }, { tipo: 'ASSISTENCIA', time_id: 10, jogador_id: 2, periodo: 2 },
      { tipo: 'GOL', time_id: 10, jogador_id: 4, gol_contra: true, periodo: 1 },
      { tipo: 'GOL', time_id: 10, periodo: 2 }, { tipo: 'DEFESA', time_id: 10, jogador_id: 3, periodo: 1 },
      { tipo: 'FALTA', time_id: 10, jogador_id: 1, periodo: 1 }, { tipo: 'CARTAO_AZUL', time_id: 20, jogador_id: 4, periodo: 2 },
    ],
  } as unknown as GestaoPartida;
  return data;
}
test('comparativo usa placar oficial em Todos; por tempo conta eventos e respeita gols contra', () => {
  const data = fixture(), all = matchInsights(data, null), first = matchInsights(data, 1), second = matchInsights(data, 2);
  assert.equal(all[0].totals.GOL, 9); assert.equal(first[0].totals.GOL, 2); assert.equal(second[0].totals.GOL, 2);
  assert.equal(first[0].totals.FALTA, 1); assert.equal(second[0].totals.FALTA, 0); assert.equal(second[1].totals.CARTAO_AZUL, 1);
  assert.equal(all[1].attack.length, 0); assert.equal(all[0].unidentified, 1);
});
test('ataque usa gols + 0,6 assist., mantém empates e separa defesas sem nota geral', () => {
  const data = fixture(), all = matchInsights(data, null);
  assert.deepEqual(all[0].attack.map(p => p.id), [1, 2]); assert.equal(all[0].attack[0].attack, 8);
  assert.deepEqual(all[0].saves.map(p => p.id), [3]);
  assert.deepEqual(matchInsights(data, 1)[0].attack.map(p => p.id), [1]);
  assert.equal(matchInsights(data, 2)[0].saves.length, 0);
});
test('não revela rascunho nem atribui destaques a time externo; zeros não elegem jogador', () => {
  const data = fixture(); data.equipes[0].publicada_em = null; data.equipes.pop();
  const teams = matchInsights(data, null);
  assert.equal(teams[0].attack.length, 0); assert.equal(teams[0].published, false); assert.equal(teams[1].registered, false);
  data.eventos = []; data.equipes[0].publicada_em = '2026-11-07';
  assert.equal(matchInsights(data, null)[0].attack.length, 0);
});
