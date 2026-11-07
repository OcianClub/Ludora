import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extrairEquipes, interpretarEvento, normalizar, inteiroFonte } from '../src/modules/paulista/provider';
import { diferencas, nomeTime, rankingCalculado, sugestoes, verificarContinuidade } from '../src/modules/paulista/rules';
export const teamsHtml = '<a href="/evento/900/equipe/1"><p>Harbor FC</p></a><a href="/evento/900/equipe/2"><p>Coastal FC</p></a>';
export function fixture({ data = '21/03', result = '1 x 1', phase = 'FASE DE CLASSIFICAÇÃO', phaseId = '10', extra = '', wo = false } = {}) {
  return `<h5>Campeonato Paulista, Temporada 2026 <br> Categoria Sub-7, Divisao A2</h5><a id="pills-fase-${phaseId}-tab">${phase}</a><div role="tabpanel" id="pills-fase-${phaseId}"><table><tbody><tr><td>${data}</td><td>09:30h</td><td>Harbor Arena</td><td><span class="nome_clube">Harbor FC</span><span class="result">${result}</span><span class="nome_clube">Coastal FC</span><a href="?id_jogo=101">Ver Súmula${wo ? ' - W.O.' : ''}</a></td></tr></tbody></table></div>${extra}`;
}
test('Paulista: IDs externos, chave estável, branco diferente de zero e W.O.', () => {
  const teams = extrairEquipes(teamsHtml, 900);
  const a = interpretarEvento(900, fixture(), teams, '');
  const b = interpretarEvento(900, fixture({ data: '22/03', result: '2 x 1' }), teams, '');
  assert.equal(a.jogos[0].id, b.jogos[0].id); assert.equal(a.jogos[0].sumulaId, 101);
  assert.equal(interpretarEvento(900, fixture({ result: ' x ' }), teams, '').jogos[0].golsMandante, null);
  assert.equal(interpretarEvento(900, fixture({ result: '0 x 0', wo: true }), teams, '').jogos[0].ocorrencia, 'WO');
  assert.equal(diferencas(a.jogos[0], b.jogos[0]).length, 2);
});
test('Paulista: nomes repetidos não unem fases; União fica fora; duplicação ambígua falha', () => {
  const teams = extrairEquipes(teamsHtml, 900);
  const extra = fixture({ phase: 'SEMIFINAL OURO', phaseId: '11' }).replace(/<h5>[\s\S]*?<\/h5>/, '');
  const a = interpretarEvento(900, fixture({ phase: 'SEMIFINAL OURO', extra }), teams, '');
  assert.equal(new Set(a.jogos.map(j => j.faseId)).size, 2);
  const uniao = extra.replace('SEMIFINAL OURO', 'TORNEIO UNIÃO - SEMIFINAL OURO');
  const b = interpretarEvento(900, fixture({ extra: uniao }), teams, '');
  assert.equal(b.jogos.length, 1); assert.equal(b.fasesExcluidas.length, 1);
  const row = '<tr><td>CHAVE A</td><td>1º</td><td><img class="escudo" src="/escudo/1.png"></td>' + '<td>0</td>'.repeat(8) + '</tr>';
  const rank = (id: string, nome: string) => `<a id="pills-fase-${id}-tab">${nome}</a><div role="tabpanel" id="pills-fase-${id}"><table><tbody>${row}</tbody></table></div>`;
  const ranking = rank('10', 'FASE DE CLASSIFICAÇÃO') + rank('10-chave', '') + rank('11', 'TORNEIO UNIÃO') + rank('11-chave', '') + rank('total', 'Geral');
  const parsed = interpretarEvento(900, fixture(), teams, ranking);
  assert.equal(parsed.classificacao.length, 1, 'Cópias auxiliares, agregado misto e União não entram na classificação Paulista.');
  assert.equal(parsed.classificacao[0].faseId, '10');
  assert.throws(() => interpretarEvento(900, fixture().replace('</tbody>', fixture().match(/<tr>[\s\S]*?<\/tr>/)![0] + '</tbody>'), teams, ''), /ambígua/);
});
test('Paulista: continuidade, normalização e sugestões não confirmam identidade', () => {
  const s = interpretarEvento(900, fixture(), extrairEquipes(teamsHtml, 900), '');
  assert.throws(() => verificarContinuidade(s, { ...s, jogos: [] }), /preservar/);
  assert.throws(() => interpretarEvento(900, fixture().replace('Campeonato Paulista', 'Copa União'), s.equipes, ''), /Somente/);
  assert.equal(normalizar(' Ocían—Clube '), 'OCIAN CLUBE');
  assert.equal(nomeTime('ADC Marvel sub-7'), nomeTime('ADC MARVEL'));
  assert.notEqual(nomeTime('União Esportiva sub-7'), nomeTime('ADC MARVEL'));
  assert.throws(() => inteiroFonte(['900'])); assert.throws(() => inteiroFonte('900/../901'));
  assert.equal(sugestoes('OCIAN PRAIA CLUBE', [{ id: 2, nome: 'Ocian' }])[0].estado, 'SUGESTAO_NAO_CONFIRMADA');
});
test('Paulista: 3/1/0, saldo e ranking por ID da fase sem tratar W.O. como empate', () => {
  const s = interpretarEvento(900, fixture(), extrairEquipes(teamsHtml, 900), '');
  assert.equal(rankingCalculado(s)[0].times[0].pontos, 1);
  s.jogos[0].golsMandante = 3;
  const r = rankingCalculado(s)[0]; assert.equal(r.times[0].pontos, 3); assert.equal(r.times[0].saldo, 2); assert.equal(r.ordemOficial, false);
  s.jogos[0].ocorrencia = 'WO'; assert.equal(rankingCalculado(s)[0].times[0].pontos, 0);
});

test('Paulista: pontos oficiais com nota são preservados, sem aceitar texto ou células vazias', () => {
  const row = '<tr><td>CHAVE A</td><td>14º</td><td><img class="escudo" src="/escudo/1.png"></td><td>8*</td>' + '<td>0</td>'.repeat(7) + '</tr>';
  const rank = `<a id="pills-fase-10-tab">FASE DE CLASSIFICAÇÃO</a><div role="tabpanel" id="pills-fase-10"><table><tbody>${row}</tbody></table></div>`;
  const teams = extrairEquipes(teamsHtml, 900);
  const parsed = interpretarEvento(900, fixture(), teams, rank);
  assert.equal(parsed.classificacao[0].pontos, 8); assert.equal(parsed.classificacao[0].pontosNota, '8*');
  for (const value of ['', 'oito', '8?', '8<script>']) assert.throws(() => interpretarEvento(900, fixture(), teams, rank.replace('8*', value)), /Valores|Classificação em formato/);
});

test('Paulista: abreviação e palavras genéricas não sugerem um cliente sem relação', () => {
  const clubes = [{ id: 30, nome: 'A. União Mauá · TESTE' }, { id: 3, nome: 'Santos' }];
  for (const nome of ['SÃO PAULO FC - A', 'A.D. INDAIATUBA', 'C. A. JUVENTUS', 'LAUSANNE PAULISTA FC - A']) assert.deepEqual(sugestoes(nome, clubes), []);
  assert.equal(sugestoes('A. UNIÃO MAUÁ', clubes)[0].id, 30);
  assert.equal(sugestoes('SANTOS FC', clubes)[0].id, 3);
  assert.deepEqual(sugestoes('Rio Branco', [{ id: 1, nome: 'Rio Preto' }]), []);
});
