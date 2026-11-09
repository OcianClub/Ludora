import assert from 'node:assert/strict';
import { test } from 'node:test';
import { caminhoPublicado, chavePublicada, etapaPublicada, layoutChaveamento } from '../src/utils/paulistaBracket.ts';
import { subscribePaulistaUpdates } from '../src/services/paulistaRealtime.ts';

const game = (id, fase, home, away, a = 2, b = 0, data = '2026-09-05') => ({ id, faseId: fase, fase, mandanteId: home, visitanteId: away, golsMandante: a, golsVisitante: b, data, horario: '09:00', local: null, sumulaId: null, ocorrencia: null });
const graph = jogos => caminhoPublicado({ jogos }, 'PRATA');
const q = game('q', 'QUARTA DE FINAL PRATA', 1, 2);
const semi = game('s', 'SEMIFINAIS PRATA', 1, 3, 1, 0, '2026-09-12');

test('formas publicadas de fases, Rubi e erro BRONE não viram fases erradas', () => {
  for (const name of ['QUARTA DE FINAL', 'quarta e final bronze', 'QUARTAS DE FINAIS']) assert.equal(etapaPublicada(name), 1);
  assert.equal(etapaPublicada('SEMIFINAL RUBI'), 2);
  assert.equal(etapaPublicada('FINAL PRATA'), 3);
  assert.equal(etapaPublicada('FASE CLASSIFICAÇÃO'), -1);
  assert.equal(chavePublicada('QUARTA E FINAL BRONE'), 'BRONZE');
  assert.equal(chavePublicada('FINAL RUBI'), 'RUBI');
  assert.equal(chavePublicada('Ouro / Prata'), null);
});
test('empate exige uma única equipe comprovada na próxima etapa; não usa desempate inventado', () => {
  const draw = { ...q, golsVisitante: 2 };
  assert.deepEqual(graph([draw, semi]).conexoes, [{ de: 'q', para: 's', equipeId: 1, empate: true }]);
  assert.equal(graph([draw]).conexoes.length, 0);
  assert.equal(graph([draw, semi, game('s2', 'SEMIFINAIS PRATA', 2, 4, 0, 1, '2026-09-12')]).conexoes.length, 0);
  const duplicate = game('s3', 'SEMIFINAIS PRATA', 2, 5, 0, 1, '2026-09-12');
  assert.equal(graph([draw, semi, duplicate, { ...duplicate, id: 's4' }]).conexoes.length, 0);
});
test('W.O., jogos sem placar, adiados e destinos anteriores não comprovam avanço', () => {
  for (const change of [{ ocorrencia: 'WO' }, { ocorrencia: 'ADIADA' }, { golsMandante: null }, { data: null }]) assert.equal(graph([{ ...q, ...change }, semi]).conexoes.length, 0);
  assert.equal(graph([q, { ...semi, data: '2026-09-01' }]).conexoes.length, 0);
});
test('resultado divergente e finais duplicadas bloqueiam conexões e mostram diagnóstico', () => {
  const g = graph([q, { ...semi, mandanteId: 2 }]);
  assert.equal(g.conexoes.length, 0); assert.ok(g.avisos.some(a => a.tipo === 'conflito'));
  const final = game('f', 'FINAL PRATA', 1, 4, null, null, '2026-12-31'); final.horario = '00:00';
  const c = graph([q, semi, final, { ...final, id: 'f2', visitanteId: 5, data: '2026-09-20', golsMandante: 2, golsVisitante: 1 }]);
  assert.equal(c.conexoes.filter(e => e.para.startsWith('f')).length, 0);
  assert.ok(c.avisos.some(a => a.tipo === 'agenda'));
  assert.ok(c.avisos.some(a => a.tipo === 'conflito'));
});
test('IDs repetidos não duplicam nós; partidas de ida e volta não são eliminatória simples', () => {
  const duplicate = graph([q, { ...q }, semi]);
  assert.equal(duplicate.colunas[0].jogos.length, 1); assert.equal(duplicate.conexoes.length, 0);
  assert.ok(duplicate.avisos.some(a => /Identificador/.test(a.mensagem)));
  assert.equal(graph([q, { ...q, id: 'volta', mandanteId: 2, visitanteId: 1 }, semi]).conexoes.length, 0);
});
test('fases futuras são avisos sem equipes, partidas falsas, vagas ou conexões calculadas', () => {
  const c = graph([q]);
  assert.deepEqual(c.colunas.map(c => [c.etapa, c.futura, c.jogos.length]), [[1, false, 1], [2, true, 0], [3, true, 0]]);
  assert.deepEqual(c.conexoes, []);
  assert.deepEqual(graph([]).colunas, []);
});
test('bye não cria quarto de final; nomes desconhecidos não recebem setas', () => {
  const ruby = caminhoPublicado({ jogos: [game('s', 'SEMIFINAL RUBI', 1, 3), game('f', 'FINAL RUBI', 1, 4, 2, 1, '2026-09-20')] }, 'RUBI');
  assert.equal(ruby.colunas.length, 2); assert.equal(ruby.conexoes.length, 1);
  assert.equal(graph([game('unknown', 'REPESCAGEM PRATA', 1, 2), semi]).conexoes.length, 0);
});
test('layout é estável sob reordenação de resposta e atualização de placares sem mudar avanços', () => {
  const games = [q, game('q2', q.fase, 3, 4), semi];
  const a = layoutChaveamento(graph(games)), b = layoutChaveamento(graph([...games].reverse()));
  assert.deepEqual(a, b);
  assert.deepEqual(layoutChaveamento(graph(games.map(j => ({ ...j, golsMandante: 9, golsVisitante: 0 })))), a);
  const nodes = a.posicoes; const y = id => nodes.find(n => n.id === id).y;
  assert.equal(y('s'), (y('q') + y('q2')) / 2);
  assert.ok(Math.abs(y('q') - y('q2')) >= 162);
});
test('evento de sincronização filtra campeonato, não duplica primeira carga e limpa inscrição', () => {
  const handlers = new Map(); let refresh = 0, disconnected = false;
  const fake = (_url, options) => { assert.equal(options.auth.clubeId, 2); return { on: (name, cb) => handlers.set(name, cb), removeAllListeners: () => handlers.clear(), disconnect: () => { disconnected = true; } }; };
  const stop = subscribePaulistaUpdates('https://api.example', 'test-token', 2, '900', () => refresh++, fake);
  handlers.get('connect')(); assert.equal(refresh, 0);
  for (const payload of [null, {}, { eventoId: 919 }]) handlers.get('paulista_atualizado')(payload);
  assert.equal(refresh, 0);
  handlers.get('paulista_atualizado')({ eventoId: 900 }); assert.equal(refresh, 1);
  handlers.get('connect')(); assert.equal(refresh, 2);
  stop(); assert.equal(handlers.size, 0); assert.ok(disconnected);
});

// Smaller desktop cards must keep connectors anchored to the same confirmed fixtures.
test('layout compacto preserva avanço e evita sobreposição entre os confrontos', () => {
 const caminho = graph([q, game('q2', q.fase, 3, 4), semi]);
 const full = layoutChaveamento(caminho), compact = layoutChaveamento(caminho, 136);
 const node = id => compact.posicoes.find(n => n.id === id);
 assert.equal(node('s').y, (node('q').y + node('q2').y) / 2);
 assert.ok(Math.abs(node('q').y-node('q2').y)>=136);
 assert.ok(compact.altura < full.altura);
 assert.deepEqual(compact.posicoes.map(n=>n.id),full.posicoes.map(n=>n.id));
});
