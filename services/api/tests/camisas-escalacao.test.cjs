const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sincronizarCamisasPreparacao } = require('../dist/src/modules/jogadores/camisas-escalacao.service.js');

function fixture(numeros = {}) {
  let rows = [
    { id: 1, partida_id: 1, jogador_id: 10, time_id: 5, numCamisa: 1, titular: true, ordem: 0, titular_inicial: true },
    { id: 2, partida_id: 1, jogador_id: 11, time_id: 5, numCamisa: 2, titular: false, ordem: 5, titular_inicial: false },
    { id: 3, partida_id: 2, jogador_id: 10, time_id: 5, numCamisa: 1, titular: false, ordem: 6, titular_inicial: false },
    { id: 4, partida_id: 3, jogador_id: 10, time_id: 5, numCamisa: 1, titular: true, ordem: 0, titular_inicial: true },
    { id: 5, partida_id: 4, jogador_id: 10, time_id: 5, numCamisa: 1, titular: true, ordem: 0, titular_inicial: true },
    { id: 6, partida_id: 5, jogador_id: 10, time_id: 5, numCamisa: 1, titular: true, ordem: 0, titular_inicial: true },
  ];
  const status = new Map([[1, 'PREPARADA'], [2, 'AGENDADA'], [3, 'AO_VIVO'], [4, 'FINALIZADA'], [5, 'CANCELADA']]);
  const calls = [];
  const players = new Map([[10, 1], [11, 2], ...Object.entries(numeros).map(([id, numero]) => [Number(id), numero])]);
  const tx = {
    escalacaoPartida: {
      findMany: async ({ where }) => rows.filter(row => (where.jogador_id ? where.jogador_id.in.includes(row.jogador_id) : where.OR.some(e => e.partida_id === row.partida_id && e.time_id === row.time_id)) && where.partida.status.in.includes(status.get(row.partida_id))),
      deleteMany: async ({ where }) => { calls.push('delete'); rows = rows.filter(row => !where.id.in.includes(row.id)); },
      createMany: async ({ data }) => {
        calls.push('create');
        for (const row of data) {
          assert.ok(!rows.some(other => row.partida_id === other.partida_id && row.time_id === other.time_id && row.numCamisa === other.numCamisa), 'números continuam exclusivos');
          rows.push(row);
        }
      },
    },
    jogador: { findMany: async ({ where }) => where.id.in.map(id => ({ id, numCamisa: players.get(id) ?? null })) },
    participantePartida: { updateMany: async args => { calls.push(['participant', args]); } },
    partida: { updateMany: async args => { calls.push(['match', args]); } },
    auditoriaPartida: { create: async args => { calls.push(['audit', args]); } },
  };
  return { tx, calls, rows: () => rows };
}

test('retira titular sem camisa em preparações, preservando reservas e súmulas iniciadas', async () => {
  const db = fixture();
  const result = await sincronizarCamisasPreparacao(db.tx, [{ id: 10, numCamisa: null }], { clubeId: 8, usuarioId: 9 });
  assert.deepEqual(result, [{ partida_id: 1, removidos: [10] }, { partida_id: 2, removidos: [10] }]);
  assert.equal(db.rows().filter(row => row.jogador_id === 10).length, 3);
  assert.equal(db.rows().find(row => row.jogador_id === 11).titular, false, 'não promove reserva silenciosamente');
  assert.deepEqual(db.rows().filter(row => row.jogador_id === 10).map(row => row.numCamisa), [1, 1, 1]);
  for (const [, args] of db.calls.filter(call => Array.isArray(call) && call[0] === 'participant')) {
    assert.equal(args.where.clube_id, 8);
    assert.deepEqual(args.where.time_id.in, [5]);
    assert.deepEqual(args.data, { pronta: false, publicada_em: null, versao: { increment: 1 } });
  }
});

test('camisa livre no cadastro não conflita com snapshot antigo de um titular sem número', async () => {
  const db = fixture({ 11: null });
  const result = await sincronizarCamisasPreparacao(db.tx, [{ id: 10, numCamisa: 2 }], { clubeId: 8, usuarioId: 9 });
  assert.equal(db.rows().find(row => row.partida_id === 1 && row.jogador_id === 10).numCamisa, 2);
  assert.ok(!db.rows().some(row => row.partida_id === 1 && row.jogador_id === 11));
  assert.deepEqual(result.find(p => p.partida_id === 1).removidos, [11]);
  // Depois da retirada é possível dar outra camisa e convocar o jogador novamente.
  await sincronizarCamisasPreparacao(db.tx, [{ id: 11, numCamisa: 33 }], { clubeId: 8, usuarioId: 9 });
  assert.ok(!db.rows().some(row => row.jogador_id === 11), 'não reconvoca automaticamente');
  assert.deepEqual(db.rows().filter(row => [3, 4, 5].includes(row.partida_id)).map(row => row.numCamisa), [1, 1, 1]);
});

test('corrige snapshot obsoleto de outro convocado sem alterar sua ordem ou titularidade', async () => {
  const db = fixture({ 11: 9 });
  await sincronizarCamisasPreparacao(db.tx, [{ id: 10, numCamisa: 2 }], { clubeId: 8, usuarioId: 9 });
  const reserve = db.rows().find(row => row.partida_id === 1 && row.jogador_id === 11);
  assert.deepEqual([reserve.numCamisa, reserve.ordem, reserve.titular], [9, 5, false]);
});

test('retira reserva sem camisa, sem modificar os titulares', async () => {
  const db = fixture();
  await sincronizarCamisasPreparacao(db.tx, [{ id: 11, numCamisa: null }], { clubeId: 8, usuarioId: 9 });
  assert.ok(!db.rows().some(row => row.jogador_id === 11));
  assert.equal(db.rows().find(row => row.id === 1).titular, true);
});

test('troca dois números sem violar unicidade nem mudar ordem ou papel na escalação', async () => {
  const db = fixture();
  await sincronizarCamisasPreparacao(db.tx, [{ id: 10, numCamisa: 2 }, { id: 11, numCamisa: 1 }], { clubeId: 8, usuarioId: 9 });
  assert.deepEqual(db.calls.slice(0, 2), ['delete', 'create']);
  const first = db.rows().find(row => row.partida_id === 1 && row.jogador_id === 10);
  const reserve = db.rows().find(row => row.partida_id === 1 && row.jogador_id === 11);
  assert.deepEqual([first.numCamisa, first.titular, first.ordem], [2, true, 0]);
  assert.deepEqual([reserve.numCamisa, reserve.titular, reserve.ordem], [1, false, 5]);
  assert.equal(db.calls.filter(call => Array.isArray(call) && call[0] === 'audit').length, 2);
});

test('número inalterado e jogador não convocado não causam gravações', async () => {
  const db = fixture();
  assert.deepEqual(await sincronizarCamisasPreparacao(db.tx, [{ id: 10, numCamisa: 1 }, { id: 99, numCamisa: 7 }], { clubeId: 8, usuarioId: 9 }), []);
  assert.deepEqual(db.calls, []);
});
