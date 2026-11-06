const { test } = require('node:test');
const assert = require('node:assert/strict');
const { categoriaPorNascimento, planejarTemporada, anoTemporada } = require('../dist/src/modules/jogadores/elenco.rules.js');
const { salvarAluno, transacaoElenco, atualizarTemporada } = require('../dist/src/modules/jogadores/elenco.service.js');
const { prisma } = require('../dist/src/lib/prisma.js');
const agora = new Date('2026-10-18T15:00:00Z');
const categorias = [{ id: 12, nome: 'sub-12', clube_id: 1 }, { id: 14, nome: 'sub-14', clube_id: 1 }, { id: 18, nome: 'sub-18', clube_id: 1 }];
const aluno = (id, ano, categoria_id, numCamisa, ativo = true) => ({ id, dtNasc: new Date(`${ano}-12-20T00:00:00Z`), categoria_id, numCamisa, ativo });

test('usa ano da temporada, inclusive aniversário futuro, limites e data inválida', () => {
  assert.equal(categoriaPorNascimento('2018-12-20', agora), 'sub-8');
  assert.equal(categoriaPorNascimento('2013-12-20', agora), 'sub-14');
  assert.equal(categoriaPorNascimento('2008-12-20', agora), 'sub-18');
  assert.equal(categoriaPorNascimento('2007-12-20', agora), null);
  assert.throws(() => categoriaPorNascimento('2026-02-30', agora));
  assert.throws(() => categoriaPorNascimento('2027-01-01', agora));
  assert.equal(anoTemporada(new Date('2027-01-01T02:00:00Z')), 2026);
  assert.equal(anoTemporada(new Date('2027-01-01T03:00:00Z')), 2027);
});
test('mudança anual mantém camisa livre e limpa ocupada dando prioridade ao residente', () => {
  const resultado = planejarTemporada([aluno(1, 2013, 12, 21), aluno(2, 2012, 14, 21), aluno(3, 2013, 12, 7)], categorias, agora);
  assert.equal(resultado.find(a => a.id === 1).numCamisa, null);
  assert.equal(resultado.find(a => a.id === 2).numCamisa, 21);
  assert.equal(resultado.find(a => a.id === 3).numCamisa, 7);
  assert.equal(resultado.find(a => a.id === 1).categoria_id, 14);
});
test('dois transferidos com mesma camisa são resolvidos de forma determinística', () => {
  const entrada = [aluno(3, 2013, 12, 9), aluno(1, 2013, 12, 9)];
  const resultado = planejarTemporada(entrada, categorias, agora);
  assert.equal(resultado.find(a => a.id === 1).numCamisa, 9);
  assert.equal(resultado.find(a => a.id === 3).numCamisa, null);
  assert.equal(entrada[0].numCamisa, 9);
});
test('não reativa inativos, preserva registro acima de 18 e falha antes de categoria ausente', () => {
  const resultado = planejarTemporada([aluno(1, 2007, 18, 8), aluno(2, 2013, 12, 10, false)], categorias, agora);
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].ativo, false);
  assert.equal(resultado[0].id, 1);
  assert.throws(() => planejarTemporada([aluno(3, 2018, 12, 10)], categorias, agora), /sub-8/);
});

// Banco em memória: nenhum acesso ao Supabase, rollback simulado e injeção de falhas.
function banco(t, inicial = []) {
  let rows = structuredClone(inicial);
  let failCreate = false;
  let retries = 0;
  let allowed = [12, 14, 18];
  const tx = {
    escalacaoPartida: { findMany: async () => [], findFirst: async () => null },
    categoria: { findFirst: async ({ where }) => categorias.find(c => c.clube_id === where.clube_id && c.nome === where.nome.equals), findMany: async () => categorias },
    usuarioClube: { findUnique: async () => ({ papel: 'TECNICO', acesso_todas_categorias: false, categorias: allowed.map(categoria_id => ({ categoria_id })) }) },
    jogador: {
      findFirst: async ({ where, include }) => { const row = rows.find(r => (typeof where.id === 'number' ? r.id === where.id : r.id !== where.id?.not) &&
        (!where.categoria || categorias.some(c => c.id === r.categoria_id && c.clube_id === where.categoria.clube_id)) &&
        (where.categoria_id === undefined || r.categoria_id === where.categoria_id) &&
        (where.numCamisa === undefined || r.numCamisa === where.numCamisa) && (where.ativo === undefined || r.ativo === where.ativo));
        return row && include?.categoria ? { ...row, categoria: categorias.find(c => c.id === row.categoria_id) } : row; },
      findUnique: async ({ where }) => rows.find(r => r.cpf === where.cpf),
      findMany: async () => rows.filter(r => r.ativo),
      count: async ({ where }) => rows.filter(r => r.ativo && r.categoria_id === where.categoria_id && !where.id.notIn.includes(r.id) && where.numCamisa.in.includes(r.numCamisa)).length,
      update: async ({ where, data }) => { const r = rows.find(r => r.id === where.id); Object.assign(r, data); return structuredClone(r); },
      create: async ({ data }) => { if (failCreate) throw Error('Injected write failure'); const r = { id: 100, ativo: true, ...data }; rows.push(r); return structuredClone(r); },
    },
  };
  const original = prisma.$transaction;
  prisma.$transaction = async (fn, options) => {
    assert.equal(options.isolationLevel, 'Serializable');
    if (retries-- > 0) throw Object.assign(Error('serialization'), { code: 'P2034' });
    const snapshot = structuredClone(rows);
    try { return await fn(tx); } catch (e) { rows = snapshot; throw e; }
  };
  t.after(() => { prisma.$transaction = original; });
  return { tx, rows: () => rows, fail: () => { failCreate = true; }, retry: n => { retries = n; }, allow: cats => { allowed = cats; } };
}
const ano = anoTemporada();
const dados = { nome: 'Alex Carter', cpf: '12345678901', dtNasc: `${ano - 13}-06-10`, numCamisa: 10 };
const residente = { ...aluno(2, ano - 14, 14, 10), nome: 'James Walker', cpf: '98765432100', posicao: 'Ala' };

test('edição bloqueia troca de CPF e rejeita foto com SVG sem alterar cadastro', async t => {
  const db = banco(t, [residente]);
  await assert.rejects(salvarAluno(1, 7, { cpf: '12345678901' }, 2), /CPF não pode ser alterado/);
  await assert.rejects(salvarAluno(1, 7, { foto: 'data:image/svg+xml;base64,AAAA' }, 2), /imagem JPEG/);
  assert.equal(db.rows()[0].cpf, residente.cpf);
  assert.equal(db.rows()[0].foto, undefined);
});
test('cadastro retorna conflito identificado sem alterar dados; confirmação transfere e deixa anterior vazio', async t => {
  const db = banco(t, [residente]);
  await assert.rejects(salvarAluno(1, 7, dados), e => e.status === 409 && e.detalhes.conflito_camisa.nome === 'James Walker');
  assert.equal(db.rows()[0].numCamisa, 10);
  await salvarAluno(1, 7, { ...dados, confirmar_camisa: { jogador_id: 2, camisa_anterior: null } });
  assert.equal(db.rows()[0].numCamisa, null);
  assert.equal(db.rows()[1].numCamisa, 10);
});
test('edição troca duas camisas atomicamente e PATCH sem camisa preserva o valor', async t => {
  const db = banco(t, [residente, { ...residente, id: 3, nome: 'Alex Carter', cpf: '12345678901', numCamisa: 7 }]);
  await salvarAluno(1, 7, { numCamisa: 10, confirmar_camisa: { jogador_id: 2, camisa_anterior: 7 } }, 3);
  assert.equal(db.rows()[0].numCamisa, 7);
  assert.equal(db.rows()[1].numCamisa, 10);
  await salvarAluno(1, 7, { nome: 'Alex Updated' }, 3);
  assert.equal(db.rows()[1].numCamisa, 10);
});

test('editar somente a camisa aceita 1 e 01 e preserva nome, posição e categoria antigos', async t => {
  const legado = { ...residente, nome: 'James Walker (sub-12)', categoria_id: 12 };
  const db = banco(t, [legado]);
  db.allow([12]);
  for (const numCamisa of ['1', '01', 1]) {
    await salvarAluno(1, 7, { numCamisa }, legado.id);
    const salvo = db.rows()[0];
    assert.equal(salvo.numCamisa, 1);
    assert.equal(salvo.nome, legado.nome);
    assert.equal(salvo.posicao, legado.posicao);
    assert.equal(salvo.categoria_id, 12);
    assert.equal(salvo.dtNasc.toISOString(), legado.dtNasc.toISOString());
  }
  await assert.rejects(salvarAluno(1, 7, { nome: 'James ⚽' }, legado.id), /nome válido/);
  await salvarAluno(1, 7, { nome: legado.nome, numCamisa: '33' }, legado.id);
  assert.equal(db.rows()[0].numCamisa, 33, 'cliente antigo pode reenviar o nome legado inalterado');
  await assert.rejects(salvarAluno(1, 7, { numCamisa: '00' }, legado.id), /1 a 99/);
  assert.equal(db.rows()[0].numCamisa, 33);
});

test('troca de camisa funciona com nomes antigos e confirmação obsoleta não altera ninguém', async t => {
  const db = banco(t, [
    { ...residente, nome: 'James Walker (sub-14)' },
    { ...residente, id: 3, nome: 'Alex Carter (sub-14)', cpf: '12345678901', numCamisa: null },
  ]);
  await assert.rejects(salvarAluno(1, 7, { numCamisa: '10' }, 3), e => e.status === 409 && e.detalhes.conflito_camisa.jogador_id === 2);
  await assert.rejects(salvarAluno(1, 7, { numCamisa: '10', confirmar_camisa: { jogador_id: 2, camisa_anterior: 7 } }, 3), e => e.status === 409);
  assert.equal(db.rows()[0].numCamisa, 10);
  await salvarAluno(1, 7, { numCamisa: '10', confirmar_camisa: { jogador_id: 2, camisa_anterior: null } }, 3);
  assert.equal(db.rows()[0].numCamisa, null);
  assert.equal(db.rows()[1].numCamisa, 10);
});
test('falha de cadastro desfaz a retirada da camisa do outro jogador', async t => {
  const db = banco(t, [residente]); db.fail();
  await assert.rejects(salvarAluno(1, 7, { ...dados, confirmar_camisa: { jogador_id: 2, camisa_anterior: null } }), /Injected/);
  assert.equal(db.rows()[0].numCamisa, 10);
});

test('troca e atualização da escalação pertencem à mesma transação; falha desfaz ambas as camisas', async t => {
  const db = banco(t, [residente, { ...residente, id: 3, nome: 'Alex (sub-14)', cpf: '12345678901', numCamisa: null }]);
  db.tx.escalacaoPartida.findMany = async ({ where }) => {
    assert.deepEqual(where.jogador_id.in, [2, 3]);
    assert.equal(db.rows()[0].numCamisa, null);
    assert.equal(db.rows()[1].numCamisa, 10);
    throw Error('Injected lineup failure');
  };
  await assert.rejects(salvarAluno(1, 7, { numCamisa: '10', confirmar_camisa: { jogador_id: 2, camisa_anterior: null } }, 3), /Injected lineup/);
  assert.equal(db.rows()[0].numCamisa, 10);
  assert.equal(db.rows()[1].numCamisa, null);
});

test('camisa rejeita valores fora do intervalo, decimais, expoentes e emojis com erro de camisa', async t => {
  const db = banco(t, [residente]);
  for (const value of [0, 100, -1, 1.5, '00', '100', '1e1', '1⚽', '1️⃣', true]) {
    await assert.rejects(salvarAluno(1, 7, { numCamisa: value }, 2), e => e.status === 400 && /camisa/i.test(e.message) && !/nome/.test(e.message));
    assert.equal(db.rows()[0].numCamisa, 10);
  }
});
test('recusa confirmação obsoleta, clube alheio, categoria sem permissão e camisa inválida', async t => {
  const db = banco(t, [residente]);
  await assert.rejects(salvarAluno(1, 7, { ...dados, confirmar_camisa: { jogador_id: 99, camisa_anterior: null } }), e => e.status === 409);
  await assert.rejects(salvarAluno(99, 7, { numCamisa: 11 }, 2), e => e.status === 404);
  await assert.rejects(salvarAluno(1, 7, { ...dados, numCamisa: -1 }), e => e.status === 400);
  db.allow([12]);
  await assert.rejects(salvarAluno(1, 7, dados), e => e.status === 403);
});
test('recupera conflito serializável e limita tentativas concorrentes', async t => {
  const db = banco(t); db.retry(2);
  assert.equal(await transacaoElenco(async () => 42), 42);
  db.retry(3);
  await assert.rejects(transacaoElenco(async () => 42), e => e.status === 409);
});

test('conflito de unicidade de camisa não retorna erro de CPF', async () => {
  await assert.rejects(transacaoElenco(async () => {
    throw Object.assign(Error('unique'), { code: 'P2002', meta: { target: ['partida_id', 'time_id', 'numCamisa'] } });
  }), e => e.status === 409 && /numeração/.test(e.message) && !/CPF/.test(e.message));
});
test('atualização é idempotente e não toca registros de jogos', async t => {
  const db = banco(t, [aluno(1, 2013, 12, 21), aluno(2, 2012, 14, 21)]);
  assert.equal((await atualizarTemporada(1, agora)).atualizados, 1);
  assert.equal((await atualizarTemporada(1, agora)).atualizados, 0);
  assert.equal(db.rows()[0].numCamisa, null);
});

test('limite mínimo de quatro anos é aplicado à temporada', () => {
  assert.equal(categoriaPorNascimento('2022-12-20', agora), 'sub-7');
  assert.equal(categoriaPorNascimento('2023-01-01', agora), null);
});
test('API recusa emojis e notação científica nos campos de cadastro', async t => {
  banco(t);
  await assert.rejects(salvarAluno(1, 7, {...dados, nome:'Alex ⚽'}), e => e.status === 400);
  await assert.rejects(salvarAluno(1, 7, {...dados, cpf:'12345678901⚽'}), e => e.status === 400);
  await assert.rejects(salvarAluno(1, 7, {...dados, numCamisa:'1e1'}), e => e.status === 400);
  await assert.rejects(salvarAluno(1, 7, {...dados, posicao:'⚽'}), e => e.status === 400);
  const aluno = await salvarAluno(1, 7, {...dados, posicao:'Ala Direito'});
  assert.equal(aluno.posicao, 'Alas');
});
