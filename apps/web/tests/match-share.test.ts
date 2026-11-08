import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GestaoPartida } from '../src/services/sharedMatches';
import { matchShareModel } from '../src/utils/matchShare';
import { recordHighlights } from '../src/utils/matchHighlights';

function fixture() {
  return {
    partida: { id: 10, mandante_id: 1, visitante_id: 2, mandante: { nome: 'Ocian' }, visitante: { nome: 'Santos' }, gols_mandante: 5, gols_visitante: 1, data: '2026-11-07', horario: '19:30', categoria: { nome: 'sub-7' } },
    equipes: [
      { time_id: 1, publicada_em: '2026-11-07', escalacao: [{ jogador_id: 10, numCamisa: 1, jogador: { nome: 'Gabriel' } }] },
      { time_id: 2, publicada_em: '2026-11-07', escalacao: [{ jogador_id: 20, numCamisa: 2, jogador: { nome: 'Luiz' } }] },
    ],
    eventos: [
      { id: 1, tipo: 'GOL', time_id: 1, jogador_id: 10, periodo: 1 },
      { id: 2, tipo: 'GOL', time_id: 1, jogador_id: 10, periodo: 2 },
      { id: 3, tipo: 'GOL', time_id: 1, jogador_id: 20, gol_contra: true, periodo: 2 },
      { id: 4, tipo: 'GOL', time_id: 1, jogador: { nome: 'Nome avulso' }, periodo: 2 },
      { id: 5, tipo: 'DEFESA', time_id: 2, jogador_id: 20, periodo: 1 },
    ],
  } as unknown as GestaoPartida;
}
test('imagem usa placar da súmula, sem nomes por padrão, mesmo após correções sem eventos', () => {
  const model = matchShareModel(fixture());
  assert.equal(model.outcome, 'Vitória do Ocian!');
  assert.deepEqual(model.teams.map(team => team.score), [5, 1]);
  assert.doesNotMatch(JSON.stringify(model), /Gabriel|Luiz|Nome avulso/);
  assert.ok(model.teams.every(team => !team.goals.length));
});
test('autoria publicada agrupa gols, separa contra e não inventa autores', () => {
  const model = matchShareModel(fixture(), true);
  assert.deepEqual(model.teams[0].goals, [
    { name: 'Gabriel', count: 2, own: false }, { name: 'Luiz', count: 1, own: true },
    { name: 'Jogador não identificado', count: 1, own: false },
  ]);
  assert.equal(model.metrics.find(metric => metric.label === 'Defesas')?.values[1], 1);
});
test('rascunhos são privados e time externo não ganha jogador fictício', () => {
  const data = fixture(); data.equipes[0].publicada_em = null;
  const model = matchShareModel(data, true);
  assert.doesNotMatch(JSON.stringify(model), /Gabriel/);
  data.equipes = [];
  assert.ok(matchShareModel(data, true).teams[0].goals.every(goal => goal.name === 'Gol da equipe'));
});
test('empate, zeros e anotações da federação mantêm seu significado', () => {
  const data = fixture(); data.eventos = []; data.partida.gols_mandante = 0; data.partida.gols_visitante = 0;
  data.paulista = {} as GestaoPartida['paulista'];
  const model = matchShareModel(data, true);
  assert.match(model.outcome, /Empate/); assert.equal(model.winnerId, undefined);
  assert.equal(model.title, 'Placar anotado pelo clube');
  assert.equal(model.annotation, true);
  assert.ok(model.metrics.every(metric => metric.values.every(value => value === 0)));
});
test('destaques preservam empates, separam defesas e não expõem nomes quando desligados', () => {
  const data = fixture();
  data.eventos.push({ id: 8, tipo: 'GOL', time_id: 2, jogador_id: 20, periodo: 1 }, { id: 9, tipo: 'GOL', time_id: 2, jogador_id: 20, periodo: 2 });
  assert.equal(recordHighlights(data,null).attack.length,2);
  assert.equal(recordHighlights(data,1).attack.length,2);
  assert.equal(recordHighlights(data,1).saves[0].name,'Luiz');
  const hidden = matchShareModel(data,false,true);
  assert.doesNotMatch(JSON.stringify(hidden),/Gabriel|Luiz|meuVoto|torcida/);
  assert.equal(hidden.highlights.length,2);
  assert.equal(hidden.highlights[0].players.length,2);
  assert.match(JSON.stringify(hidden),/Camisa 01/);
  assert.match(JSON.stringify(matchShareModel(data,true,true)),/Gabriel|Luiz/);
  assert.equal(matchShareModel(data,true,false).highlights.length,0);
  data.equipes[0].publicada_em=null;
  assert.doesNotMatch(JSON.stringify(matchShareModel(data,true,true).highlights),/Gabriel/,'Rascunho não entra nos destaques');
});
