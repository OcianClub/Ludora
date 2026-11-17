import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adversariosRecentes, atalhosDataPartida, repetirConfronto } from '../src/utils/matchOrganization.ts';

const categorias = [{ id: 1, nome: 'SUB-7', tipo: 'INICIACAO', clube_id: 2 }];
const times = [{ id: 10, nome: 'Ocian', categoria_id: 1, clube_representado_id: 2 }, { id: 20, nome: 'Santos', categoria_id: 1, clube_representado_id: 3 }, { id: 30, nome: 'Externo', categoria_id: 1 }];
const competicoes = [{ id: 1, nome:'Copa', ano:2026, tipo: 'INICIACAO', clube_id: 2 }];
const jogo = { categoria_id: 1, mandante_id: 10, visitante_id: 20, mandante: times[0], visitante: times[1], competicao_id: 1, data: '2020-01-01', horario: '18:30', local: 'Ginásio', emCasa: true };

test('novo confronto mantém mando e dados úteis, mas nunca reaproveita data ou rodada', () => {
  const novo = repetirConfronto(jogo, times, categorias, competicoes, 2);
  assert.equal(novo.data, ''); assert.equal(novo.rodada, ''); assert.equal(novo.horario, '18:30'); assert.equal(novo.local, 'Ginásio');
  assert.equal(novo.competicao_id, '1'); assert.equal(novo.emCasa, 'true'); assert.equal(novo.visitante_id, '20');
  const fora = repetirConfronto({ ...jogo, mandante: times[1], visitante: times[0], mandante_id: 20, visitante_id: 10, emCasa: false }, times, categorias, competicoes, 2);
  assert.equal(fora.emCasa, 'false'); assert.equal(fora.visitante_id, '10');
});
test('repetição resolve equipes e categorias compartilhadas e recusa dados arquivados', () => {
  const externo = { ...jogo, categoria_id: 99, categoria: { ...categorias[0], id: 99, clube_id: 3 }, visitante: { ...times[1], id: 999 } };
  assert.equal(repetirConfronto(externo, times, categorias, competicoes, 2)?.visitante_id, '20');
  assert.equal(repetirConfronto(jogo, times.map(t => t.id === 20 ? { ...t, arquivado: true } : t), categorias, competicoes, 2), null);
  assert.equal(repetirConfronto(jogo, times, [], competicoes, 2), null);
  assert.equal(repetirConfronto(jogo, [...times, { ...times[0], id: 100 }], categorias, competicoes, 2), null);
  assert.equal(repetirConfronto(jogo, times, categorias, [{ ...competicoes[0], paulista_evento_id: 1 }], 2)?.competicao_id, 'amistoso');
  assert.equal(repetirConfronto(jogo, times, categorias, [{ ...competicoes[0], arquivada: true }], 2)?.competicao_id, 'amistoso');
});
test('recentes usam identidade do clube, eliminam duplicados e não confundem IDs antigos', () => {
  assert.deepEqual(adversariosRecentes({ recentes: [{ timeId: 30, clubeId: 3, nome: 'Santos', data: '2026-11-15' }, { timeId: 999, clubeId: 3, nome: 'Santos', data: '2026-11-14' }], ultimoLocalCasa: null }, times, 1, 2), [20]);
});
test('datas rápidas respeitam virada do ano e próximo sábado sem depender do fuso', () => {
  assert.deepEqual(atalhosDataPartida('2026-12-31').map(d => d.value), ['2026-12-31', '2027-01-01', '2027-01-02']);
  assert.equal(atalhosDataPartida('2026-11-21')[2].value, '2026-11-28');
  assert.deepEqual(atalhosDataPartida('inválida'), []);
});

