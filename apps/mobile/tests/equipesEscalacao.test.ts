import assert from 'node:assert/strict';
import { test } from 'node:test';
import { equipesEscalacao, equipeEscalacaoVisivel } from '../src/utils/equipesEscalacao';
import type { EquipePartida, GestaoPartida } from '../src/services/partidasCompartilhadas';

const ocian: EquipePartida = { id: 1, clube_id: 10, categoria_id: 1, time_id: 100, pronta: true, publicada_em: '2026-11-10', clube: { id: 10, nome: 'Ocian' }, categoria: { id: 1, nome: 'SUB-7' }, escalacao: [] };
const santos: EquipePartida = { ...ocian, id: 2, clube_id: 20, time_id: 200, clube: { id: 20, nome: 'Santos' } };
const partida = { mandante_id: 100, visitante_id: 200 } as GestaoPartida['partida'];

test('dois clubes Ludora aparecem em ordem mandante e visitante, independente da resposta', () => {
  const equipes = equipesEscalacao({ partida, equipes: [santos, ocian] });
  assert.deepEqual(equipes.map(e => e.clube.nome), ['Ocian', 'Santos']);
  assert.equal(equipeEscalacaoVisivel(equipes, null, santos.id), santos);
  assert.equal(equipeEscalacaoVisivel(equipes, ocian.time_id, santos.id), ocian);
  assert.equal(equipeEscalacaoVisivel(equipes, santos.time_id, santos.id), santos);
});

test('Ludora como visitante contra externo só disponibiliza a própria escalação', () => {
  const equipes = equipesEscalacao({ partida, equipes: [santos] });
  assert.deepEqual(equipes, [santos]);
  assert.equal(equipeEscalacaoVisivel(equipes, ocian.time_id), santos);
});

test('Ludora como mandante contra externo mantém apenas o mandante', () => {
  assert.deepEqual(equipesEscalacao({ partida, equipes: [ocian] }), [ocian]);
});

test('equipe não publicada permanece no seletor sem criar jogadores nem publicar rascunho', () => {
  const naoPublicada = { ...santos, pronta: false, publicada_em: null, escalacao: [] };
  const equipes = equipesEscalacao({ partida, equipes: [ocian, naoPublicada] });
  assert.equal(equipes.length, 2);
  assert.equal(equipeEscalacaoVisivel(equipes, santos.time_id)?.publicada_em, null);
  assert.deepEqual(naoPublicada.escalacao, []);
});

test('atualização preserva seleção pelo time e remove seleção que já não existe', () => {
  const atualizada = { ...santos, escalacao: [{ jogador_id: 5, titular: true, numCamisa: 1 }] };
  assert.equal(equipeEscalacaoVisivel([ocian, atualizada], santos.time_id), atualizada);
  assert.equal(equipeEscalacaoVisivel([ocian], santos.time_id), ocian);
  assert.equal(equipeEscalacaoVisivel([], santos.time_id), undefined);
});
