import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prisma } from '../src/lib/prisma';
import { criarTarefasCadastroRoutes } from '../src/modules/admin/tarefas-cadastro';

test('pendências: e-mail dos administradores, gravação e entrega individual sem duplicidade', async t => {
  const avisos: any[] = [], emissions: any[] = [];
  let tarefa: any = null, autorizados = 2, mudou = false;
  const patch = (target: any, key: string, value: any) => { const old = target[key]; target[key] = value; t.after(() => { target[key] = old; }); };
  patch(prisma.usuarioClube, 'findMany', async ({ where, select }: any) => {
    assert.equal(where.papel, 'ADMIN'); assert.equal(where.usuario.suspenso, false); assert.equal(select.usuario.select.email, true);
    return [{ usuario: { id: 7, nome: 'Ana', email: 'ana@exemplo.test' } }];
  });
  patch(prisma.clube, 'findUnique', async () => ({ id: 1, nome: 'Ocian', ativo: true, escudo: mudou ? 'escudo.png' : null, endereco: null, cnpj: null }));
  patch(prisma.usuarioClube, 'count', async ({ where }: any) => { assert.equal(where.clube_id, 1); assert.equal(where.papel, 'ADMIN'); assert.equal(where.usuario.suspenso, false); return autorizados; });
  patch(prisma.tarefaCadastroClube, 'findUnique', async () => tarefa);
  patch(prisma.tarefaCadastroClube, 'create', async ({ data }: any) => tarefa = { id: 'tarefa', ...data });
  patch(prisma.notificacao, 'create', async ({ data }: any) => { const salvo = { id: avisos.length + 1, ...data }; avisos.push(salvo); return salvo; });
  patch(prisma, '$transaction', async (fn: any, options: any) => { assert.equal(options.isolationLevel, 'Serializable'); return fn(prisma); });
  const router = criarTarefasCadastroRoutes({ to: (room: string) => ({ emit: (event: string, data: any) => emissions.push({ room, event, data }) }) } as any);
  async function call(method: string, path: string, body: any = {}) {
    const layer = (router as any).stack.find((l: any) => l.route?.path === path && l.route.methods[method]); let status = 200, result: any;
    const res = { status(n: number) { status = n; return res; }, json(v: any) { result = v; return res; } };
    await layer.route.stack.at(-1).handle({ params: { id: '1' }, usuarioId: 99, body }, res);
    return { status, result };
  }
  const lista = await call('get', '/admin/cadastro-pendente/:id/destinatarios');
  assert.equal(lista.result[0].email, 'ana@exemplo.test');
  const body = { motivo: 'ESCUDO', destinatarios: [7, 8, 7], mensagemEsperada: 'Complete o cadastro de Ocian. Falta informar: escudo do clube. Entre em contato com a equipe Ludora para atualizar os dados.' };
  autorizados = 1;
  assert.equal((await call('post', '/admin/cadastro-pendente/:id', body)).status, 403); assert.equal(avisos.length, 0);
  autorizados = 2;
  assert.equal((await call('post', '/admin/cadastro-pendente/:id', { ...body, mensagemEsperada: 'antiga' })).status, 409); assert.equal(avisos.length, 0);
  const enviado = await call('post', '/admin/cadastro-pendente/:id', body);
  assert.equal(enviado.status, 201); assert.equal(enviado.result.caixasAtualizadas, 2);
  assert.deepEqual(avisos.map(a => a.usuario_id), [7, 8]);
  assert.ok(avisos.every(a => a.clube_id === 1 && a.tipo === 'CADASTRO_CLUBE' && a.dados.tarefaId === 'tarefa'));
  assert.deepEqual(emissions.map(e => [e.room, e.event]), [['usuario:7', 'notificacao_criada'], ['usuario:8', 'notificacao_criada']]);
  assert.deepEqual(emissions.map(e => e.data), avisos);
  assert.equal((await call('post', '/admin/cadastro-pendente/:id', body)).status, 409); assert.equal(avisos.length, 2);
  tarefa = null; mudou = true;
  assert.equal((await call('post', '/admin/cadastro-pendente/:id', body)).status, 409); assert.equal(avisos.length, 2);
});
