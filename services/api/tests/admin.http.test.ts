import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import type { AddressInfo } from 'node:net';
import { prisma } from '../src/lib/prisma';
import { JWT_SECRET, JWT_OPTIONS } from '../src/config/env';
import { criarAdminRoutes } from '../src/modules/admin/admin.routes';
import { logs, registrarRequisicoes } from '../src/modules/admin/superadmin';

// HTTP, JWT e middlewares reais; somente a persistência é substituída.
// Não conecta ao Supabase e não altera nenhum dado.
test('painel Super Admin: autorização, proteção de dados e regras de segurança', async t => {
  const DEV = { id: 1, nome: 'Dev', email: 'dev@ludora.com' };
  const COMUM = { id: 2, nome: 'Treinador', email: 'treinador@clube.com' };
  const usuarios: Record<number, typeof DEV> = { 1: DEV, 2: COMUM };
  process.env.SUPERADMIN_EMAILS = 'DEV@ludora.com';

  const chamadas: Record<string, any[]> = { usuarioFindMany: [], clubeCreate: [], categoriaCreateMany: [], vinculoCreate: [], vinculoDelete: [] };
  let outrosAdmins = 0;
  let vinculoAtual: any = { id: 7, papel: 'ADMIN' };

  function replace(target: any, key: string, value: any) { const antes = target[key]; target[key] = value; t.after(() => { target[key] = antes; }); }
  // Como o Prisma real: devolve só as colunas pedidas em `select`.
  replace(prisma.usuario, 'findUnique', async ({ where, select }: any) => {
    const u = usuarios[where.id];
    if (!u) return null;
    const completo: any = { ...u, versao_sessao: 0 };
    return select ? Object.fromEntries(Object.keys(select).filter(k => select[k]).map(k => [k, completo[k]])) : completo;
  });
  replace(prisma.usuario, 'findMany', async (args: any) => {
    chamadas.usuarioFindMany.push(args);
    return [{ id: 1, nome: 'Dev', email: 'dev@ludora.com', criadoEm: new Date(), clubes: [{ papel: 'ADMIN', clube: { id: 3, nome: 'Ocian' } }] }];
  });
  const tx = {
    clube: {
      findUnique: async () => ({ id: 3 }),
      create: async (a: any) => { chamadas.clubeCreate.push(a); return { id: 99, ...a.data }; },
    },
    usuario: { findUnique: async ({ where }: any) => (where.email === 'dev@ludora.com' ? { id: 1 } : where.id === 5 ? { id: 5 } : null) },
    categoria: { count: async () => 0, createMany: async (a: any) => { chamadas.categoriaCreateMany.push(a); } },
    usuarioClube: {
      findUnique: async () => vinculoAtual,
      count: async () => outrosAdmins,
      create: async (a: any) => { chamadas.vinculoCreate.push(a); },
      update: async () => {},
      delete: async (a: any) => { chamadas.vinculoDelete.push(a); },
    },
    usuarioClubeCategoria: { deleteMany: async () => {} },
  };
  replace(prisma, '$transaction', async (fn: any) => fn(tx));

  const io = new Server();
  const app = express();
  app.use(express.json(), registrarRequisicoes, criarAdminRoutes(io));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', r));
  io.attach(server);
  t.after(() => { io.close(); }); // fecha também o servidor HTTP anexado
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const token = (id: number) => jwt.sign({ id, versao_sessao: 0 }, JWT_SECRET, JWT_OPTIONS);
  const chamar = (metodo: string, caminho: string, usuario?: number, corpo?: unknown) => fetch(base + caminho, {
    method: metodo,
    headers: { ...(corpo ? { 'Content-Type': 'application/json' } : {}), ...(usuario ? { Authorization: `Bearer ${token(usuario)}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });

  await t.test('sem token: 401; usuário comum (mesmo gestor de clube): 403; todas as rotas protegidas', async () => {
    const rotas: [string, string][] = [['GET', '/admin/me'], ['GET', '/admin/overview'], ['POST', '/admin/clubes'], ['PATCH', '/admin/clubes/3'],
      ['GET', '/admin/clubes/3/membros'], ['PUT', '/admin/clubes/3/membros/5'], ['DELETE', '/admin/clubes/3/membros/5'],
      ['GET', '/admin/usuarios'], ['POST', '/admin/usuarios/5/revogar-sessoes'], ['GET', '/admin/db/status'], ['GET', '/admin/sistema'], ['GET', '/admin/logs']];
    for (const [m, c] of rotas) {
      assert.equal((await chamar(m, c)).status, 401, `${m} ${c} sem token`);
      assert.equal((await chamar(m, c, COMUM.id, m === 'GET' ? undefined : {})).status, 403, `${m} ${c} usuário comum`);
    }
    assert.equal(logs.snapshot(50).some(e => e.nivel === 'warn' && /negado/i.test(e.mensagem)), true, 'tentativa negada fica registrada');
  });

  await t.test('lista vazia de super admins não libera ninguém, nem quem "parece" admin', async () => {
    process.env.SUPERADMIN_EMAILS = '';
    assert.equal((await chamar('GET', '/admin/me', DEV.id)).status, 403);
    delete process.env.SUPERADMIN_EMAILS;
    assert.equal((await chamar('GET', '/admin/me', DEV.id)).status, 403);
    process.env.SUPERADMIN_EMAILS = 'DEV@ludora.com';
  });

  await t.test('super admin (e-mail da allowlist, sem diferença de caixa) acessa /admin/me', async () => {
    const r = await chamar('GET', '/admin/me', DEV.id);
    assert.equal(r.status, 200);
    assert.deepEqual((await r.json()).usuario, DEV);
  });

  await t.test('usuários: seleção explícita, o hash da senha nunca é pedido nem devolvido', async () => {
    const r = await chamar('GET', '/admin/usuarios?busca=ana@x.com', DEV.id);
    assert.equal(r.status, 200);
    const select = chamadas.usuarioFindMany.at(-1).select;
    assert.ok(select && !('senha' in select), 'select não inclui senha');
    const corpo = JSON.stringify(await r.json());
    assert.ok(!/senha|password|hash/i.test(corpo));
    assert.match(corpo, /"superadmin":true/);
  });

  await t.test('clube: validação de plano, UF e escudo https; nome obrigatório', async () => {
    for (const ruim of [{}, { nome: 'X' }, { nome: 'Clube', plano: 'GRATIS' }, { nome: 'Clube', estado: 'São Paulo' }, { nome: 'Clube', escudo: 'http://x.test/a.png' }]) {
      assert.equal((await chamar('POST', '/admin/clubes', DEV.id, ruim)).status, 400, JSON.stringify(ruim));
    }
    assert.equal((await chamar('PATCH', '/admin/clubes/3', DEV.id, {})).status, 400, 'PATCH vazio');
    assert.equal((await chamar('PATCH', '/admin/clubes/abc', DEV.id, { plano: 'PRO' })).status, 400, 'id inválido');
  });

  await t.test('criar clube cria as 8 categorias padrão e vincula o administrador informado', async () => {
    const r = await chamar('POST', '/admin/clubes', DEV.id, { nome: ' Escola Nova ', estado: 'sp', admin_email: 'dev@ludora.com' });
    assert.equal(r.status, 201);
    assert.equal(chamadas.clubeCreate.at(-1).data.nome, 'Escola Nova');
    assert.equal(chamadas.clubeCreate.at(-1).data.plano, 'TRIAL');
    const cats = chamadas.categoriaCreateMany.at(-1).data;
    assert.deepEqual(cats.map((c: any) => c.nome), ['sub-7', 'sub-8', 'sub-9', 'sub-10', 'sub-12', 'sub-14', 'sub-16', 'sub-18']);
    assert.equal(cats.find((c: any) => c.nome === 'sub-10').tipo, 'INICIACAO');
    assert.equal(cats.find((c: any) => c.nome === 'sub-12').tipo, 'BASE');
    assert.deepEqual(chamadas.vinculoCreate.at(-1).data, { usuario_id: 1, clube_id: 99, papel: 'ADMIN', acesso_todas_categorias: true });
    const semDono = await chamar('POST', '/admin/clubes', DEV.id, { nome: 'Outro', admin_email: 'ninguem@x.com' });
    assert.equal(semDono.status, 400);
  });

  await t.test('último administrador não pode ser rebaixado nem removido (evita clube sem dono)', async () => {
    outrosAdmins = 0; vinculoAtual = { id: 7, papel: 'ADMIN' };
    assert.equal((await chamar('PUT', '/admin/clubes/3/membros/5', DEV.id, { papel: 'TORCEDOR' })).status, 409);
    assert.equal((await chamar('DELETE', '/admin/clubes/3/membros/5', DEV.id)).status, 409);
    assert.equal(chamadas.vinculoDelete.length, 0);
    outrosAdmins = 1;
    assert.equal((await chamar('PUT', '/admin/clubes/3/membros/5', DEV.id, { papel: 'TORCEDOR' })).status, 200);
    assert.equal((await chamar('DELETE', '/admin/clubes/3/membros/5', DEV.id)).status, 200);
    assert.equal(chamadas.vinculoDelete.length, 1);
  });

  await t.test('cargo reaproveita validarCargo: técnico exige categorias; cargo desconhecido é recusado', async () => {
    assert.equal((await chamar('PUT', '/admin/clubes/3/membros/5', DEV.id, { papel: 'TECNICO' })).status, 400);
    assert.equal((await chamar('PUT', '/admin/clubes/3/membros/5', DEV.id, { papel: 'DONO' })).status, 400);
  });

  await t.test('logs: sem query string nem token, e ações administrativas viram auditoria', async () => {
    await chamar('GET', '/admin/usuarios?busca=segredo@x.com', DEV.id);
    const todos = JSON.stringify((await (await chamar('GET', '/admin/logs?limite=500', DEV.id)).json()));
    assert.ok(!todos.includes('segredo@x.com'), 'query string não aparece');
    assert.ok(!todos.includes(token(DEV.id)), 'token não aparece');
    assert.match(todos, /Clube criado: #99/);
    assert.match(todos, /Permissão: usuário #5/);
  });
});
