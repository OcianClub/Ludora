import test from 'node:test';
import assert from 'node:assert/strict';
import { acaoHome, dataHome, destaquesCategoria, gerenciaCategoria, hojeCalendario, nomeCategoria, podePrepararHome, resultadoPartida, resumoCategoria } from '../src/utils/homeDashboard.ts';

const match = (id, status, data, extra = {}) => ({
  id, status, data, horario: '18:00', categoria: { id: 1, nome: 'sub-7' },
  gols_mandante: 2, gols_visitante: 1, emCasa: true, ...extra,
});

test('partida ao vivo tem prioridade mesmo antiga; próximos jogos seguem data e horário', () => {
  const input = [
    match(1, 'AGENDADA', '2026-10-24', { horario: '20:00' }),
    match(2, 'AO_VIVO', '2026-10-20'),
    match(3, 'AGENDADA', '2026-10-24', { horario: '10:00' }),
    match(4, 'AGENDADA', '2026-10-19'),
    match(5, 'AO_VIVO', '2026-10-20', { categoria: { nome: 'sub-8' } }),
  ];
  const summary = resumoCategoria(input, 'SUB 7', '2026-10-23');
  assert.equal(summary.principal.id, 2);
  assert.deepEqual(summary.seguintes.map(p => p.id), [3, 1]);
  assert.deepEqual(input.map(p => p.id), [1, 2, 3, 4, 5]);
});

test('sem ao vivo, próximo jogo não aparece repetido na sequência', () => {
  const input = [match(1, 'AGENDADA', '2026-10-24'), match(2, 'PREPARADA', '2026-10-25')];
  const summary = resumoCategoria(input, 'sub-7', '2026-10-23');
  assert.equal(summary.principal.id, 1);
  assert.deepEqual(summary.seguintes.map(p => p.id), [2]);
});

test('histórico limita cinco jogos, ordena por horário e calcula resultados do clube visitante', () => {
  const input = Array.from({ length: 12 }, (_, i) => match(i + 1, 'FINALIZADA', `2026-10-${String(i + 1).padStart(2, '0')}`));
  const summary = resumoCategoria(input, 'sub-7', '2026-10-23');
  assert.deepEqual(summary.historico.map(p => p.id), [12, 11, 10, 9, 8]);
  assert.deepEqual(summary.totais, { V: 5, E: 0, D: 0 });
  assert.equal(resultadoPartida(match(1, 'FINALIZADA', '2026-10-20', { emCasa: false })), 'D');
  assert.equal(resultadoPartida(match(1, 'FINALIZADA', '2026-10-20', { gols_visitante: 2 })), 'E');
});

test('datas de calendário não mudam de dia por conversão de fuso e categoria vazia é segura', () => {
  assert.match(dataHome('2026-10-01T00:00:00.000Z'), /01 de out/);
  assert.equal(hojeCalendario(new Date(2026, 9, 23, 15, 30)), '2026-10-23');
  assert.equal(nomeCategoria(' Sub 7 '), 'SUB-7');
  assert.equal(resumoCategoria([], 'sub-7', '2026-10-23').principal, undefined);
});

test('sequência distingue categoria sem agenda de próximo jogo já em destaque e ignora partidas antigas', () => {
  const input = [match(1, 'AGENDADA', '2026-11-06', { categoria: { nome: 'sub-8' } }),
    match(2, 'PREPARADA', '2026-10-27'), match(3, 'CANCELADA', '2026-11-10')];
  const empty = resumoCategoria(input, 'SUB-7', '2026-10-31');
  assert.equal(empty.principal, undefined);
  assert.deepEqual(empty.seguintes, []);
  assert.deepEqual(empty.outrasCategoriasComAgenda, ['SUB-8']);
  const next = resumoCategoria(input, 'SUB-8', '2026-10-31');
  assert.equal(next.principal.id, 1);
  assert.deepEqual(next.seguintes, [], 'Única partida permanece no card principal sem duplicação');
});

test('sem jogos futuros, destaca a última partida finalizada sem confundir o estado com próxima partida', () => {
  const summary = resumoCategoria([match(1, 'FINALIZADA', '2026-10-20'), match(2, 'FINALIZADA', '2026-10-25'), match(3, 'CANCELADA', '2026-11-01')], 'sub-7', '2026-10-31');
  assert.equal(summary.principal.id, 2);
  assert.equal(summary.principal.status, 'FINALIZADA');
  assert.deepEqual(summary.seguintes, []);
});

test('gestão da Home respeita papel no clube e categorias atribuídas ao técnico', () => {
  const category = { id: 7, nome: 'sub-7' };
  assert.equal(gerenciaCategoria({ meuPapel: 'ADMIN' }, category), true);
  assert.equal(gerenciaCategoria({ meuPapel: 'TECNICO', categoriasAcesso: [{ id: 7 }] }, category), true);
  assert.equal(gerenciaCategoria({ meuPapel: 'MESARIO', acessoTodasCategorias: true }, category), true);
  assert.equal(gerenciaCategoria({ meuPapel: 'TECNICO', categoriasAcesso: [{ id: 8 }] }, category), false);
  for (const role of ['OLHEIRO', 'TORCEDOR', null]) assert.equal(gerenciaCategoria({ meuPapel: role, acessoTodasCategorias: true }, category), false);
  assert.equal(gerenciaCategoria(null, category), false);
});

test('ações distinguem espectador, responsável pela súmula e participante em partida de outro organizador', () => {
  const live = match(1, 'AO_VIVO', '2026-10-31', { sumula_clube_id: 2 });
  assert.equal(acaoHome(live, false, 2), 'Acompanhar ao vivo');
  assert.equal(acaoHome(live, true, 2), 'Operar súmula');
  assert.equal(acaoHome(live, true, 3), 'Acompanhar ao vivo');
  const upcoming = match(2, 'AGENDADA', '2026-11-06', { somente_leitura: true, minha_equipe_pronta: false, titulares_definidos: 2 });
  assert.equal(podePrepararHome(upcoming), true);
  assert.equal(acaoHome(upcoming, true, 3), 'Continuar preparação');
  assert.equal(acaoHome(upcoming, false, 3), 'Ver detalhes da partida');
  assert.equal(acaoHome({ ...upcoming, minha_equipe_pronta: true }, true, 3), 'Consultar preparação');
  assert.equal(podePrepararHome({ ...upcoming, minha_equipe_pronta: null }), false);
});

test('destaques usam apenas registros positivos de atletas com partidas, preservando empates', () => {
  const player = (id, nome, gols, assists, games = 4) => ({ id, nome, totalGols: gols, totalAssistencias: assists, totalPartidas: games });
  const players = [player(1, 'Bruno', 3, 1), player(2, 'Alex', 3, 2), player(3, 'Zero', 20, 9, 0)];
  const leaders = destaquesCategoria(players);
  assert.equal(leaders[0].jogador.nome, 'Alex');
  assert.equal(leaders[0].valor, 3);
  assert.equal(leaders[0].empatados, 1);
  assert.equal(leaders[1].campo, 'totalAssistencias');
  assert.deepEqual(destaquesCategoria([player(4, 'Sem eventos', 0, 0)]), []);
  assert.deepEqual(players.map(p => p.id), [1, 2, 3]);
});
