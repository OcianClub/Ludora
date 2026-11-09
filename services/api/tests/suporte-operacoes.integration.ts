import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

type Conta = { papel: string; email: string; senha: string };
export type EmailTeste = { to: string; subject: string; text: string };
export function simularProvedor() {
  const mensagens: EmailTeste[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.origin === 'https://api.resend.com') {
      const email = JSON.parse(String(init?.body)) as EmailTeste;
      assert.match(email.to, /@equipe\.example\.test$/);
      mensagens.push(email);
      return Response.json({ id: randomUUID() });
    }
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Tráfego externo bloqueado no teste isolado.');
    return original(input, init);
  };
  return mensagens;
}

export async function testarOperacoes(prisma: PrismaClient, contas: Conta[], mensagens: EmailTeste[], hashSenha: (senha: string) => Promise<string>) {
  const senha = randomBytes(32).toString('base64url');
  const email = `client-${randomUUID().slice(0, 8)}@equipe.example.test`;
  const novoEmail = `new-${email}`;
  const u = await prisma.usuario.create({ data: { nome: 'Lakeview Client', email, senha: await hashSenha(senha) } });
  const clube = await prisma.clube.create({ data: { nome: 'Lakeview Test Club', usuarios: { create: { usuario_id: u.id, papel: 'ADMIN' } } } });
  async function req(endpoint: string, method = 'GET', body?: unknown, token?: string, clubeId?: number) {
    const res = await fetch('http://127.0.0.1:3018' + endpoint, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(clubeId ? { 'x-clube-id': String(clubeId) } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, data: await res.json().catch(() => null) as any };
  }
  const login = async (conta: { email: string; senha: string }) => {
    const r = await req('/auth/login', 'POST', conta); assert.equal(r.status, 200); return r.data.token as string;
  };
  const suporte = await login(contas.find(c => c.papel === 'SUPORTE')!);
  const admin = await login(contas.find(c => c.papel === 'SUPERADMIN')!);
  const dev = await login(contas.find(c => c.papel === 'DESENVOLVEDOR')!);
  const cliente = await login({ email, senha });
  const chamado = await req('/suporte', 'POST', { requestId: randomUUID(), assunto: 'Invite and access recovery', descricao: 'The invitation did not arrive. I need help recovering access.', tipo: 'RECUPERACAO', impacto: 'DIFICULDADE' }, cliente, clube.id);
  assert.equal(chamado.status, 201);
  const base = `/admin/equipe/chamados/${chamado.data.id}/operacoes`;
  const convite = await prisma.conviteClube.create({ data: { clube_id: clube.id, email: `coach-${email}`, papel: 'TECNICO', token_hash: randomUUID(), expira_em: new Date(Date.now() - 1) } });
  assert.equal((await req(base, 'GET', undefined, dev)).status, 403);
  assert.equal((await req(base, 'GET', undefined, cliente)).status, 403);
  const diag = (await req(base + '/convites/localizar', 'POST', { email: convite.email }, suporte)).data;
  assert.equal(diag[0].status, 'EXPIRADO');
  assert.equal(JSON.stringify(diag).includes(convite.token_hash), false);
  const enviar = { tipo: 'CONVITE', alvoId: convite.id, requestId: randomUUID() };
  const quantidade = mensagens.length;
  assert.equal((await req(base + '/envio', 'POST', enviar, suporte)).data.resultado, 'ACEITO_PELO_PROVEDOR');
  assert.equal((await req(base + '/envio', 'POST', enviar, suporte)).data.resultado, 'ACEITO_PELO_PROVEDOR');
  assert.equal(mensagens.length, quantidade + 1);
  assert.equal((await req(base + '/envio', 'POST', { ...enviar, requestId: randomUUID() }, suporte)).status, 409);
  assert.equal(await prisma.conviteClube.count({ where: { clube_id: clube.id } }), 1);
  assert.notEqual((await prisma.conviteClube.findUniqueOrThrow({ where: { id: convite.id } })).token_hash, convite.token_hash);
  const recuperar = await req(base + '/envio', 'POST', { tipo: 'RECUPERACAO', alvoId: String(u.id), requestId: randomUUID() }, suporte);
  assert.equal(recuperar.data.resultado, 'ENVIADO');
  const pedido = await req(base + '/recuperacao-excepcional', 'POST', { novoEmail, justificativa: 'Cliente perdeu o acesso ao endereço anterior.' }, suporte);
  assert.equal(pedido.status, 201);
  const decidir = `${base}/recuperacao-excepcional/${pedido.data.id}/decidir`;
  const decisao = { aprovar: true, verificacao: 'Identidade validada por contato institucional conhecido.' };
  assert.equal((await req(decidir, 'POST', decisao, suporte)).status, 403);
  assert.equal((await req(decidir, 'POST', decisao, admin)).data.resultado, 'AGUARDANDO_CONFIRMACAO');
  assert.equal((await prisma.usuario.findUniqueOrThrow({ where: { id: u.id } })).email, email);
  const confirmacao = [...mensagens].reverse().find(m => m.to === novoEmail);
  assert.match(confirmacao?.text || '', /http:\/\/localhost:5198\/confirmar-email/);
  const codigo = confirmacao?.text.match(/[a-zA-Z0-9_-]{43}/)?.[0];
  assert.ok(codigo);
  assert.equal((await req('/auth/confirmar-troca-email', 'POST', { email: novoEmail, codigo })).status, 200);
  assert.equal((await req('/auth/confirmar-troca-email', 'POST', { email: novoEmail, codigo })).status, 400);
  assert.equal((await req('/suporte', 'GET', undefined, cliente)).status, 401);
  assert.equal((await prisma.usuario.findUniqueOrThrow({ where: { id: u.id } })).email, novoEmail);
  assert.equal((await req('/auth/login', 'POST', { email: novoEmail, senha })).status, 401);
  assert.ok(mensagens.some(m => m.to === email && m.subject.includes('alterado')));
  assert.ok(await prisma.suporteHistorico.count({ where: { chamadoId: chamado.data.id, acao: 'AVISO_ANTIGO_ENVIADO' } }));
  console.log('PASS convite expirado, reenvio idempotente, limite, recuperação, aprovação independente, confirmação única, sessão revogada e aviso ao endereço antigo. Provedor simulado em memória.');
}
