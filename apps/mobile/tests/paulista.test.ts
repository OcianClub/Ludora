import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paulistaFixture } from './paulista.fixture';
import { campanhaPublicada, chavesDasEquipes, classificacaoProxima, eventoDaSelecao, faixasPublicadas, fonteOficialValida, resumoClube, snapshotDoClube } from '../src/utils/paulista';
import { campanhaPublicada as campanhaWeb } from '../../web/src/utils/paulistaOverview';
import { chavesDasEquipes as chavesWeb } from '../../web/src/utils/paulistaStandings';

test('Web e Mobile usam as mesmas funções de classificação e campanha', () => {
  assert.equal(campanhaPublicada, campanhaWeb);
  assert.equal(chavesDasEquipes, chavesWeb);
});
test('temporada e SUB não recebem dados de outra seleção como fallback', () => {
  const eventos = paulistaFixture();
  assert.equal(eventoDaSelecao(eventos, 2026, 'sub-7')?.id, 900);
  assert.equal(eventoDaSelecao(eventos, 2025, 'SUB 7')?.id, 800);
  assert.equal(eventoDaSelecao(eventos, 2026, 'SUB-8')?.id, 901);
  assert.equal(eventoDaSelecao(eventos, 2026, 'SUB-12'), undefined);
  assert.equal(eventoDaSelecao(eventos, 2024, 'SUB-7'), undefined);
});
test('identidade local não altera a publicação, os pontos, a ordem ou os resultados oficiais', () => {
  const evento = paulistaFixture()[0], before = structuredClone(evento);
  const snapshot = snapshotDoClube(evento, { id: 4, nome: 'Ocian', escudo: 'https://test/ocian.png' });
  const minhas = new Set(evento.equipesClube), resumo = resumoClube(snapshot, minhas, '2026-11-11');
  assert.equal(snapshot.equipes.find(e => e.id === 12)?.nome, 'Ocian');
  assert.deepEqual(snapshot.classificacao, evento.classificacao);
  assert.deepEqual(snapshot.jogos, evento.jogos);
  assert.equal(resumo.classificacao?.posicao, 12);
  assert.equal(resumo.classificacao?.pontos, 33);
  assert.equal(campanhaPublicada(snapshot, minhas, 'PRATA').titulo, 'Eliminado na semifinal');
  assert.equal(classificacaoProxima(snapshot, resumo.classificacao).total, 24);
  assert.equal(chavesDasEquipes(snapshot).get(12), 'PRATA');
  assert.deepEqual(faixasPublicadas(snapshot.classificacao, chavesDasEquipes(snapshot)), [{ chave:'OURO',inicio:1,fim:8 },{ chave:'PRATA',inicio:9,fim:16 },{ chave:'BRONZE',inicio:17,fim:24 }]);
  assert.deepEqual(evento, before);
});
test('a posição não atribui chave quando as eliminatórias ainda não estão publicadas', () => {
  const snapshot = snapshotDoClube(paulistaFixture()[1], { id: 4, nome: 'Ocian' });
  assert.equal(chavesDasEquipes(snapshot).size, 0);
  assert.deepEqual(faixasPublicadas(snapshot.classificacao, chavesDasEquipes(snapshot)), []);
  assert.equal(campanhaPublicada(snapshot, new Set([12])).eliminado, false);
});
test('fonte oficial não aceita esquemas locais ou endereços de terceiros', () => {
  assert.equal(fonteOficialValida('https://eventos.admfutsal.com.br/evento/900'), true);
  for (const fonte of [undefined, 'file:///', 'javascript:alert(1)', 'https://eventos.admfutsal.com.br.evil.test/evento/900', 'https://example.com/evento/900']) assert.equal(fonteOficialValida(fonte), false);
});
