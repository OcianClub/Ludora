import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GestaoPartida } from '../src/services/partidasCompartilhadas';
import { validarLance, ultimoLance, placarDoPeriodo, trocaValida, ultimoPeriodoIniciado, podeControlarAoVivo, podeAvancarTempo } from '../src/utils/validacaoSumula';
import { escalaValida } from '../src/utils/preparacaoPartida';
import { matchInsights } from '../../../packages/shared-types/src/matchInsights';
import { validPoll } from '../../../packages/shared-types/src/matchPoll';
import { resultadoCompartilhavel, linhasTexto } from '../src/utils/compartilharPartida';
import { eventosSemJogador } from '../src/utils/sumulaPartida';

import { sumulaFixture } from './sumula.fixture';

test('consulta oferece apenas tempos iniciados e preserva os anteriores após voltar o período', () => {
  const data = sumulaFixture();
  assert.equal(ultimoPeriodoIniciado(data), 2);
  data.partida.periodo_atual = 1;
  assert.equal(ultimoPeriodoIniciado(data), 2);
  data.eventos = [];
  data.auditoria = [{ id: 2, acao: 'PERIODO_ALTERADO', criado_em: '2026-11-10', dados: { periodo: 3 } }];
  assert.equal(ultimoPeriodoIniciado(data), 3);
});
test('preparação exige exatamente um goleiro titular, reservas adicionais são permitidos', () => {
  const lista = sumulaFixture().equipes[0].escalacao;
  assert.equal(escalaValida(lista), true);
  assert.equal(escalaValida(lista.filter(j => j.jogador?.posicao !== 'Goleiro')), false);
  assert.equal(escalaValida(lista.map(j => ({ ...j, jogador: { ...j.jogador!, posicao: 'Fixo' } }))), false);
  assert.equal(escalaValida(lista.map((j, i) => i === 2 ? { ...j, jogador: { ...j.jogador!, posicao: 'Goleiro' } } : j)), false);
});
test('gol contra aceita registro sem jogador e valida autoria adversária nas correções', () => {
  const data = sumulaFixture();
  for (const timeId of [10, 20]) assert.equal(validarLance(data, { tipo: 'GOL', timeId, contra: true }), '');
  assert.notEqual(validarLance(data, { tipo: 'GOL', timeId: 10, contra: true, existente: data.eventos[2] }), '', 'corrigir autoria ainda exige jogador');
  assert.equal(validarLance(data, { tipo: 'GOL', timeId: 10, contra: true, jogadorId: 201 }), '');
  assert.match(validarLance(data, { tipo: 'GOL', timeId: 10, contra: true, jogadorId: 101 }), /elegível/);
  assert.equal(matchInsights(data, null)[1].attack[0].goals, 1);
  assert.equal(matchInsights(data, null)[0].totals.GOL, 4);
  assert.equal(matchInsights(data, 2)[0].totals.GOL, 1);
});
test('autoria e assistência validam jogadores, campo, adversário, reserva e minuto', () => {
  const data = sumulaFixture(), base = { tipo: 'GOL', timeId: 10, contra: false, jogadorId: 101 };
  assert.equal(validarLance(data, { ...base, assistenteId: 102, minuto: '0' }), '');
  for (const assistenteId of [101, 201, 106, 999]) assert.notEqual(validarLance(data, { ...base, assistenteId }), '');
  assert.notEqual(validarLance(data, { ...base, contra: true, jogadorId: 201, assistenteId: 202 }), '');
  for (const minuto of ['1a', '-1', '201', '2.5']) assert.notEqual(validarLance(data, { ...base, minuto }), '');
  assert.equal(validarLance(data, { ...base, minuto: '200' }), '');
  assert.notEqual(validarLance(data, { ...base, jogadorId: 106 }), '');
  assert.equal(validarLance(data, { ...base, jogadorId: 106, existente: data.eventos[0] }), '');
});
test('assistência opcional ausente não vira pendência; registros anônimos e equipes externas são distintos', () => {
  const data = sumulaFixture();
  assert.equal(eventosSemJogador(data).length, 0);
  data.eventos.push({ id: 10, tipo: 'DEFESA', time_id: 10, periodo: 2 });
  assert.equal(eventosSemJogador(data).length, 1);
  data.equipes = data.equipes.filter(e => e.time_id !== 10);
  assert.equal(eventosSemJogador(data).length, 0);
  assert.equal(validarLance(data, { tipo: 'GOL', timeId: 10, contra: false }), '');
});
test('desfazer seleciona o gol com assistência como uma única ação e placar por tempo usa os gols daquele tempo', () => {
  const data = sumulaFixture();
  assert.equal(ultimoLance(data)?.id, 1);
  assert.deepEqual(placarDoPeriodo(data, 1), [1, 1]);
  assert.deepEqual(placarDoPeriodo(data, 2), [1, 0]);
});
test('substituição por toque ou arraste mantém um goleiro, camisa e grupos válidos', () => {
  const e = sumulaFixture().equipes[0];
  assert.equal(trocaValida(e, 100, 105), true);
  assert.equal(trocaValida(e, 101, 106), true);
  for (const [sai, entra] of [[100, 106], [101, 105], [101, 101], [105, 101], [101, 201]]) assert.equal(trocaValida(e, sai, entra), false);
});
test('compartilhamento independente de nomes e destaques preserva empates e não revela autoria ao ocultar nomes', () => {
  const data = sumulaFixture();
  data.eventos[0].jogador = { nome: 'Nome protegido' };
  data.eventos[1].jogador = { nome: 'Outro protegido' };
  for (const nomes of [false, true]) for (const destaques of [false, true]) {
    const result = resultadoCompartilhavel(data, nomes, destaques, 'https://ludora.test/partidas/9876');
    assert.equal(result.texto.includes('Nome protegido'), nomes);
    assert.equal(result.texto.includes('Participação em gols · Ludora'), destaques);
    assert.equal(result.texto.includes('https://ludora.test/partidas/9876'), true);
  }
  assert.deepEqual(linhasTexto('Nome de clube com palavras longas', 15), ['Nome de clube', 'com palavras', 'longas']);
});
test('destaques preservam todos os empates e ignoram rascunhos e lances sem autor', () => {
  const data = sumulaFixture(); data.eventos = [{ id: 1, tipo: 'GOL', time_id: 10, jogador_id: 101, periodo: 1 }, { id: 2, tipo: 'GOL', time_id: 10, jogador_id: 102, periodo: 1 }, { id: 3, tipo: 'GOL', time_id: 10, periodo: 1 }];
  assert.equal(matchInsights(data, null)[0].attack.length, 2);
  data.equipes[0].publicada_em = null;
  assert.equal(matchInsights(data, null)[0].attack.length, 0);
});
test('contrato de votação rejeita dados inválidos e não confunde partidas', () => {
  const poll = { partida_id: 1, revisao: 1, status: 'AO_VIVO', aberta: true, total: 2, votos: { MANDANTE: 1, EMPATE: 0, VISITANTE: 1 }, percentuais: { MANDANTE: 50, EMPATE: 0, VISITANTE: 50 }, meuVoto: null };
  assert.equal(validPoll(poll, 1), true);
  assert.equal(validPoll(poll, 2), false);
  assert.equal(validPoll({ ...poll, total: 3 }, 1), false);
});


test('expulso não registra lance nem retorna como reserva; reposição usa apenas a vaga pendente', () => {
  const data = sumulaFixture(), equipe = data.equipes[0];
  const expulso = equipe.escalacao.find(j => j.jogador_id === 101)!;
  expulso.expulso = true;
  // Even an outdated field flag must not make an expelled player eligible.
  assert.match(validarLance(data, { tipo: 'GOL', timeId: 10, jogadorId: 101, contra: false }), /elegível/);
  assert.match(validarLance(data, { tipo: 'GOL', timeId: 10, jogadorId: 102, assistenteId: 101, contra: false }), /assistência/);
  expulso.titular = false;
  assert.equal(trocaValida(equipe, 102, 101), false);
  assert.equal(trocaValida(equipe, 101, 106), false);
  expulso.reposicao_pendente = true;
  assert.equal(trocaValida(equipe, 101, 106), true);
  assert.equal(trocaValida(equipe, 101, 105), true, 'goleiro reserva também pode ocupar a vaga');
  equipe.escalacao.find(j => j.jogador_id === 106)!.expulso = true;
  assert.equal(trocaValida(equipe, 101, 106), false);
  expulso.reposicao_pendente = false;
  assert.equal(trocaValida(equipe, 101, 105), false);
  equipe.escalacao.find(j => j.jogador_id === 105)!.titular = true;
  equipe.escalacao.find(j => j.jogador_id === 106)!.expulso = false;
  assert.equal(trocaValida(equipe, 102, 106), true, 'trocas posteriores preservam a composição aceita na reposição');
});


test('somente o operador ao vivo avança tempos ou substitui, mesmo com permissão de preparação', () => {
  const data = sumulaFixture();
  assert.equal(podeControlarAoVivo(data), true);
  assert.equal(podeAvancarTempo(data, 1, 4), true);
  assert.equal(podeAvancarTempo(data, 2, 4), true);
  assert.equal(podeAvancarTempo(data, 4, 4), false);
  assert.equal(podeAvancarTempo(data, 2, 4, true), false);
  data.podeSumula = false;
  for (const podePreparar of [true, false]) {
    data.podePreparar = podePreparar;
    assert.equal(podeControlarAoVivo(data), false);
    assert.equal(podeAvancarTempo(data, 1, 4), false, 'consultar tempo anterior não libera a seta de avanço');
    assert.equal(podeAvancarTempo(data, 2, 4), false);
  }
  data.podeSumula = true;
  for (const status of ['AGENDADA', 'PREPARADA', 'FINALIZADA', 'CANCELADA']) {
    data.partida.status = status;
    assert.equal(podeControlarAoVivo(data), false);
    assert.equal(podeAvancarTempo(data, 1, 4), false);
  }
});
