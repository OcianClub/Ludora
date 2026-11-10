import test from 'node:test';
import assert from 'node:assert/strict';
import { agruparFinalizados } from '../src/shared/ticket-periods';

test('finalizados: hoje, ontem, semana e mês usam o encerramento em São Paulo', () => {
  const items = [
    { id: 'month', finalizadoEm: '2026-10-15T12:00:00Z' },
    { id: 'yesterday', finalizadoEm: '2026-11-09T12:00:00Z' },
    { id: 'today', finalizadoEm: '2026-11-10T12:00:00Z' },
    { id: 'previous-week', finalizadoEm: '2026-11-07T12:00:00Z' },
    { id: 'year', finalizadoEm: '2025-12-10T12:00:00Z' },
    { id: 'unknown', finalizadoEm: null },
  ];
  const groups = agruparFinalizados(items, new Date('2026-11-10T18:00:00Z'));
  assert.deepEqual(groups.map(g => g.label), ['Hoje', 'Ontem', 'Semana passada', 'Outubro', 'Dezembro de 2025', 'Data de encerramento indisponível']);
  assert.equal(items[0].id, 'month', 'Não altera a ordem original');
  assert.equal(groups[0].items[0].id, 'today');
});

test('fronteira da meia-noite e da semana, datas inválidas e meses do mesmo ano', () => {
  const groups = agruparFinalizados([
    {finalizadoEm:'2026-11-12T02:59:59Z'}, // Ainda quarta, 11, em São Paulo.
    {finalizadoEm:'2026-11-09T12:00:00Z'},
    {finalizadoEm:'2026-11-01T12:00:00Z'},
    {finalizadoEm:'inválida'},
  ], new Date('2026-11-12T12:00:00Z'));
  assert.deepEqual(groups.map(g => g.label), ['Ontem', 'Esta semana', 'Novembro', 'Data de encerramento indisponível']);
  assert.deepEqual(agruparFinalizados([], new Date()), []);
});

test('data de criação não é usada como encerramento e o mais recente vem primeiro no grupo', () => {
  const groups = agruparFinalizados([
    {id:'older', criadoEm:'2026-01-01', finalizadoEm:'2026-11-10T10:00:00Z'},
    {id:'newer', criadoEm:'2026-02-01', finalizadoEm:'2026-11-10T12:00:00Z'},
    {id:'unknown', criadoEm:'2026-11-10'},
  ], new Date('2026-11-10T18:00:00Z'));
  assert.deepEqual(groups[0].items.map(i => i.id), ['newer', 'older']);
  assert.equal(groups[1].key, 'unknown');
});
