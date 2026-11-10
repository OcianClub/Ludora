import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consultarLembrete, enviarLembrete } from '../src/modules/admin/partidas-revisao';

const agora = new Date('2026-11-10T12:00:00Z');
function fixture() {
  const p = { id: 1, status: 'AO_VIVO', organizador_id: 9, sumula_clube_id: 9, categoria_id: 7,
    mandante: { nome: 'Ocian' }, visitante: { nome: 'Santos' },
    auditoria: [{ acao: 'STATUS_AO_VIVO', criado_em: new Date('2026-11-08T12:00:00Z') }] };
  const notificacoes: any[] = [], auditorias: any[] = [], filtros: any[] = [];
  const clube = { id: 9, nome: 'Organizador', ativo: true };
  const gestores = [{ papel: 'ADMIN', usuario: { id: 25, nome: 'Gestor', email: 'gestor@example.test' } }];
  const tx = {
    $queryRaw: async () => [{ id: 1 }],
    partida: { findUnique: async () => p }, clube: { findUnique: async () => clube },
    usuarioClube: { findMany: async (arg: any) => { filtros.push(arg); return gestores; } },
    auditoriaPartida: { findFirst: async () => auditorias.at(-1) ?? null, create: async ({ data }: any) => { auditorias.push(data); return data; } },
    notificacao: { create: async ({ data }: any) => { const n = { id: notificacoes.length + 1, ...data }; notificacoes.push(n); return n; } },
  };
  let fila: Promise<unknown> = Promise.resolve();
  const banco = { ...tx, $transaction: (fn: (tx: any) => Promise<unknown>) => {
    const result = fila.then(() => fn(tx)); fila = result.catch(() => {}); return result;
  } };
  return { banco, p, clube, gestores, notificacoes, auditorias, filtros };
}

test('Lembrete vai somente ao gestor selecionado do organizador e não altera a partida', async () => {
  const f = fixture();
  await enviarLembrete(f.banco as any, 1, 25, 99, agora);
  assert.equal(f.notificacoes.length, 1);
  assert.equal(f.notificacoes[0].usuario_id, 25);
  assert.equal(f.notificacoes[0].clube_id, 9);
  assert.equal(f.auditorias[0].usuario_id, 99);
  assert.equal(f.p.status, 'AO_VIVO');
  assert.equal(f.filtros[0].where.clube_id, 9);
  assert.deepEqual(f.filtros[0].where.usuario, { suspenso: false });
  assert.equal(f.notificacoes[0].corpo.includes('há mais de 24 horas ao vivo'), true);
});

test('Consulta retorna e-mail para distinguir contas com o mesmo nome sem duplicar destinatários', async () => {
  const f = fixture();
  f.gestores.push({ papel: 'ADMIN', usuario: { id: 26, nome: 'Gestor', email: 'outro@example.test' } });
  const ctx = await consultarLembrete(f.banco as any, 1, agora);
  assert.equal(f.filtros[0].select.usuario.select.email, true);
  assert.deepEqual(ctx.gestores.map(g => g.email), ['gestor@example.test', 'outro@example.test']);
  assert.equal(ctx.gestores.length, 2);
  assert.equal(f.notificacoes.length, 0);
});

test('Cliques simultâneos e repetidos não enviam mais de um lembrete por 24 horas', async () => {
  const f = fixture();
  const r = await Promise.allSettled([enviarLembrete(f.banco as any, 1, 25, 99, agora), enviarLembrete(f.banco as any, 1, 25, 98, agora)]);
  assert.equal(r.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(f.notificacoes.length, 1);
  await assert.rejects(enviarLembrete(f.banco as any, 1, 25, 99, new Date(agora.getTime() + 1000)), /últimas 24 horas/);
  await enviarLembrete(f.banco as any, 1, 25, 99, new Date(agora.getTime() + 86400000));
  assert.equal(f.notificacoes.length, 2);
});

test('Recusa destinatário indevido, clube desativado, partida encerrada ou início recente', async () => {
  const f = fixture();
  await assert.rejects(enviarLembrete(f.banco as any, 1, 26, 99, agora), /gestor habilitado/);
  f.clube.ativo = false;
  await assert.rejects(enviarLembrete(f.banco as any, 1, 25, 99, agora), /organizador não está disponível/);
  f.clube.ativo = true; f.p.status = 'FINALIZADA';
  await assert.rejects(enviarLembrete(f.banco as any, 1, 25, 99, agora), /já não está ao vivo/);
  f.p.status = 'AO_VIVO'; f.p.auditoria[0].criado_em = agora;
  await assert.rejects(enviarLembrete(f.banco as any, 1, 25, 99, agora), /24 horas/);
  assert.equal(f.notificacoes.length, 0);
});

test('Sem início comprovado, o lembrete não afirma duração; consulta não envia nada', async () => {
  const f = fixture(); f.p.auditoria = [];
  const ctx = await consultarLembrete(f.banco as any, 1, agora);
  assert.equal(ctx.inicio, null);
  assert.equal(f.notificacoes.length, 0);
  await enviarLembrete(f.banco as any, 1, 25, 99, agora);
  assert.equal(f.notificacoes[0].corpo.includes('há mais de 24'), false);
  assert.equal(f.notificacoes[0].corpo.includes('início não foi registrado'), true);
});

test('Súmula transferida: avisa o organizador para solicitar o encerramento ao operador', async () => {
  const f = fixture(); f.p.sumula_clube_id = 10;
  await enviarLembrete(f.banco as any, 1, 25, 99, agora);
  assert.equal(f.notificacoes[0].clube_id, 9);
  assert.match(f.notificacoes[0].corpo, /solicite ao responsável pela súmula/);
});
