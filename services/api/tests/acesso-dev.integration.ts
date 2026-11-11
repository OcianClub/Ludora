import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import axios from 'axios';
import type { PrismaClient } from '@prisma/client';
import { ORIGEM, extrairEquipes, interpretarEvento } from '../src/modules/paulista/provider';

export async function testarAcessoDev(prisma: PrismaClient, contas: { papel: string; email: string; senha: string }[], pasta: string) {
  const origem = 'http://127.0.0.1:3018';
  async function entrar(papel: string) {
    const conta = contas.find(c => c.papel === papel);
    assert.ok(conta);
    const login = await fetch(`${origem}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(conta) });
    assert.equal(login.status, 200);
    return await login.json() as { token: string; usuario: { id: number } };
  }
  const dev = await entrar('DESENVOLVEDOR');
  const admin = await entrar('SUPERADMIN');
  const suporte = await entrar('SUPORTE');
  async function req(rota: string, method = 'GET', body?: object, token = dev.token) {
    const resposta = await fetch(origem + rota, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
    return { status: resposta.status, data: await resposta.json().catch(() => null) };
  }

  const nomeOriginal = `Harbor Client ${randomUUID().slice(0, 8)}`;
  const cliente = await prisma.usuario.create({ data: { nome: nomeOriginal, email: `${randomUUID()}@equipe.example.test`, senha: 'login-desabilitado-no-teste' } });
  const clube = await prisma.clube.create({ data: { nome: `Harbor Club ${cliente.id}`, usuarios: { create: { usuario_id: cliente.id, papel: 'ADMIN' } } } });
  const categoria = await prisma.categoria.create({ data: { clube_id: clube.id, nome: 'sub-12', tipo: 'BASE', faixaIdade: 12 } });
  const jogador = await prisma.jogador.create({ data: { nome: 'Harbor Player', cpf: String(randomInt(10000000000, 99999999999)), dtNasc: new Date('2014-02-02'), posicao: 'Fixo', categoria_id: categoria.id } });
  const convite = await prisma.conviteClube.create({ data: { clube_id: clube.id, email: 'coach-private@equipe.example.test', papel: 'ADMIN', token_hash: randomUUID(), codigo_cifrado: 'simulado', expira_em: new Date(Date.now() + 3600000) } });

  const clubPath = `/admin/clubes/${clube.id}`;
  const perfil = `${clubPath}/categorias/${categoria.id}/jogadores/${jogador.id}`;
  const conta = `/admin/usuarios/${cliente.id}`;
  for (const rota of [`${clubPath}/resumo`, `${clubPath}/membros`, `${clubPath}/atividade`, perfil, `${clubPath}/convites`]) {
    assert.equal((await req(rota)).status, 200, rota);
  }
  assert.equal((await req(perfil)).data.cpf, undefined);
  assert.equal((await req(perfil, 'GET', undefined, admin.token)).data.cpf, jogador.cpf);
  const conviteDev = (await req(`${clubPath}/convites`)).data.convites[0];
  assert.equal(conviteDev.email, 'c***@equipe.example.test');
  assert.equal(conviteDev.codigo_disponivel, false);
  assert.equal((await req(`${clubPath}/convites/${convite.id}/codigo`)).status, 403);
  for (const [method, rota] of [
    ['DELETE', clubPath], ['PATCH', `${clubPath}/estado`], ['DELETE', `${clubPath}/membros/${cliente.id}`],
    ['DELETE', perfil], ['PATCH', `${conta}/controle`], ['POST', `${conta}/revogar-sessoes`],
    ['POST', '/admin/equipe/manutencao'], ['POST', `${clubPath}/convites/${convite.id}/revogar`],
  ]) assert.equal((await req(rota, method, {})).status, 403, `${method} ${rota}`);
  assert.equal((await req(`${conta}/nome`, 'PATCH', { nome: 'Harbor Client', email: 'changed@example.test' })).status, 400);
  assert.equal((await req(`/admin/usuarios/${admin.usuario.id}/nome`, 'PATCH', { nome: 'Harbor Administrator' })).status, 403);
  assert.equal((await req(`${conta}/nome`, 'PATCH', { nome: 'Harbor Client' }, suporte.token)).status, 403);
  const nome = `${nomeOriginal} Reviewed`;
  assert.deepEqual((await req(`${conta}/nome`, 'PATCH', { nome })).data, { nome, alterou: true });
  assert.deepEqual((await req(`${conta}/nome`, 'PATCH', { nome })).data, { nome, alterou: false });
  const auditorias = await prisma.auditoriaContaInterna.findMany({ where: { usuarioId: cliente.id } });
  assert.equal(auditorias.length, 1);
  assert.equal(auditorias[0].operadorId, dev.usuario.id);
  assert.deepEqual(auditorias[0].antes, { nome: nomeOriginal });
  assert.deepEqual(auditorias[0].depois, { nome });
  const atual = await prisma.usuario.findUniqueOrThrow({ where: { id: cliente.id } });
  assert.deepEqual([atual.email, atual.papel_plataforma, atual.versao_sessao], [cliente.email, cliente.papel_plataforma, cliente.versao_sessao]);

  const logsDev = (await req('/admin/logs?limite=500')).data;
  assert.ok(logsDev.some((l: { caminho: string }) => l.caminho === '/admin/usuarios/:id/nome'));
  assert.ok(logsDev.every((l: { tipo: string; usuarioId?: number; clubeId?: number }) => l.tipo === 'http' && l.usuarioId === undefined && l.clubeId === undefined));
  assert.ok((await req('/admin/logs?limite=500', 'GET', undefined, admin.token)).data.some((l: { tipo: string; mensagem: string }) => l.tipo === 'audit' && l.mensagem.includes(`usuário #${cliente.id}`)));

  const fixture: { clubeId: number; contaId: number; nome: string; eventoId?: number } = { clubeId: clube.id, contaId: cliente.id, nome };
  if (process.env.PAULISTA_ENABLED === 'true') {
    const eventoId = randomInt(94000000, 96000000);
    const htmlEquipes = `<a href="/evento/${eventoId}/equipe/21"><p>Harbor FC</p></a><a href="/evento/${eventoId}/equipe/22"><p>Coastal FC</p></a>`;
    const htmlJogos = `<h5>Campeonato Paulista, Temporada 2026 <br> Categoria Sub-12, Divisao A2 TESTE</h5>
      <a id="pills-fase-10-tab">FASE DE CLASSIFICAÇÃO</a><div role="tabpanel" id="pills-fase-10"><table><tbody><tr>
      <td>21/03</td><td>09:30h</td><td>Harbor Arena</td><td><span class="nome_clube">Harbor FC</span><span class="result">1 x 1</span><span class="nome_clube">Coastal FC</span></td>
      </tr></tbody></table></div>`;
    const snapshot = interpretarEvento(eventoId, htmlJogos, extrairEquipes(htmlEquipes, eventoId), '');
    const { importar } = await import('../src/modules/paulista/service.js');
    await importar(prisma, snapshot, admin.usuario.id);
    await prisma.fpfsCatalogo.create({ data: { id: eventoId, ano: snapshot.ano, categoria: snapshot.categoria, divisao: snapshot.divisao, equipes: snapshot.equipes.map(e => ({ ...e })) } });
    const rotaEvento = `/admin/paulista/eventos/${eventoId}`;
    assert.equal((await req(rotaEvento)).status, 200);
    assert.equal((await req(`${rotaEvento}/historico`)).status, 200);
    assert.equal((await req(`${rotaEvento}/sincronizar`, 'POST', {})).status, 403);
    assert.equal((await req(`${rotaEvento}/acompanhamento`, 'POST', { acompanhado: true })).status, 403);
    await prisma.fpfsCatalogo.update({ where: { id: eventoId }, data: { acompanhado: true, erro: 'Falha simulada na consulta anterior.' } });
    const pausa = await prisma.manutencao.create({ data: {
      operacao: 'SINCRONIZAR_PAULISTA', escopo: 'EVENTO', alvoId: eventoId, motivo: 'Fixture under maintenance.',
      operadorId: admin.usuario.id, revisarEm: new Date(Date.now() + 3600000),
    } });
    try { assert.equal((await req(`${rotaEvento}/sincronizar`, 'POST', {})).status, 423); }
    finally { await prisma.manutencao.delete({ where: { id: pausa.id } }); }

    const original = axios.getAdapter(axios.defaults.adapter);
    axios.defaults.adapter = async config => {
      if (!config.url?.startsWith(ORIGEM)) return original(config);
      const sufixo = config.url.slice(`${ORIGEM}/evento/${eventoId}`.length);
      assert.ok(config.url.startsWith(`${ORIGEM}/evento/${eventoId}`) && ['', '/equipes', '/jogos'].includes(sufixo), 'Consulta externa bloqueada no teste de acesso');
      const data = sufixo === '/equipes' ? htmlEquipes : sufixo === '/jogos' ? htmlJogos.replace('1 x 1', '2 x 1') : '';
      return { config, data, headers: {}, status: 200, statusText: 'OK' };
    };
    assert.equal((await req(`${rotaEvento}/sincronizar`, 'POST', {})).status, 200);
    assert.equal((await req(rotaEvento)).data.snapshot.jogos[0].golsMandante, 2);
    const catalogo = await prisma.fpfsCatalogo.findUniqueOrThrow({ where: { id: eventoId } });
    assert.ok(catalogo.sucessoEm);
    assert.equal(catalogo.erro, null);
    assert.equal(await prisma.fpfsAuditoria.count({ where: { eventoId, usuarioId: dev.usuario.id, acao: 'SINCRONIZACAO' } }), 1);
    fixture.eventoId = eventoId;
  }
  await fs.writeFile(path.join(pasta, 'acesso-dev.json'), JSON.stringify(fixture));
  console.log('PASS Dev consulta registros, corrige nome com auditoria, recebe logs sem dados pessoais e repete sincronização autorizada. Ações administrativas bloqueadas.');
}
