const assert = require('node:assert/strict');
const { test } = require('node:test');
const { validarPreparacao, PreparacaoInvalida } = require('../dist/src/modules/partidas/preparacao.utils');
const { prisma } = require('../dist/src/lib/prisma');
const { criarPartidaRoutes } = require('../dist/src/modules/partidas/partida.routes');
const dados = { data: new Date('2026-10-29T00:00:00Z'), horario: '19:30', categoria_id: 1 };
const equipe = () => Array.from({ length: 6 }, (_, i) => ({ jogador_id: 100 + i, numCamisa: i + 1, titular: i < 5, jogador: { categoria_id: 1 } }));

test('preparação exige cinco titulares, data/horário e camisas válidas na categoria', () => {
  assert.doesNotThrow(() => validarPreparacao(dados, equipe()));
  for (const lineup of [[], equipe().slice(0, 4), equipe().map(j => ({ ...j, titular: true })), equipe().map((j, i) => i ? j : { ...j, numCamisa: 0 }), equipe().map((j, i) => i ? j : { ...j, numCamisa: 100 }), equipe().map((j, i) => i ? j : { ...j, jogador: { categoria_id: 9 } })]) {
    assert.throws(() => validarPreparacao(dados, lineup), PreparacaoInvalida);
  }
  for (const horario of [null, '', '24:00', '12:99']) assert.throws(() => validarPreparacao({ ...dados, horario }, equipe()), PreparacaoInvalida);
  assert.throws(() => validarPreparacao({ ...dados, data: new Date('invalid') }, equipe()), PreparacaoInvalida);
});

test('API impede pular preparação, valida escalação salva e só então transmite início', async t => {
  let status = 'AGENDADA';
  let lineup = equipe();
  let emits = 0;
  const originalFind = prisma.partida.findUnique, originalTx = prisma.$transaction;
  t.after(() => { prisma.partida.findUnique = originalFind; prisma.$transaction = originalTx; });
  prisma.partida.findUnique = async () => ({ status });
  prisma.$transaction = async callback => callback({
    escalacaoPartida: { findMany: async () => lineup },
    partida: {
      findUniqueOrThrow: async () => ({ id: 106, status, ...dados, emCasa: true, mandante: { nome: 'Ocian' }, visitante: { nome: 'Santos' } }),
      updateMany: async ({ where, data }) => { if (where.status !== status) return { count: 0 }; status = data.status; return { count: 1 }; },
    },
  });
  const router = criarPartidaRoutes({ to: () => ({ emit: () => emits++ }) });
  const handler = router.stack.find(layer => layer.route?.path === '/partidas/:id/status' && layer.route.methods.patch).route.stack.at(-1).handle;
  async function request(next) {
    let code = 200, body;
    await handler({ params: { id: '106' }, body: { status: next, status_anterior: status }, clubeId: 2 }, { status(value) { code = value; return this; }, json(value) { body = value; return this; } });
    return { code, body };
  }
  assert.equal((await request('AO_VIVO')).code, 400);
  assert.equal(status, 'AGENDADA');
  lineup = equipe().slice(0, 4);
  assert.equal((await request('PREPARADA')).code, 400);
  assert.equal(emits, 0);
  lineup = equipe();
  assert.equal((await request('PREPARADA')).code, 200);
  assert.equal(status, 'PREPARADA');
  lineup = equipe().map(j => ({ ...j, titular: false }));
  assert.equal((await request('AO_VIVO')).code, 400);
  assert.equal(status, 'PREPARADA');
  lineup = equipe();
  assert.equal((await request('AO_VIVO')).code, 200);
  assert.equal(status, 'AO_VIVO');
  assert.equal(emits, 2);
});
