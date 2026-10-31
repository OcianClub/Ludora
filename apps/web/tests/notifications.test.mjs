import test from 'node:test';
import assert from 'node:assert/strict';
import { bundleCorrections, formatNoticeBody, formatNoticeTime, groupNotices, noticePresentation } from '../src/utils/notifications.ts';

test('avisos são agrupados por dia local e ordenados do mais novo para o mais antigo', () => {
  const now = new Date(2026, 9, 23, 20);
  const item = (id, date) => ({ id, criada_em: date.toISOString() });
  const today = item(1, new Date(2026, 9, 23, 18));
  const yesterday = item(2, new Date(2026, 9, 22, 17));
  const old = item(3, new Date(2026, 9, 18, 19));
  const rows = [old, yesterday, today];
  const groups = groupNotices(rows, now);
  assert.equal(groups[0].label, 'Hoje');
  assert.equal(groups[1].label, 'Ontem');
  assert.equal(groups[2].label, 'Semana passada');
  assert.deepEqual(groups.flatMap(group => group.notices.map(item => item.id)), [1, 2, 3]);
  assert.deepEqual(rows.map(item => item.id), [3, 2, 1], 'Não modifica a resposta original');
});

test('seções de semana respeitam os limites locais de semana, mês e ano', () => {
  const now = new Date(2027, 0, 5, 20);
  const item = (id, date) => ({ id, criada_em: date.toISOString() });
  const rows = [item(1, new Date(2027, 0, 5, 10)), item(2, new Date(2027, 0, 4, 10)),
    item(3, new Date(2027, 0, 3, 10)), item(4, new Date(2026, 11, 30, 10)), item(5, new Date(2026, 11, 20, 10))];
  const groups = groupNotices(rows, now);
  assert.deepEqual(groups.slice(0, 3).map(group => group.label), ['Hoje', 'Ontem', 'Semana passada']);
  assert.deepEqual(groups[2].notices.map(item => item.id), [3, 4]);
  assert.match(groups[3].label, /20 de dezembro de 2026/);
  assert.equal(formatNoticeTime(rows[0].criada_em, now), '10:00');
  assert.equal(formatNoticeTime(rows[2].criada_em, now), '3 de jan · 10:00');
  const friday = new Date(2027, 0, 8, 20);
  assert.equal(groupNotices([item(6, new Date(2027, 0, 6, 10))], friday)[0].label, 'Esta semana');
});

test('avisos com o mesmo horário têm desempate estável pelo identificador', () => {
  const now = new Date(2026, 9, 23);
  const date = now.toISOString();
  assert.deepEqual(groupNotices([{ id: 1, criada_em: date }, { id: 9, criada_em: date }], now)[0].notices.map(item => item.id), [9, 1]);
  assert.deepEqual(groupNotices([], now), []);
});

test('correções próximas são expansíveis sem agrupar gols, outras partidas ou estados de leitura', () => {
  const correction = (id, minutes, overrides = {}) => ({ id, partida_id: 10, titulo: 'Súmula corrigida', lida: false,
    criada_em: new Date(2026, 9, 31, 18, minutes).toISOString(), ...overrides });
  const rows = [correction(1, 30), correction(2, 28), correction(3, 27, { partida_id: 11 }),
    correction(4, 26), correction(5, 25, { titulo: 'Gol do Ocian!', tipo: 'GOL_PARTIDA' }),
    correction(6, 24), correction(7, 23, { lida: true }), correction(8, 0, { lida: true })];
  assert.deepEqual(bundleCorrections(rows).map(bundle => bundle.map(item => item.id)), [[1, 2], [3], [4], [5], [6], [7], [8]]);
  assert.equal(bundleCorrections(rows).flat().length, rows.length, 'Todos os registros são preservados');
});

test('apresentação distingue correção, início e solicitações sem alterar o tipo usado pelos filtros', () => {
  assert.deepEqual(noticePresentation({ titulo: 'Súmula corrigida', tipo: 'PARTIDA_AGENDADA' }), { label: 'Correção de súmula', icon: 'edit' });
  assert.equal(noticePresentation({ titulo: 'Partida iniciada', tipo: 'PARTIDA_AGENDADA' }).icon, 'broadcast');
  assert.equal(noticePresentation({ titulo: 'Proposta de partida', dados: { solicitacaoId: 'abc' } }).icon, 'email');
  assert.equal(noticePresentation({ titulo: 'Gol do Ocian!', tipo: 'GOL_PARTIDA' }).icon, 'ball');
});

test('datas do corpo são legíveis sem conversão de fuso ou aceitação de datas inexistentes', () => {
  assert.equal(formatNoticeBody('Ocian x Santos · 2026-10-30 às 23:30'), 'Ocian x Santos · 30 de out às 23:30');
  assert.equal(formatNoticeBody('2026-02-30'), '2026-02-30');
  assert.equal(formatNoticeBody('Placar agora: Ocian 2 x 1 Santos'), 'Placar agora: Ocian 2 x 1 Santos');
});
