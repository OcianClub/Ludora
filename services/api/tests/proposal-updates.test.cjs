const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../dist/src/lib/prisma.js');
const { criarCompartilhadasRoutes } = require('../dist/src/modules/partidas/compartilhadas.routes.js');

test('solicitações: avisar os dois clubes após commit, sem aguardar a gravação das notificações', async t => {
  const sequence = [], emissions = [];
  const proposal = { id: 'proposal-fixture', origem_id: 2, destino_id: 3, respondente_id: 3, status: 'PENDENTE', tipo: 'SUMULA', dados: {}, categoria_origem_id: 7, categoria_destino_id: 8 };
  const p = { id: 10, status: 'AO_VIVO', versao: 1, sumula_clube_id: 2, participantes: [
    { clube_id: 2, categoria_id: 7 }, { clube_id: 3, categoria_id: 8 },
  ] };
  const replace = (target, name, value) => { const previous = target[name]; target[name] = value; t.after(() => { target[name] = previous; }); };
  replace(prisma, '$transaction', async callback => { const value = await callback(prisma); sequence.push('commit'); return value; });
  replace(prisma.partida, 'findUnique', async () => p);
  replace(prisma.usuarioClube, 'findUnique', async () => ({ papel: 'ADMIN' }));
  replace(prisma.propostaPartida, 'count', async () => 0);
  replace(prisma.propostaPartida, 'create', async () => proposal);
  replace(prisma.propostaPartida, 'findUniqueOrThrow', async () => proposal);
  replace(prisma.clube, 'findMany', async () => [{ id: 2, nome: 'Ocian' }, { id: 3, nome: 'Santos' }]);
  replace(prisma.usuarioClube, 'findMany', async () => [{ usuario_id: 1 }]);
  replace(prisma.dispositivoPush, 'findMany', async () => []);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let reached;
  const recording = new Promise(resolve => { reached = resolve; });
  replace(prisma.notificacao, 'create', async ({ data }) => {
    sequence.push('notification'); reached(); await gate; return { id: 1, ...data };
  });
  const router = criarCompartilhadasRoutes({ to: room => ({ emit: (event, data) => { sequence.push(event); emissions.push({ room, event, data }); } }) });
  const route = router.stack.find(layer => layer.route?.path === '/partidas/:id/sumula').route;
  let response;
  const res = { status() { return res; }, json(value) { response = value; } };
  const pending = route.stack.at(-1).handle({ usuarioId: 1, clubeId: 2, params: { id: '10' }, body: {} }, res);
  try {
    await Promise.race([recording, new Promise((_, reject) => { const timer = setTimeout(() => reject(Error('A rota não alcançou as notificações')), 3000); timer.unref(); })]);
    assert.deepEqual(sequence.slice(0, 4), ['commit', 'solicitacao_partida', 'solicitacao_partida', 'notification']);
    assert.deepEqual(emissions, [
      { room: 'clube:2', event: 'solicitacao_partida', data: { id: proposal.id } },
      { room: 'clube:3', event: 'solicitacao_partida', data: { id: proposal.id } },
    ]);
    assert.equal(response, undefined, 'as notificações ainda estão gravando, mas as telas já foram avisadas');
  } finally { release(); await pending; }
  assert.equal(response.id, proposal.id);
  assert.equal(emissions.filter(item => item.event === 'notificacao_criada').length, 2, 'notificações dos destinatários continuam sendo enviadas');
});
