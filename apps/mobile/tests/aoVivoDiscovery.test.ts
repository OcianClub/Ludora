import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clubeParaPartida, dataPartidaDescoberta, limitesCarrossel, nomeEquipeDescoberta, partidasDisponiveis, type PartidaDescoberta } from '../src/utils/aoVivoDiscovery';
import type { ClubeListado } from '../src/services/api';

const clube = (id: number, props: Partial<ClubeListado> = {}): ClubeListado => ({
  id, nome: `Clube ${id}`, escudo: null, cidade: null, estado: null, seguidores: 0, isSeguindo: false, papel: null, ...props,
});
const jogo = (id: number, ids: number[]): PartidaDescoberta => ({
  id, clube_ids: ids, data: '2026-11-12T00:00:00.000Z', horario: '20:00', categoria: 'sub-14',
  gols_mandante: 11, gols_visitante: 11, mandante: { nome: 'Ocian sub-14' }, visitante: { nome: 'Santos' },
});

test('setas só aparecem quando há espaço real para deslizar, inclusive após redimensionar', () => {
  assert.deepEqual(limitesCarrossel(328, 328, 0), { anterior: false, proximo: false });
  assert.deepEqual(limitesCarrossel(328, 0, 0), { anterior: false, proximo: false });
  assert.deepEqual(limitesCarrossel(0, 550, 0), { anterior: false, proximo: false });
  assert.deepEqual(limitesCarrossel(328, 550, 0), { anterior: false, proximo: true });
  assert.deepEqual(limitesCarrossel(328, 550, 110), { anterior: true, proximo: true });
  assert.deepEqual(limitesCarrossel(328, 550, 222), { anterior: true, proximo: false });
  assert.deepEqual(limitesCarrossel(760, 550, 0), { anterior: false, proximo: false });
  assert.deepEqual(limitesCarrossel(328, 329, 0), { anterior: false, proximo: false });
});

test('inclui Ludora x externo e Ludora x Ludora, exclui clubes desativados e prioriza favoritos sem mudar o feed', () => {
  const original = [jogo(1, [1]), jogo(2, [2, 3]), jogo(3, [4]), jogo(4, [])];
  const clubes = [clube(1), clube(2, { isSeguindo: true }), clube(3), clube(4, { ativo: false })];
  assert.deepEqual(partidasDisponiveis(original, clubes).map(j => j.id), [2, 1]);
  assert.deepEqual(original.map(j => j.id), [1, 2, 3, 4]);
  assert.deepEqual(partidasDisponiveis(original, []), []);
});

test('abrir prioriza acesso de gestão e mantém visitante em clube ativo participante', () => {
  const partida = jogo(1, [1, 2]);
  const clubes = [clube(1), clube(2, { papel: 'TECNICO' }), clube(3, { papel: 'ADMIN' })];
  assert.equal(clubeParaPartida(partida, clubes, 1)?.id, 2);
  assert.equal(clubeParaPartida(partida, [clube(1, { papel: 'ADMIN' }), clubes[1]], 1)?.id, 1);
  assert.equal(clubeParaPartida(partida, [clube(1), clube(2)], 2)?.id, 2);
  assert.equal(clubeParaPartida(partida, [clube(1, { ativo: false }), clube(3)], 1), undefined);
  assert.equal(clubeParaPartida(jogo(2, [1]), clubes)?.id, 1);
});

test('data de calendário não recua um dia no Brasil; nomes legados não repetem o SUB', () => {
  assert.equal(dataPartidaDescoberta('2026-11-12T00:00:00.000Z', '20:00'), '12 de nov · 20:00');
  assert.equal(dataPartidaDescoberta('2026-01-01', null), '1 de jan');
  assert.equal(dataPartidaDescoberta('', null), 'Data a confirmar');
  assert.equal(nomeEquipeDescoberta('Ocian sub-14'), 'Ocian');
  assert.equal(nomeEquipeDescoberta('Santos (sub-7)'), 'Santos');
  assert.equal(nomeEquipeDescoberta('A. União Mauá · TESTE'), 'A. União Mauá · TESTE');
});
