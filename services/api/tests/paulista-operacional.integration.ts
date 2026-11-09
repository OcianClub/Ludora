import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomInt } from 'node:crypto';
import type { SnapshotPaulista } from '../../../packages/shared-types/src/paulista';

async function main() {
  const pasta = path.resolve('../../.local-demo/equipe');
  const config = JSON.parse(await fs.readFile(path.join(pasta, 'config.json'), 'utf8'));
  const url = new URL(config.databaseUrl);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55448'); assert.equal(url.pathname, '/ludora_equipe');
  Object.assign(process.env, { DATABASE_URL: url.href, DIRECT_URL: url.href, JWT_SECRET: config.jwtSecret, NODE_ENV: 'test' });
  const { prisma } = await import('../src/lib/prisma.js');
  const { importar, painel, vincular } = await import('../src/modules/paulista/service.js');
  const { rankingCalculado } = await import('../src/modules/paulista/rules.js');
  const { OperacaoPausada } = await import('../src/modules/manutencao/service.js');
  try {
    const staff = await prisma.usuario.findUniqueOrThrow({ where: { email: 'superadmin@equipe.example.test' } });
    const cliente = await prisma.usuario.findUniqueOrThrow({ where: { email: 'usuario@equipe.example.test' } });
    const id = randomInt(90000000, 92000000);
    const nome = `Ocian Sandbox ${id}`;
    const escudo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/YnkAAAAASUVORK5CYII=';
    const clube = await prisma.clube.create({ data: { nome, escudo, usuarios: { create: { usuario_id: cliente.id, papel: 'ADMIN' } }, categorias: { create: { nome: 'sub-12', tipo: 'BASE', faixaIdade: 12 } } } });
    const snapshot: SnapshotPaulista = {
      id, ano: 2027, titulo: 'Paulista', divisao: 'A3 TESTE', categoria: 'Sub-12', fonte: 'https://example.test/paulista',
      equipes: [{ id: id + 1, nome, escudo: null }, { id: id + 2, nome: 'East Bay Academy', escudo: null }, { id: id + 3, nome: 'River City', escudo: null }],
      jogos: [{ id: `${id}:fase:${id + 1}:${id + 2}`, faseId: '1', fase: 'Classificação', sumulaId: null, mandanteId: id + 1, visitanteId: id + 2, data: '2027-05-15', horario: '10:30', local: 'Harbor Arena', golsMandante: null, golsVisitante: null, ocorrencia: null }],
      classificacao: [], avisos: [], fasesExcluidas: [],
    };
    snapshot.jogos.push(
      { ...snapshot.jogos[0], id: `${id}:externo`, mandanteId: id + 2, visitanteId: id + 3 },
      { ...snapshot.jogos[0], id: `${id}:adiado`, data: '2027-05-20' },
      { ...snapshot.jogos[0], id: `${id}:wo`, data: '2027-05-22' },
    );
    await importar(prisma, snapshot, staff.id);
    await vincular(prisma, id, id + 1, clube.id, staff.id, 'Identidade conferida no teste isolado.');
    await importar(prisma, snapshot, staff.id);
    const jogo = await prisma.fpfsJogo.findUniqueOrThrow({ where: { id: snapshot.jogos[0].id } });
    assert.ok(jogo.partidaId);
    const onde = { id: jogo.partidaId };
    assert.equal((await prisma.partida.findUniqueOrThrow({ where: onde })).status, 'AGENDADA');
    Object.assign(snapshot.jogos[0], { sumulaId: id, golsMandante: 5, golsVisitante: 2, horario: '11:00' });
    Object.assign(snapshot.jogos[1], { sumulaId: id + 1, golsMandante: 2, golsVisitante: 0 });
    Object.assign(snapshot.jogos[2], { ocorrencia: 'ADIADA' });
    Object.assign(snapshot.jogos[3], { ocorrencia: 'WO', golsMandante: 3, golsVisitante: 0 });
    await importar(prisma, snapshot, staff.id);
    const projetada = await prisma.partida.findUniqueOrThrow({ where: onde });
    assert.deepEqual([projetada.status, projetada.gols_mandante, projetada.gols_visitante, projetada.horario], ['FINALIZADA', 5, 2, '11:00']);
    assert.equal((await prisma.fpfsJogo.findUniqueOrThrow({ where: { id: jogo.id } })).partidaId, jogo.partidaId);
    assert.equal((await prisma.fpfsJogo.findUniqueOrThrow({ where: { id: snapshot.jogos[1].id } })).partidaId, null);
    assert.equal((await painel(prisma, id)).pendencias.length, 0);
    for (const oficial of snapshot.jogos.slice(2)) {
      const referencia = await prisma.fpfsJogo.findUniqueOrThrow({ where: { id: oficial.id } });
      assert.ok(referencia.partidaId);
      assert.equal((await prisma.partida.findUniqueOrThrow({ where: { id: referencia.partidaId } })).status, 'AGENDADA');
    }
    snapshot.jogos[0].golsMandante = 4;
    await importar(prisma, snapshot, staff.id);
    assert.equal((await prisma.partida.findUniqueOrThrow({ where: onde })).gols_mandante, 4);
    assert.equal((await painel(prisma, id)).pendencias.length, 0);
    const gol = await prisma.evento.create({ data: { partida_id: jogo.partidaId, time_id: projetada.mandante_id, tipo: 'GOL', periodo: 1 } });
    await prisma.partida.update({ where: onde, data: { gols_mandante: 6, versao: { increment: 1 } } });
    snapshot.jogos[0].golsMandante = 5;
    await importar(prisma, snapshot, staff.id);
    await importar(prisma, snapshot, staff.id);
    const pendencia = await prisma.fpfsPendencia.findUniqueOrThrow({ where: { jogoId_tipo: { jogoId: jogo.id, tipo: 'PLACAR' } } });
    assert.deepEqual(pendencia.dados, { local: [6, 2], oficial: [5, 2], partidaId: jogo.partidaId });
    assert.equal((await prisma.partida.findUniqueOrThrow({ where: onde })).gols_mandante, 6);
    assert.ok(await prisma.evento.findUnique({ where: { id: gol.id } }));
    assert.equal((await painel(prisma, id)).pendencias.length, 1);
    assert.equal((await painel(prisma, id)).vinculos.find(v => v.clubeId === clube.id)?.escudo, escudo);
    assert.equal(snapshot.equipes[0].escudo, null);
    assert.equal(rankingCalculado(snapshot)[0].times.find(t => t.equipeId === id + 1)?.golsPro, 5);
    Object.assign(snapshot.jogos[0], { data: '2027-05-16', horario: '11:45', local: 'River Arena' });
    const trocada = { ...snapshot, jogos: snapshot.jogos.map((j, i) => i === 2 ? { ...j, visitanteId: id + 3 } : j) };
    await importar(prisma, trocada, staff.id);
    assert.ok(await prisma.fpfsPendencia.findUnique({ where: { jogoId_tipo: { jogoId: snapshot.jogos[2].id, tipo: 'IDENTIDADE' } } }));
    const alteracao = await prisma.fpfsPendencia.findUniqueOrThrow({ where: { jogoId_tipo: { jogoId: jogo.id, tipo: 'ALTERACAO_OFICIAL' } } });
    assert.deepEqual((alteracao.dados as { changes: { campo: string }[] }).changes.map(c => c.campo), ['data', 'horario', 'local']);
    assert.equal((await prisma.partida.findUniqueOrThrow({ where: onde })).horario, '11:00');
    await prisma.fpfsCatalogo.create({ data: { id, ano: snapshot.ano, divisao: snapshot.divisao, categoria: snapshot.categoria, equipes: snapshot.equipes.map(e => ({ ...e })), acompanhado: true, sucessoEm: new Date(), proximaEm: new Date(Date.now() + 86400000) } });
    const santos = await prisma.clube.create({ data: { nome: `Santos Sandbox ${id}`, categorias: { create: { nome: 'sub-12', tipo: 'BASE', faixaIdade: 12 } } } });
    const outra: SnapshotPaulista = { ...snapshot, id: id + 10,
      equipes: [{ id: id + 11, nome: santos.nome, escudo: null }, { id: id + 12, nome: 'West Bay Academy', escudo: null }],
      jogos: snapshot.jogos.slice(0, 1).map(j => ({ ...j, id: `${id + 10}:fase:${id + 11}:${id + 12}`, sumulaId: null, mandanteId: id + 11, visitanteId: id + 12 })),
    };
    await importar(prisma, outra, staff.id);
    await vincular(prisma, outra.id, id + 11, santos.id, staff.id, 'Identidade conferida no teste isolado.');
    await importar(prisma, outra, staff.id);
    await prisma.fpfsCatalogo.create({ data: { id: outra.id, ano: outra.ano, divisao: outra.divisao, categoria: outra.categoria, equipes: outra.equipes.map(e => ({ ...e })) } });
    const versao = (await painel(prisma, id)).evento.versao;
    const pausa = await prisma.manutencao.create({ data: { operacao: 'AGENDA_OFICIAL', escopo: 'EVENTO', alvoId: id, motivo: 'Calendar verification in the isolated test.', operadorId: staff.id, revisarEm: new Date(Date.now() + 3600000) } });
    try {
      await assert.rejects(importar(prisma, trocada, staff.id), OperacaoPausada);
      assert.equal((await painel(prisma, id)).evento.versao, versao);
      outra.jogos[0].local = 'Riverside Sports Center';
      await importar(prisma, outra, staff.id);
      assert.equal((await painel(prisma, outra.id)).snapshot.jogos[0].local, 'Riverside Sports Center');
    } finally {
      await prisma.manutencao.delete({ where: { id: pausa.id } });
    }
    await fs.writeFile(path.join(pasta, 'paulista-operacional.json'), JSON.stringify({ eventoId: id, clubeId: clube.id, clubeNome: clube.nome, pendenciaId: pendencia.id, alteracaoId: alteracao.id, jogoId: jogo.id, partidaId: jogo.partidaId, clubeSemAlertas: santos.nome }));
    console.log('Fixture Paulista criada no banco isolado, sem consultar a Federação.');
  } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
