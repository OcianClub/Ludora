import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { criarPublicoRoutes } from '../src/modules/publico/publico.routes';
import { exigirGestorDoClube } from '../src/middlewares/permissoes.middleware';
import { classificarPartidas } from '../src/modules/publico/publico.service';

test('consulta pública HTTP: escopo, rascunhos e ações de gestão', async t => {
  const clubes = [{ id: 2, nome: 'Ocian', escudo: null, cidade: 'Praia Grande', estado: 'SP' }, { id: 3, nome: 'Santos', escudo: null, cidade: null, estado: null }];
  const categoria = { id: 7, nome: 'SUB-7', tipo: 'INICIACAO', clube_id: 2 };
  let publicada = false, status = 'AGENDADA', exists = true;
  const row = () => ({ id: 50, data: new Date('2026-11-06'), horario: '19:30', local: 'Ginásio', status,
    mandante_id: 20, visitante_id: 30, gols_mandante: 2, gols_visitante: 1, emCasa: true,
    categoria_id: 7, categoria, competicao_id: 4, competicao: null, rodada: null, grupo: null,
    organizador_id: 2, sumula_clube_id: 2, titulares_necessarios: 5, periodo_atual: 1, versao: 1,
    mandante: { id: 20, nome: 'Time local antigo', escudo: null, clube_representado_id: 2, clubeRepresentado: clubes[0] },
    visitante: { id: 30, nome: 'Outro nome antigo', escudo: null, clube_representado_id: 3, clubeRepresentado: clubes[1] },
    participantes: [{ id: 1, clube_id: 2, categoria_id: 7, time_id: 20, pronta: publicada, publicada_em: publicada ? new Date() : null, categoria, clube: clubes[0] }] });
  let lineupCalls = 0, eventCalls = 0;
  const banco: any = {
    clube: { findUnique: async ({ where }: any) => clubes.find(c => c.id === where.id) || null, findMany: async () => clubes },
    categoria: { findMany: async ({ where }: any) => { assert.equal(where.clube_id, 2); return [categoria]; } },
    time: { findMany: async () => [] },
    partida: {
      findUnique: async ({ select }: any) => { assert.equal(select.auditoria, undefined); assert.equal(select.propostas, undefined); return exists ? row() : null; },
      findMany: async ({ where }: any) => {
        if (where.status === 'AO_VIVO') { assert.equal(where.OR.length, 3); return status === 'AO_VIVO' ? [row()] : []; }
        assert.ok(where.AND); assert.match(JSON.stringify(where.AND), /clube_id/); return [row()];
      },
    },
    escalacaoPartida: { findMany: async ({ where, select }: any) => {
      lineupCalls++; assert.deepEqual(where.time_id.in, [20]);
      assert.deepEqual(select.jogador.select, { id: true, nome: true, posicao: true });
      return [{ jogador_id: 9, numCamisa: 7, titular: true, titular_inicial: true, time_id: 20, ordem: 0, jogador: { id: 9, nome: 'Atleta', posicao: 'Fixo' } }];
    } },
    evento: { findMany: async ({ select }: any) => {
      eventCalls++; assert.equal(select.criado_por_id, undefined);
      return [{ id: 1, partida_id: 50, tipo: 'GOL', periodo: 1, jogador_id: 9, time_id: 20, gol_contra: false, jogador: { id: 9, nome: 'Atleta' } }];
    } },
  };
  const app = express(); app.use(express.json(), criarPublicoRoutes(banco));
  app.post('/partidas', exigirGestorDoClube, (_req, res) => { res.json({}); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  await t.test('visitante consulta clube e categorias; identificadores inválidos são tratados', async () => {
    assert.equal((await fetch(base + '/publico/clubes/2')).status, 200);
    assert.equal((await fetch(base + '/publico/clubes/2/categorias')).status, 200);
    assert.equal((await fetch(base + '/publico/clubes/999')).status, 404);
    assert.equal((await fetch(base + '/publico/clubes/abc')).status, 400);
    assert.equal((await fetch(base + '/publico/clubes/2/partidas?status=INVALIDA')).status, 400);
  });
  await t.test('agendada não divulga rascunhos nem consulta eventos', async () => {
    const response = await fetch(base + '/publico/partidas/50'); assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.equipes[0].escalacao, []); assert.deepEqual(body.eventos, []); assert.deepEqual(body.auditoria, []);
    assert.equal(body.podeSumula, false); assert.equal(body.podePreparar, false);
    assert.equal(lineupCalls, 0); assert.equal(eventCalls, 0);
    assert.equal(body.partida.mandante.nome, 'Ocian');
  });
  await t.test('escalação publicada e eventos são somente leitura, sem cadastro pessoal', async () => {
    publicada = true; status = 'AO_VIVO';
    const body = await (await fetch(base + '/publico/partidas/50?clube_id=999')).json();
    assert.equal(body.clube.id, 2); assert.equal(body.equipes[0].escalacao[0].numCamisa, 7);
    assert.equal(body.eventos.length, 1); assert.equal(body.podeSumula, false);
    assert.doesNotMatch(JSON.stringify(body), /cpf|dtNasc|email|senha|criado_por_id|propostas/);
    const away = await (await fetch(base + '/publico/partidas/50?clube_id=3')).json();
    assert.equal(away.clube.id, 3); assert.equal(away.partida.emCasa, false);
    const list = await (await fetch(base + '/publico/clubes/2/partidas')).json(); assert.equal(list[0].somente_leitura, true);
  });
  await t.test('feed ao vivo responde sem token e não é confundido com um identificador de partida', async () => {
    const response = await fetch(base + '/publico/partidas/ao-vivo');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.length, 1); assert.equal(body[0].id, 50);
    assert.equal(body[0].mandante.nome, 'Ocian');
    assert.deepEqual(body[0].clube_ids, [2, 3]);
    assert.doesNotMatch(JSON.stringify(body), /cpf|dtNasc|email|senha|escalacao|auditoria|usuario_id/);
    status = 'FINALIZADA';
    assert.deepEqual(await (await fetch(base + '/publico/partidas/ao-vivo')).json(), []);
  });
  await t.test('não há escrita pública; rotas autenticadas continuam exigindo token', async () => {
    assert.equal((await fetch(base + '/publico/partidas/50', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 404);
    assert.equal((await fetch(base + '/partidas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
    exists = false; assert.equal((await fetch(base + '/publico/partidas/999')).status, 404);
  });
  await t.test('classificação usa os resultados reais e os clubes representados', () => {
    const result = classificarPartidas([row() as any]);
    assert.equal(result[0].times[0].nome, 'Ocian'); assert.equal(result[0].times[0].pontos, 3);
    assert.equal(result[0].times[1].saldo, -1);
  });
});
