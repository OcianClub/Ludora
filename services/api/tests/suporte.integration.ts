import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import express from 'express';
import type { AddressInfo } from 'node:net';

async function main() {
  const pasta = path.resolve('../../.local-demo/equipe');
  const config = JSON.parse(await fs.readFile(path.join(pasta, 'config.json'), 'utf8'));
  const url = new URL(config.databaseUrl);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55448'); assert.equal(url.pathname, '/ludora_equipe');
  Object.assign(process.env, { DATABASE_URL: url.href, DIRECT_URL: url.href, JWT_SECRET: config.jwtSecret, NODE_ENV: 'test' });
  const contas = JSON.parse(await fs.readFile(path.join(pasta, 'contas.json'), 'utf8'));
  const tokens: Record<string, string> = {};
  for (const c of contas) {
    const r = await fetch('http://127.0.0.1:3018/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: c.email, senha: c.senha }) });
    assert.equal(r.status, 200); tokens[c.papel] = (await r.json() as any).token;
  }
  async function req(papel: string, caminho: string, method = 'GET', body?: unknown) {
    const r = await fetch('http://127.0.0.1:3018' + caminho, { method, headers: { Authorization: `Bearer ${tokens[papel]}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) as any };
  }
  const input = { requestId: randomUUID(), assunto: 'Convite não recebido', descricao: 'Solicitei convite e o e-mail não chegou.', tipo: 'CONVITE', impacto: 'DIFICULDADE', rota: '/partidas?token=private' };
  const manual = await req('USUARIO', '/suporte', 'POST', input); assert.equal(manual.status, 201);
  const id = manual.body.id;
  assert.equal((await req('USUARIO', '/suporte', 'POST', input)).body.id, id);
  assert.equal((await req('DESENVOLVEDOR', `/admin/equipe/chamados/${id}`)).status, 403);
  const detail = await req('SUPORTE', `/admin/equipe/chamados/${id}`); assert.equal(detail.status, 200); assert.equal(detail.body.rota, '/partidas');
  assert.equal((await req('SUPORTE', `/admin/equipe/chamados/${id}`, 'PATCH', { acao: 'ENCAMINHAR', motivo: 'Open invitations and submit. The action fails.', revisao: detail.body.revisao })).status, 200);
  const report = await req('DESENVOLVEDOR', `/admin/equipe/chamados/${id}`); assert.ok(report.body.detalhesTecnicos.reproducao);
  assert.equal((await req('DESENVOLVEDOR', `/admin/equipe/chamados/${id}`, 'PATCH', { acao: 'STATUS', status: 'RESOLVIDO', motivo: 'Tentativa proibida de encerrar.', revisao: report.body.revisao })).status, 403);
  assert.equal((await req('DESENVOLVEDOR', `/admin/equipe/chamados/${id}`, 'PATCH', { acao: 'DEVOLVER', motivo: 'Correção pronta para conferir com o cliente.', revisao: report.body.revisao })).status, 200);
  const restricted = await req('USUARIO', '/suporte', 'POST', { ...input, requestId: randomUUID(), tipo: 'RECUPERACAO' });
  assert.equal((await req('SUPORTE', `/admin/equipe/chamados/${restricted.body.id}`)).status, 200);
  assert.equal((await req('DESENVOLVEDOR', `/admin/equipe/chamados/${restricted.body.id}`)).status, 403);
  assert.equal((await req('SUPERADMIN', `/admin/equipe/chamados/${restricted.body.id}`)).status, 200);
  const endpoint = '/admin/equipe/chamados';
  const interno = { ...input, assunto: 'Score overlaps the date', descricao: 'Open a fixture on a narrow screen and inspect the header.', requestId: randomUUID(), tipo: 'ERRO', servico: 'web' };
  assert.equal((await req('DESENVOLVEDOR', endpoint, 'POST', interno)).status, 403);
  assert.equal((await req('USUARIO', endpoint, 'POST', interno)).status, 403);
  const aberto = await req('SUPORTE', endpoint, 'POST', interno);
  assert.equal(aberto.status, 201);
  assert.equal((await req('SUPORTE', endpoint, 'POST', interno)).body.id, aberto.body.id);
  assert.equal((await req('SUPERADMIN', endpoint, 'POST', interno)).status, 409);
  const ref = `${endpoint}/${aberto.body.id}`;
  assert.equal((await req('DESENVOLVEDOR', ref)).status, 403);
  assert.equal((await req('SUPERADMIN', ref)).body.usuarioId, null);
  assert.equal((await req('SUPORTE', ref, 'PATCH', { acao: 'ENCAMINHAR', motivo: interno.descricao, revisao: 0 })).status, 200);
  const detalheDev = await req('DESENVOLVEDOR', ref);
  assert.equal(detalheDev.body.detalhesTecnicos.reproducao, interno.descricao);
  assert.equal((await req('DESENVOLVEDOR', ref + '/operacoes/convites/localizar', 'POST', { email: 'test@example.test' })).status, 403);
  assert.equal((await req('DESENVOLVEDOR', ref, 'PATCH', { acao: 'DEVOLVER', motivo: 'Corrigido no renderer.', revisao: detalheDev.body.revisao })).status, 200);
  const meus = await req('SUPORTE', endpoint + '?visao=MEUS&busca=' + aberto.body.id);
  assert.equal(meus.body[0].id, aberto.body.id);
  assert.ok((await req('SUPORTE', ref)).body.historico.some((item: { acao: string }) => item.acao === 'DEVOLVER'));
  const { correlacionarFalhas } = await import('../src/modules/suporte/service.js');
  const { tratarErroHttp } = await import('../src/middlewares/http-errors.middleware.js');
  const { prisma } = await import('../src/lib/prisma.js');
  const rota = `/test-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const apiFalha = express();
  apiFalha.use(correlacionarFalhas);
  apiFalha.get(rota, () => {
    const erro = new Error('private message');
    erro.stack = 'private message\n at handler (C:/private/account.ts:25:4)';
    throw erro;
  });
  apiFalha.use(tratarErroHttp);
  const server = apiFalha.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', r));
  const porta = (server.address() as AddressInfo).port;
  try {
    for (let i = 0; i < 3; i++) {
      const correlacao = randomUUID();
      const resposta = await fetch(`http://127.0.0.1:${porta}${rota}`, { headers: { 'x-request-id': correlacao } });
      assert.equal(resposta.status, 500);
      assert.equal(resposta.headers.get('x-correlation-id'), correlacao);
    }
  } finally { await new Promise<void>(r => server.close(() => r())); }
  for (let i = 0; i < 40; i++) {
    if (await prisma.suporteChamado.count({ where: { rota, ocorrencias: 3 } })) break;
    await new Promise(r => setTimeout(r, 25));
  }
  const automatic = await prisma.suporteChamado.findFirstOrThrow({ where: { rota } });
  assert.equal(await prisma.suporteChamado.count({ where: { rota } }), 1);
  assert.equal(automatic.ocorrencias, 3); assert.equal(automatic.fila, 'DESENVOLVIMENTO');
  assert.equal(JSON.stringify(automatic).includes('private message'), false);
  await fs.writeFile(path.join(pasta, 'chamados.json'), JSON.stringify({ manual: id, automatico: automatic.id, restrito: restricted.body.id }));
  await prisma.$disconnect();
  console.log('PASS chamados persistidos, repetição, restrição, encaminhamento, devolução e regra de recorrência.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
