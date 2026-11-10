import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumoOperacional } from '../src/modules/admin/overview';
import { inicioAoVivo, passou24h } from '../src/modules/admin/partidas-revisao';

function bancoSimulado() {
  const calls: any[] = [];
  const read = (name: string, result: unknown) => async (args: unknown) => { calls.push([name, args]); return result; };
  const banco = {
    suporteChamado: { count: read('chamados', 2) }, manutencao: { count: read('pausas', 1) },
    fpfsPendencia: { findMany: read('pendencias', [{ tipo: 'IDENTIDADE', dados: {} }, { tipo: 'ALTERACAO_OFICIAL', dados: {} }]) },
    fpfsJogo: { findMany: read('jogos', [
      { id: 'a', oficial: { golsMandante: 3, golsVisitante: 0 }, partida: { id: 1, status: 'FINALIZADA', gols_mandante: 1, gols_visitante: 0 }, pendencias: [] },
      { id: 'b', oficial: { golsMandante: 2, golsVisitante: 0 }, partida: { id: 2, status: 'FINALIZADA', gols_mandante: 2, gols_visitante: 0 }, pendencias: [] },
    ]) }, fpfsRotina: { findUnique: read('rotina', { erro: null }) }, fpfsCatalogo: { count: read('catalogo', 0) },
    partida: { findMany: read('antigas', [{ id: 5, mandante: { nome: 'A', escudo: null }, visitante: { nome: 'B', escudo: null }, data: new Date('2026-08-01T00:00:00Z'), horario: '20:00', auditoria: [{ acao: 'STATUS_AO_VIVO', criado_em: new Date('2026-11-08T12:00:00Z') }] }]) },
  };
  return { banco, calls };
}

test('Resumo operacional consulta somente leitura, preserva partidas e segue divergências publicadas', async () => {
  const { banco, calls } = bancoSimulado();
  const r = await resumoOperacional(banco as any, new Date('2026-11-10T12:00:00Z'));
  assert.deepEqual(r.chamados, { abertos: 2, atrasados: 2 });
  assert.equal(r.manutencao, 1);
  assert.equal(r.federacao?.pendencias, 2);
  assert.equal(r.antigas?.[0].id, 5);
  const where = calls.find(c => c[0] === 'antigas')[1].where;
  assert.equal(where.status, 'AO_VIVO');
  assert.equal(where.data, undefined, 'A data agendada não determina o aviso');
  // O mock expõe apenas leituras: qualquer tentativa de escrever falha o teste.
});

test('Falha de uma fonte é desconhecida, nunca zero; outras fontes continuam disponíveis', async () => {
  const { banco } = bancoSimulado();
  banco.suporteChamado.count = async () => { throw new Error('offline'); };
  const r = await resumoOperacional(banco as any);
  assert.equal(r.chamados, null);
  assert.equal(r.manutencao, 1);
  assert.equal(r.federacao?.pendencias, 2);
});

test('Falha no Paulista não afeta alertas de partidas nem inicia sincronização', async () => {
  const { banco } = bancoSimulado();
  banco.fpfsJogo.findMany = async () => { throw new Error('offline'); };
  const r = await resumoOperacional(banco as any);
  assert.equal(r.federacao, null);
  assert.equal(r.antigas?.[0].id, 5);
});

test('Prazo depende do início real, nunca da data agendada; histórico ausente não é estimado', () => {
  const agora = new Date('2026-11-10T12:00:00Z');
  const ler = (acao: string, data: string) => inicioAoVivo([{ acao, criado_em: new Date(data) }], agora);
  assert.equal(passou24h(ler('STATUS_AO_VIVO', '2026-11-09T12:00:00Z'), agora), false);
  assert.equal(passou24h(ler('STATUS_AO_VIVO', '2026-11-09T11:59:59Z'), agora), true);
  assert.equal(passou24h(ler('STATUS_AO_VIVO', '2026-11-10T10:00:00Z'), agora), false);
  assert.equal(inicioAoVivo([], agora), null);
  assert.equal(ler('STATUS_FINALIZADA', '2026-11-08T10:00:00Z'), null);
  assert.equal(ler('STATUS_AO_VIVO', '2026-11-11T10:00:00Z'), null);
  assert.equal(passou24h(null, agora), false);
});

test('Partidas antigas de seed sem auditoria são separadas das comprovadas', async () => {
  const { banco } = bancoSimulado();
  banco.partida.findMany = async () => [
    { id: 1, mandante: { nome: 'A' }, visitante: { nome: 'B' }, data: new Date('2020-01-01'), auditoria: [] },
    { id: 2, mandante: { nome: 'A' }, visitante: { nome: 'B' }, data: new Date('2020-01-01'), auditoria: [{ acao: 'STATUS_AO_VIVO', criado_em: new Date('2026-11-10T11:00:00Z') }] },
    { id: 3, mandante: { nome: 'A' }, visitante: { nome: 'B' }, data: new Date('2030-01-01'), auditoria: [{ acao: 'STATUS_AO_VIVO', criado_em: new Date('2026-11-08T11:00:00Z') }] },
  ] as any;
  const r = await resumoOperacional(banco as any, new Date('2026-11-10T12:00:00Z'));
  assert.deepEqual(r.antigas?.map(p => p.id), [3]);
  assert.deepEqual(r.semInicio?.map(p => p.id), [1]);
});