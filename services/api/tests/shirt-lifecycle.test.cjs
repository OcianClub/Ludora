const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prisma } = require('../dist/src/lib/prisma.js');
const { salvarAluno } = require('../dist/src/modules/jogadores/elenco.service.js');
const { notificarCamisas } = require('../dist/src/modules/jogadores/elenco.realtime.js');

// Transações e restrições em memória; não modifica nenhuma partida real.
function fixture(t, status = 'AGENDADA', role = 'titular') {
  const category = { id: 7, nome: 'sub-7', clube_id: 2 };
  let state = {
    players: [
      { id: 101, nome: 'Alex (sub-7)', numCamisa: 1, categoria_id: 7, ativo: true, dtNasc: new Date('2019-01-01'), posicao: 'Goleiro', cpf: '11111111111' },
      { id: 102, nome: 'Bruno', numCamisa: null, categoria_id: 7, ativo: true, dtNasc: new Date('2019-01-01'), posicao: 'Fixo', cpf: '22222222222' },
    ],
    lineup: role === 'elenco' ? [] : [{ id: 1, partida_id: 1, time_id: 10, jogador_id: 101, numCamisa: 1, titular: role === 'titular', titular_inicial: role === 'titular', ordem: role === 'titular' ? 0 : 5 }],
    status, ready: true, audits: [],
  };
  let allowed = true, fail = false, retries = 0;
  const tx = {
    usuarioClube: { findUnique: async () => allowed ? { papel: 'ADMIN', categorias: [] } : null },
    jogador: {
      findFirst: async ({ where, include }) => {
        const player = state.players.find(j => (typeof where.id === 'number' ? j.id === where.id : j.id !== where.id?.not)
          && (!where.categoria || where.categoria.clube_id === 2)
          && (where.categoria_id === undefined || j.categoria_id === where.categoria_id)
          && (where.ativo === undefined || j.ativo === where.ativo)
          && (where.numCamisa === undefined || j.numCamisa === where.numCamisa));
        return player && { ...player, ...(include?.categoria ? { categoria: category } : {}) };
      },
      findMany: async ({ where }) => state.players.filter(j => where.id.in.includes(j.id)),
      count: async ({ where }) => state.players.filter(j => j.ativo && j.categoria_id === where.categoria_id && !where.id.notIn.includes(j.id) && where.numCamisa.in.includes(j.numCamisa)).length,
      update: async ({ where, data }) => { const j = state.players.find(j => j.id === where.id); Object.assign(j, data); return { ...j, categoria: category }; },
    },
    escalacaoPartida: {
      findFirst: async ({ where }) => {
        assert.equal(where.titular, true);
        assert.equal(where.partida.status, 'AO_VIVO');
        if (state.liveElsewhere && where.jogador_id.in.includes(101)) return { partida_id: 99, jogador: state.players[0] };
        const row = state.lineup.find(r => where.jogador_id.in.includes(r.jogador_id) && r.titular && state.status === 'AO_VIVO');
        return row ? { partida_id: 1, jogador: state.players.find(j => j.id === row.jogador_id) } : null;
      },
      findMany: async ({ where }) => state.lineup.filter(r => where.partida.status.in.includes(state.status)
        && (where.jogador_id ? where.jogador_id.in.includes(r.jogador_id) : where.OR.some(e => e.time_id === r.time_id && e.partida_id === r.partida_id))),
      deleteMany: async ({ where }) => { state.lineup = state.lineup.filter(r => !where.id.in.includes(r.id)); },
      createMany: async ({ data }) => {
        if (fail) throw Error('Falha simulada ao gravar escalação');
        for (const row of data) {
          assert.ok(!state.lineup.some(r => r.partida_id === row.partida_id && r.time_id === row.time_id && r.numCamisa === row.numCamisa));
          state.lineup.push({ ...row, id: state.lineup.length + 1 });
        }
      },
    },
    participantePartida: { updateMany: async () => { state.ready = false; } },
    partida: { updateMany: async ({ data }) => { state.status = data.status; } },
    auditoriaPartida: { create: async ({ data }) => { state.audits.push(data); } },
  };
  const original = prisma.$transaction;
  prisma.$transaction = async (callback, options) => {
    assert.equal(options.isolationLevel, 'Serializable');
    if (retries-- > 0) throw Object.assign(Error('Concorrência simulada'), { code: 'P2034' });
    const before = structuredClone(state);
    try { return await callback(tx); } catch (e) { state = before; throw e; }
  };
  t.after(() => { prisma.$transaction = original; });
  return { get: () => state, deny: () => { allowed = false; }, fail: () => { fail = true; }, retry: n => { retries = n; } };
}

for (const status of ['AGENDADA', 'PREPARADA', 'AO_VIVO', 'FINALIZADA', 'CANCELADA']) {
  for (const role of ['titular', 'reserva', 'elenco']) {
    test(`${status}/${role}: número livre, limites de alteração e preservação da súmula`, async t => {
      const db = fixture(t, status, role);
      if (status === 'AO_VIVO' && role === 'titular') {
        await assert.rejects(salvarAluno(2, 1, { numCamisa: '09' }, 101), e => e.status === 409 && /está em campo/.test(e.message));
        assert.equal(db.get().players[0].numCamisa, 1);
        assert.equal(db.get().lineup[0].numCamisa, 1);
        // Reenviar o mesmo número não é uma troca e continua permitido.
        await salvarAluno(2, 1, { numCamisa: '01' }, 101);
        return;
      }
      const saved = await salvarAluno(2, 1, { numCamisa: '09' }, 101);
      assert.equal(saved.numCamisa, 9);
      if (role !== 'elenco') {
        const preparation = ['AGENDADA', 'PREPARADA'].includes(status);
        assert.equal(db.get().lineup[0].numCamisa, preparation ? 9 : 1);
        assert.equal(db.get().lineup[0].titular, role === 'titular');
        assert.equal(db.get().ready, !preparation);
      }
    });
    test(`${status}/${role}: transferir camisa de outro atleta com confirmação`, async t => {
      const db = fixture(t, status, role);
      if (status === 'AO_VIVO' && role === 'titular') {
        for (const confirm of [undefined, { jogador_id: 101, camisa_anterior: null }]) {
          await assert.rejects(salvarAluno(2, 1, { numCamisa: 1, confirmar_camisa: confirm }, 102), e => e.status === 409 && /está em campo/.test(e.message));
        }
        assert.equal(db.get().players[0].numCamisa, 1); assert.equal(db.get().players[1].numCamisa, null);
        return;
      }
      await assert.rejects(salvarAluno(2, 1, { numCamisa: '01' }, 102), e => e.status === 409 && e.detalhes.conflito_camisa.jogador_id === 101);
      assert.equal(db.get().players[0].numCamisa, 1);
      await salvarAluno(2, 1, { numCamisa: '01', confirmar_camisa: { jogador_id: 101, camisa_anterior: null } }, 102);
      assert.equal(db.get().players[0].numCamisa, null); assert.equal(db.get().players[1].numCamisa, 1);
      if (['AGENDADA', 'PREPARADA'].includes(status)) assert.equal(db.get().lineup.length, 0);
      else if (role !== 'elenco') assert.equal(db.get().lineup[0].numCamisa, 1, 'o número histórico pertence à súmula');
      await salvarAluno(2, 1, { numCamisa: 33 }, 101);
      assert.equal(db.get().players[0].numCamisa, 33);
    });
  }
}

test('troca indireta também bloqueia o jogador solicitante em campo; reserva pode trocar depois de sair', async t => {
  const db = fixture(t, 'AO_VIVO');
  db.get().players[1].numCamisa = 2;
  await assert.rejects(salvarAluno(2, 1, { numCamisa: 2, confirmar_camisa: { jogador_id: 102, camisa_anterior: 1 } }, 101), /está em campo/);
  db.get().lineup[0].titular = false;
  await salvarAluno(2, 1, { numCamisa: 2, confirmar_camisa: { jogador_id: 102, camisa_anterior: 1 } }, 101);
  assert.deepEqual(db.get().players.map(j => j.numCamisa), [2, 1]);
  assert.equal(db.get().lineup[0].numCamisa, 1);
});

test('valores inválidos, clube/categoria sem acesso e confirmação vencida não gravam', async t => {
  const db = fixture(t);
  for (const numCamisa of [0, 100, -1, 1.5, true, {}, '1e1', '1⚽', '1️⃣', '001']) {
    await assert.rejects(salvarAluno(2, 1, { numCamisa }, 101), e => e.status === 400);
  }
  await assert.rejects(salvarAluno(99, 1, { numCamisa: 5 }, 101), e => e.status === 404);
  await assert.rejects(salvarAluno(2, 1, { numCamisa: 1, confirmar_camisa: { jogador_id: 101, camisa_anterior: 9 } }, 102), e => e.status === 409);
  db.deny();
  await assert.rejects(salvarAluno(2, 1, { numCamisa: 5 }, 101), e => e.status === 403);
  assert.deepEqual(db.get().players.map(j => j.numCamisa), [1, null]);
});

test('jogador em campo em outra partida também bloqueia mudança feita pela preparação', async t => {
  const db = fixture(t, 'PREPARADA');
  db.get().liveElsewhere = true;
  await assert.rejects(salvarAluno(2, 1, { numCamisa: 8 }, 101), e => e.status === 409 && /#99/.test(e.message));
  await assert.rejects(salvarAluno(2, 1, { numCamisa: 1, confirmar_camisa: { jogador_id: 101, camisa_anterior: null } }, 102), /#99/);
  assert.deepEqual(db.get().players.map(j => j.numCamisa), [1, null]);
  assert.equal(db.get().lineup[0].numCamisa, 1);
});

test('PATCH publica camisa após salvar e não emite nada quando o jogador está em campo', async t => {
  const db = fixture(t, 'AGENDADA', 'elenco');
  const router = require('../dist/src/modules/jogadores/jogador.routes.js').default;
  const handler = router.stack.find(l => l.route?.path === '/jogadores/:id' && l.route.methods.patch).route.stack.at(-1).handle;
  const emissions = [];
  const io = { to: room => ({ emit: (name, data) => emissions.push({ room, name, data }) }) };
  async function patch(number) {
    let status = 200, body;
    const res = { status(value) { status = value; return res; }, json(value) { body = value; return res; } };
    await handler({ params: { id: '101' }, body: { numCamisa: number }, clubeId: 2, usuarioId: 1, app: { get: () => io } }, res);
    return { status, body };
  }
  const success = await patch('09');
  assert.equal(success.status, 200);
  assert.equal(success.body.numCamisa, 9);
  assert.equal(success.body.cpf, undefined);
  assert.equal(emissions.length, 1);
  assert.deepEqual(emissions[0], { room: 'clube:2', name: 'elenco_atualizado', data: { clube_id: 2, jogadores: [{ id: 101, numCamisa: 9, categoria_id: 7 }] } });
  db.get().liveElsewhere = true;
  const blocked = await patch('08');
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.error, /em campo/);
  assert.equal(emissions.length, 1);
  assert.equal(db.get().players[0].numCamisa, 9);
});

test('falha na atualização da escalação desfaz toda a troca; concorrência repete a transação', async t => {
  const db = fixture(t);
  db.retry(2);
  await salvarAluno(2, 1, { numCamisa: '02' }, 101);
  assert.equal(db.get().lineup[0].numCamisa, 2);
  db.fail();
  await assert.rejects(salvarAluno(2, 1, { numCamisa: '03' }, 101), /Falha simulada/);
  assert.equal(db.get().players[0].numCamisa, 2);
  assert.equal(db.get().lineup[0].numCamisa, 2);
});

test('tempo real divulga apenas camisas e invalida prontidão para ambos os clubes', async () => {
  const sent = [];
  const io = { to: room => ({ emit: (name, data) => sent.push({ room, name, data }) }) };
  await notificarCamisas(io, 2, { camisas_atualizadas: [{ id: 101, numCamisa: 7, categoria_id: 7 }], escalacoes_atualizadas: [{ partida_id: 1 }] }, {
    participantePartida: { findMany: async () => [{ partida_id: 1, clube_id: 2 }, { partida_id: 1, clube_id: 3 }] },
  });
  assert.equal(sent[0].name, 'elenco_atualizado');
  assert.deepEqual(sent[0].data, { clube_id: 2, jogadores: [{ id: 101, numCamisa: 7, categoria_id: 7 }] });
  assert.deepEqual(sent.slice(1).map(e => [e.room, e.data.id]), [['clube:2', 1], ['clube:3', 1]]);
});
