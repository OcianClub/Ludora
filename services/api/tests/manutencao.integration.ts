import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

async function main() {
  const pasta = path.resolve('../../.local-demo/equipe');
  const config = JSON.parse(await fs.readFile(path.join(pasta, 'config.json'), 'utf8'));
  const url = new URL(config.databaseUrl);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55448'); assert.equal(url.pathname, '/ludora_equipe');
  Object.assign(process.env, { DATABASE_URL: url.href, DIRECT_URL: url.href, JWT_SECRET: config.jwtSecret, NODE_ENV: 'test' });
  const { prisma } = await import('../src/lib/prisma.js');
  const base = '/admin/equipe/manutencao';
  const contas = JSON.parse(await fs.readFile(path.join(pasta, 'contas.json'), 'utf8'));
  const tokens: Record<string, string> = {};
  let usuarioId = 0;
  const req = async (papel: string, endpoint: string, method = 'GET', body?: unknown, clube?: number) => {
    const r = await fetch('http://127.0.0.1:3018' + endpoint, { method, headers: { Authorization: `Bearer ${tokens[papel] || ''}`, 'Content-Type': 'application/json', ...(clube ? { 'x-clube-id': String(clube) } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: await r.json().catch(() => null) as any };
  };
  try {
    for (const conta of contas) {
      const r = await req(conta.papel, '/auth/login', 'POST', conta); assert.equal(r.status, 200);
      tokens[conta.papel] = r.data.token;
      if (conta.papel === 'USUARIO') usuarioId = r.data.usuario.id;
    }
    const marcador = randomUUID().slice(0, 6);
    const criarClube = async (nome: string) => {
      const clube = await prisma.clube.create({ data: { nome: `${nome} ${marcador}`, usuarios: { create: { usuario_id: usuarioId, papel: 'ADMIN' } } } });
      const categoria = await prisma.categoria.create({ data: { nome: 'Sub-12', faixaIdade: 12, tipo: 'BASE', clube_id: clube.id } });
      const mandante = await prisma.time.create({ data: { nome: clube.nome, categoria_id: categoria.id, clube_representado_id: clube.id } });
      const visitante = await prisma.time.create({ data: { nome: 'Valley Academy', categoria_id: categoria.id } });
      return { id: clube.id, nome: clube.nome, partida: { categoria_id: categoria.id, mandante_id: mandante.id, visitante_id: visitante.id, data: '2027-04-23', horario: '16:30' } };
    };
    const clube = await criarClube('Harbor Maintenance');
    const outro = await criarClube('Westshore Maintenance');
    const criarChamado = async (assunto: string, clubeId: number) => {
      const chamado = await req('USUARIO', '/suporte', 'POST', {
        requestId: randomUUID(), tipo: 'OUTRO', assunto, descricao: 'Match creation needs a review before the next fixture.', impacto: 'OPERACAO_BLOQUEADA',
      }, clubeId);
      assert.equal(chamado.status, 201);
      return chamado.data.id as string;
    };
    const chamadoId = await criarChamado('Harbor match creation', clube.id);
    const endpoint = `/admin/equipe/chamados/${chamadoId}`;
    const detalhes = async () => (await req('SUPERADMIN', endpoint)).data;
    const decidir = async (papel: string, acao: string, revisao: number) => req(papel, endpoint, 'PATCH', {
      acao, revisao, motivo: 'Checked with the club and reproduced the error.', publico: acao === 'FINALIZAR',
    });
    const operacao = { operacao: 'CRIAR_PARTIDAS', escopo: 'CLUBE', alvoId: clube.id, motivo: 'Temporarily reviewing the match creation error.', revisarEm: new Date(Date.now() + 3600000).toISOString() };
    assert.equal((await req('SUPORTE', base, 'POST', { ...operacao, escopo: 'GLOBAL', alvoId: 0 })).status, 403);
    assert.equal((await req('DESENVOLVEDOR', base, 'POST', operacao)).status, 403);
    assert.equal((await req('SUPORTE', base, 'POST', { ...operacao, alvoId: outro.id, chamadoId })).status, 409);
    const pausa = await req('SUPORTE', base, 'POST', { ...operacao, chamadoId }); assert.equal(pausa.status, 201);
    assert.equal((await req('SUPORTE', `${base}?chamado=${chamadoId}`)).data.pausas.length, 1);
    assert.equal((await detalhes()).historico.at(-1).acao, 'MANUTENCAO_PAUSADA');
    const inicial = await detalhes();
    assert.equal(inicial.status, 'NOVO');
    assert.equal((await decidir('SUPERADMIN', 'ENCAMINHAR', inicial.revisao)).status, 200);
    const encaminhado = await detalhes();
    assert.equal(encaminhado.status, 'ENCAMINHADO_DEVS');
    assert.equal((await decidir('DESENVOLVEDOR', 'FINALIZAR', encaminhado.revisao)).status, 403);
    assert.equal((await decidir('SUPERADMIN', 'FINALIZAR', encaminhado.revisao)).status, 200);
    const finalizado = await detalhes();
    assert.equal(finalizado.status, 'RESOLVIDO');
    assert.equal(finalizado.manutencoes[0].ativa, true);
    assert.equal((await decidir('DESENVOLVEDOR', 'DEVOLVER', finalizado.revisao)).status, 409);
    assert.equal((await req('USUARIO', `/suporte/${chamadoId}`)).data.historico.at(-1).acao, 'FINALIZAR');
    assert.equal((await req('SUPORTE', base, 'POST', operacao)).status, 409);
    await prisma.manutencao.update({ where: { id: pausa.data.id }, data: { revisarEm: new Date(Date.now() - 60_000) } });
    const negada = await req('USUARIO', '/partidas', 'POST', clube.partida, clube.id);
    assert.equal(negada.status, 423); assert.equal(negada.data.manutencao.protocolo, pausa.data.id);
    assert.equal((await req('USUARIO', '/partidas', 'GET', undefined, clube.id)).status, 200);
    assert.equal((await req('USUARIO', '/partidas', 'POST', outro.partida, outro.id)).status, 201);
    assert.equal((await req('USUARIO', '/competicoes', 'POST', { nome: 'Harbor Cup', ano: 2027, tipo: 'BASE' }, clube.id)).status, 201);
    const reativar = await req('SUPORTE', `${base}/${pausa.data.id}/reativar`, 'POST', { motivo: 'Reviewed and approved for use.', revisao: pausa.data.revisao });
    assert.equal(reativar.status, 200);
    assert.equal((await detalhes()).historico.at(-1).acao, 'MANUTENCAO_REATIVADA');
    assert.equal((await detalhes()).status, 'RESOLVIDO');
    assert.equal((await req('SUPORTE', base, 'POST', { ...operacao, chamadoId })).status, 409);
    assert.equal((await req('USUARIO', '/partidas', 'POST', clube.partida, clube.id)).status, 201);
    assert.equal(await prisma.manutencaoHistorico.count({ where: { manutencaoId: pausa.data.id } }), 2);
    const eventoId = 999999;
    await prisma.fpfsCatalogo.upsert({ where: { id: eventoId }, create: { id: eventoId, ano: 2027, divisao: 'TEST', categoria: 'Sub-12', equipes: [] }, update: {} });
    await prisma.manutencao.updateMany({ where: { escopo: 'EVENTO', alvoId: eventoId }, data: { ativa: false } });
    const oficial = await req('SUPERADMIN', base, 'POST', { ...operacao, operacao: 'AGENDA_OFICIAL', escopo: 'EVENTO', alvoId: eventoId });
    assert.equal(oficial.status, 201);
    const sync = await req('SUPERADMIN', `/admin/paulista/eventos/${eventoId}/sincronizar`, 'POST', {});
    assert.equal(sync.status, 423); assert.equal(sync.data.manutencao.protocolo, oficial.data.id);
    const chamadoParaTela = await criarChamado('Harbor match creation UI', clube.id);
    await fs.writeFile(path.join(pasta, 'manutencao.json'), JSON.stringify({ clube, outro, chamadoId: chamadoParaTela }));
    console.log('PASS vínculo por clube, encaminhamento/finalização por ADM, bloqueio do dev, finalização independente da pausa, reativação auditada e controle Paulista.');
  } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
