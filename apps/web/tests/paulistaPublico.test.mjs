import assert from 'node:assert/strict';
import { test } from 'node:test';
import { painelPaulistaPublico } from '../src/utils/paulistaPublico.ts';
import { painelDaSelecao, resumoClube } from '../src/utils/paulistaView.ts';

const evento = () => ({ id: 925, ano: 2026, categoria: 'SUB-7', divisao: 'A2', fonte: 'https://eventos.admfutsal.com.br/evento/925',
  equipes: [{ id: 20, nome: 'OCIAN PRAIA CLUBE', escudo: null }, { id: 30, nome: 'SANTOS', escudo: null }],
  equipesClube: [20], verificadoEm: '2026-11-10T12:00:00Z', fasesExcluidas: ['Fase não homologada'],
  jogos: [{ id: 'q', faseId: '1', fase: 'QUARTAS PRATA', mandanteId: 20, visitanteId: 30, data: '2026-09-01', horario: '19:30', local: 'Arena', golsMandante: 3, golsVisitante: 1, ocorrencia: null, sumulaId: 123 }],
  classificacao: [{ faseId: '0', fase: 'CLASSIFICAÇÃO', grupo: 'CHAVE ÚNICA', equipeId: 20, posicao: 12, pontos: 33, jogos: 23, vitorias: 10, empates: 3, derrotas: 10, golsPro: 74, golsContra: 59, saldo: 15 }],
});

test('consulta pública preserva publicação, chave, classificação e limita o clube selecionado', () => {
  const e = evento(), antes = structuredClone(e);
  const painel = painelPaulistaPublico(e, { id: 2, nome: 'Ocian', escudo: '/ocian.svg' });
  assert.equal(painelDaSelecao(painel, e, 2), true);
  assert.equal(painelDaSelecao(painel, e, 3), false);
  assert.deepEqual(painel.snapshot.jogos, e.jogos);
  assert.deepEqual(painel.snapshot.classificacao, e.classificacao);
  assert.deepEqual(painel.snapshot.fasesExcluidas, e.fasesExcluidas);
  assert.deepEqual(e, antes, 'publicação original permanece intacta');
  assert.deepEqual(resumoClube(painel.snapshot, new Set([20]), '2026-11-10').chaves, ['PRATA']);
});

test('adaptador público ignora campos operacionais e nunca vincula súmula editável', () => {
  const p = painelPaulistaPublico({ ...evento(), pendencias: [{ dados: 'privado' }], retroativos: ['privado'], jogosLocais: [{ id: 'q', partidaId: 50 }], segredo: 'privado' }, { id: 2, nome: 'Ocian' });
  assert.deepEqual(p.jogosLocais, []);
  assert.deepEqual(p.pendencias, []);
  assert.deepEqual(p.retroativos, []);
  assert.doesNotMatch(JSON.stringify(p), /privado|segredo/);
});

test('vínculo estranho à publicação não habilita visualização de outro evento', () => {
  const e = { ...evento(), equipesClube: [999] };
  const p = painelPaulistaPublico(e, { id: 2, nome: 'Ocian' });
  assert.equal(painelDaSelecao(p, e, 2), false);
});
