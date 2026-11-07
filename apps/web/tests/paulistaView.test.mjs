import assert from 'node:assert/strict';
import { test } from 'node:test';
import { caminhoPublicado, chavePublicada, resumoClube, estadoJogo, temResultado, nomeOficial, situacaoPublicacao, estadoCampanha } from '../src/utils/paulistaView.ts';
const jogo = (id, faseId, fase, home, away, date, a = 2, b = 0) => ({ id, faseId, fase, mandanteId: home, visitanteId: away, data: date, horario: '09:00', local: 'Arena', golsMandante: a, golsVisitante: b, ocorrencia: null, sumulaId: null });
const base = () => ({ id: 1, ano: 2026, titulo: 'Paulista', categoria: 'Sub-7', divisao: 'A2', fonte: 'https://eventos.admfutsal.com.br/evento/1', equipes: [], jogos: [], classificacao: [], avisos: [], fasesExcluidas: [] });

test('Paulista web: operação local informa estado futuro; resultado oficial numérico mantém finalizada', () => {
  const future = jogo('next', '10', 'CLASSIFICAÇÃO', 1, 2, '2026-12-01', null, null);
  for (const status of ['AGENDADA', 'PREPARADA', 'AO_VIVO', 'CANCELADA']) assert.equal(situacaoPublicacao(future, status), status);
  assert.equal(situacaoPublicacao(future), 'AGENDADA');
  assert.equal(situacaoPublicacao({ ...future, golsMandante: 0, golsVisitante: 0 }, 'AO_VIVO'), 'FINALIZADA');
});
test('Paulista web: posição não inventa medalha; chave exige publicação', () => {
  const s = base(); s.classificacao.push({ equipeId: 1, fase: 'FASE DE CLASSIFICAÇÃO', faseId: '10', grupo: 'CHAVE A', posicao: 18, pontos: 8, saldo: -4 });
  assert.deepEqual(resumoClube(s, new Set([1]), '2026-11-06').chaves, []);
  s.jogos.push(jogo('q', '11', 'QUARTAS DE FINAIS - PRATA', 1, 2, '2026-09-06'));
  assert.deepEqual(resumoClube(s, new Set([1]), '2026-11-06').chaves, ['PRATA']);
  assert.equal(chavePublicada('Ouro, Prata e Bronze'), null);
});
test('Paulista web: ausente, adiado, W.O., próxima partida e último resultado', () => {
  const s = base(), ended = jogo('old', '10', 'FASE DE CLASSIFICAÇÃO', 1, 2, '2026-10-01');
  const future = jogo('future', '10', 'FASE DE CLASSIFICAÇÃO', 2, 1, '2026-11-10', null, null);
  const postponed = { ...future, id: 'postponed', data: '2026-11-08', ocorrencia: 'ADIADA' };
  s.jogos = [postponed, ended, future];
  assert.equal(resumoClube(s, new Set([1]), '2026-11-06').proxima.id, 'future');
  assert.equal(resumoClube(s, new Set([1]), '2026-11-06').ultimo.id, 'old');
  assert.equal(temResultado(future), false); assert.match(estadoJogo(postponed), /Adiada/);
  assert.equal(temResultado({ ...ended, golsMandante: 0, golsVisitante: 0 }), true);
  assert.equal(temResultado({ ...ended, ocorrencia: 'WO' }), false);
});
test('Paulista web: agrupa títulos sem unir IDs; não inventa futuro, desempate ou agregado', () => {
  const s = base(); s.jogos = [jogo('q1', '11', 'QUARTAS DE FINAIS - PRATA', 1, 2, '2026-09-01'), jogo('q2', '12', 'QUARTAS DE FINAIS - PRATA', 3, 4, '2026-09-01'), jogo('s', '13', 'SEMIFINAL PRATA', 1, 3, '2026-09-10')];
  const c = caminhoPublicado(s, 'PRATA');
  assert.equal(c.colunas[0].jogos.length, 2); assert.deepEqual(c.colunas[0].jogos.map(j => j.faseId), ['11', '12']);
  assert.equal(c.conexoes.length, 2); assert.equal(c.colunas.length, 2);
  s.jogos[0].golsVisitante = 2; assert.equal(caminhoPublicado(s, 'PRATA').conexoes.length, 1);
  s.jogos.push({ ...s.jogos[1], id: 'ida-volta', faseId: '14', mandanteId: 4, visitanteId: 3 });
  assert.equal(caminhoPublicado(s, 'PRATA').conexoes.length, 0);
});
test('Paulista web: ambiguidade não vira linha e outras chaves ficam fora', () => {
  const s = base(); s.jogos = [jogo('q', '1', 'QUARTAS PRATA', 1, 2, '2026-09-01'), jogo('s1', '2', 'SEMIFINAL PRATA', 1, 3, '2026-09-10'), jogo('s2', '3', 'SEMIFINAL PRATA', 1, 4, '2026-09-10'), jogo('gold', '4', 'FINAL OURO', 5, 6, '2026-09-20')];
  assert.equal(caminhoPublicado(s, 'PRATA').conexoes.length, 0);
  assert.ok(caminhoPublicado(s, 'PRATA').colunas.every(c => c.jogos.every(j => j.id !== 'gold')));
});
test('Paulista web: nomes só para exibição, preservando marcas legítimas', () => {
  assert.equal(nomeOficial('GR GREMETAL sub-7'), 'Gr Gremetal');
  for (const nome of ['Submarino FC', 'ClubSub12', 'McDonald FC']) assert.equal(nomeOficial(nome), nome);
});

test('Paulista web: eliminação exige vencedor corroborado na próxima etapa publicada', () => {
  const s = base();
  assert.match(estadoCampanha(s, new Set([1])), /Classificação/);
  s.jogos = [jogo('q', '11', 'QUARTAS - PRATA', 1, 2, '2026-09-01', 0, 1), jogo('s', '12', 'SEMIFINAL PRATA', 2, 3, '2026-09-10')];
  assert.match(estadoCampanha(s, new Set([1])), /Eliminado/);
  s.jogos[0].golsMandante = 1;
  assert.match(estadoCampanha(s, new Set([1])), /Eliminatórias/);
});
