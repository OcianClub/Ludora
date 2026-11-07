// Operação explícita sobre o banco configurado. Não executado por pnpm dev.
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../src/lib/prisma';
import { descobrirFonte } from '../src/modules/paulista/discovery';
import { baixarEvento, lerFonte } from '../src/modules/paulista/provider';
import { load } from 'cheerio';
import { importar, vincular } from '../src/modules/paulista/service';
import { guardarDescoberta } from '../src/modules/paulista/discovery';
import { randomBytes, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const folder = path.resolve('../../.local-demo/paulista-multiclube-20261106');
const report = path.resolve('../../docs/dados/paulista-multiclube-20261106.json');
const destinoFingerprint = () => {
  const u = new URL(process.env.DIRECT_URL!);
  const app = new URL(process.env.DATABASE_URL!);
  for (const key of ['hostname', 'username', 'pathname'] as const) assert.equal(app[key], u[key], 'DATABASE_URL e DIRECT_URL apontam para destinos diferentes.');
  assert.equal(app.searchParams.get('schema') || 'public', u.searchParams.get('schema') || 'public', 'Schemas de conexão diferentes.');
  return createHash('sha256').update(`${u.hostname}|${u.port}|${u.username}|${u.pathname}`).digest('hex');
};
const tables = ['Clube', 'Usuario', 'UsuarioClube', 'Categoria', 'Jogador', 'Time', 'Competicao', 'Partida', 'ParticipantePartida', 'Evento', 'EscalacaoPartida', 'FpfsEvento', 'FpfsEquipe', 'FpfsJogo', 'FpfsPendencia', 'FpfsAuditoria', 'FpfsCatalogo', 'FpfsVinculo', 'FpfsTime'] as const;
async function inventory() {
  const result: Record<string, string[]> = {};
  for (const t of tables) {
    // Identificadores SQL são da lista estática acima; não há entrada do usuário.
    const expr = t === 'FpfsVinculo' ? '"equipeId"::text' : t === 'FpfsTime' ? '"eventoId"::text || \':\' || "equipeId"::text' : 'id::text';
    result[t] = (await prisma.$queryRawUnsafe<{ key: string }[]>(`SELECT ${expr} AS key FROM "${t}" ORDER BY 1`)).map(r => r.key);
  }
  return result;
}
async function main() {
  await fs.mkdir(folder, { recursive: true });
  const mode = process.argv[2] || 'inspect';
  if (['resume', 'scenario', 'verify', 'finalize', 'cleanup-plan', 'access'].includes(mode)) {
    const m = JSON.parse(await fs.readFile(report, 'utf8'));
    if (m.banco.fingerprint) assert.equal(destinoFingerprint(), m.banco.fingerprint, 'Banco diferente do manifesto. Não prosseguir.');
    else assert.equal(mode, 'finalize', 'Manifesto antigo: conferir e finalizar antes de outra operação.');
  }
  if (mode === 'inspect') {
    const u = new URL(process.env.DIRECT_URL!);
    const clubes = await prisma.clube.findMany({ include: { categorias: true } });
    const migrations = await prisma.$queryRaw<any[]>`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at`;
    const data = { banco: { host: u.hostname, port: u.port, database: u.pathname.slice(1), schema: 'public' }, clubes,
      vinculos: await prisma.fpfsVinculo.findMany(), eventos: await prisma.fpfsEvento.findMany({ select: { id: true, categoria: true, divisao: true, competicaoId: true } }), migrations };
    await fs.writeFile(path.join(folder, 'inspect.json'), JSON.stringify(data, null, 2));
    console.log(JSON.stringify(data, null, 2));
  } else if (mode === 'source') {
    const catalogo = await descobrirFonte();
    await fs.writeFile(path.join(folder, 'catalogo.json'), JSON.stringify(catalogo, null, 2));
    console.log(JSON.stringify(catalogo.flatMap(c => c.equipes.filter(e => /OCIAN|SANTOS|UNIÃO MAUÁ/i.test(e.nome)).map(e => ({ evento: c.id, categoria: c.categoria, divisao: c.divisao, ...e }))), null, 2));
  } else if (mode === 'apply') {
    assert.equal(new URL(process.env.DIRECT_URL!).hostname, 'aws-1-sa-east-1.pooler.supabase.com');
    const backup = await fs.readFile(path.resolve('../../.local-demo/backups/2026-11-06-multiclube/ludora-public.dump'));
    assert.equal(createHash('sha256').update(backup).digest('hex'), 'ae57a5f9280bb256635b0f81ad5a256c6c1fd2ec09b9eb7db058bb5d4723105a');
    await fs.access(path.resolve('../../.local-demo/backups/2026-11-06-multiclube/conteudo.txt'));
    assert.equal(await fs.stat(path.join(folder, 'before.json')).then(() => true, () => false), false, 'Operação já iniciada; confira o journal antes de repetir.');
    const plan = JSON.parse(await fs.readFile(path.join(folder, 'plan.json'), 'utf8'));
    for (const key of ['ocian', 'santos', 'maua']) assert.equal(plan.filter((p: any) => p.key === key).length, 8);
    const ocian = await prisma.clube.findUniqueOrThrow({ where: { id: 2 } }); assert.equal(ocian.nome, 'Ocian');
    const santos = await prisma.clube.findUniqueOrThrow({ where: { id: 3 } }); assert.equal(santos.nome, 'Santos');
    const baseline = await inventory();
    await fs.writeFile(path.join(folder, 'before.json'), JSON.stringify(baseline, null, 2));
    const manifest: any = { operacao: 'paulista-multiclube-20261106', iniciadoEm: new Date().toISOString(), estado: 'EM_ANDAMENTO',
      banco: { host: new URL(process.env.DIRECT_URL!).hostname, database: 'postgres', schema: 'public', fingerprint: destinoFingerprint() }, backupSHA256: createHash('sha256').update(backup).digest('hex'),
      preservados: { ocian: 2, santosPreexistente: 3, aviso: 'Santos já existia; remover apenas dados criados por esta operação, nunca o clube 3.' }, identidades: plan, passos: [], contas: [], jogadores: [] };
    await fs.mkdir(path.dirname(report), { recursive: true });
    const save = async () => {
      const after = await inventory();
      manifest.criados = Object.fromEntries(tables.map(t => [t, after[t].filter(id => !baseline[t].includes(id))]));
      await fs.writeFile(report, JSON.stringify(manifest, null, 2));
    };
    await save();
    const lease = new Date(Date.now() + 60 * 60_000);
    const lock = await prisma.fpfsRotina.updateMany({ where: { id: 1, OR: [{ leaseAte: null }, { leaseAte: { lt: new Date() } }] }, data: { leaseAte: lease } });
    assert.equal(lock.count, 1, 'Rotina em andamento; operação não prosseguiu.');
    try {
      const maua = await prisma.clube.create({ data: { nome: 'A. União Mauá · TESTE', cidade: 'Mauá', estado: 'SP', plano: 'DEMO', escudo: plan.find((p: any) => p.key === 'maua').escudo } });
      manifest.clubesTeste = [3, maua.id]; await save();
      const bcrypt = (await import('bcrypt')).default;
      const credentials: any[] = [];
      for (const [key, clubeId] of [['santos', 3], ['maua', maua.id]] as const) {
        for (const p of plan.filter((p: any) => p.key === key)) {
          p.clubeId = clubeId;
          const sub = Number(p.categoria.match(/\d+/)[0]);
          const cat = await prisma.categoria.upsert({ where: { nome_clube_id: { nome: `sub-${sub}`, clube_id: clubeId } }, create: { nome: `sub-${sub}`, faixaIdade: sub, tipo: sub <= 10 ? 'INICIACAO' : 'BASE', clube_id: clubeId }, update: {} });
          p.categoriaId = cat.id;
          const usadas = new Set((await prisma.jogador.findMany({ where: { categoria_id: cat.id }, select: { numCamisa: true } })).map(p => p.numCamisa));
          for (const [i, posicao] of ['Goleiro', 'Fixo', 'Ala', 'Pivô'].entries()) {
            let camisa = 80 + i; while (usadas.has(camisa)) camisa--; usadas.add(camisa);
            const player = await prisma.jogador.create({ data: { nome: `TESTE ${['Alex', 'Morgan', 'Taylor', 'Jordan'][i]} Example · ${key} Sub-${sub}`, cpf: `TST-P26-${clubeId}-${sub}-${i}`, dtNasc: new Date(`${2026 - sub}-05-10`), posicao, numCamisa: camisa, categoria_id: cat.id } });
            manifest.jogadores.push({ id: player.id, clubeId, categoriaId: cat.id, nome: player.nome, identificadorTeste: player.cpf });
          }
          await save();
        }
        for (const papel of ['ADMIN', 'TECNICO', 'TORCEDOR'] as const) {
          const email = `teste.paulista.${key}.${papel.toLowerCase()}@ludora.test`, senha = randomBytes(15).toString('base64url');
          const user = await prisma.usuario.create({ data: { nome: `TESTE Paulista ${key} ${papel}`, email, senha: await bcrypt.hash(senha, 10) } });
          const membership = await prisma.usuarioClube.create({ data: { usuario_id: user.id, clube_id: clubeId, papel, acesso_todas_categorias: papel === 'ADMIN', ...(papel === 'TECNICO' ? { categorias: { create: { categoria_id: plan.find((p: any) => p.key === key && p.categoria === 'Sub-12').categoriaId } } } : {}) } });
          manifest.contas.push({ id: user.id, email, papel, clubeId, vinculoUsuarioClube: membership.id, categoriaAutorizada: papel === 'TECNICO' ? 'Sub-12' : null });
          credentials.push({ email, senha, clubeId, papel }); await fs.writeFile(path.join(folder, 'credenciais.json'), JSON.stringify(credentials, null, 2)); await save();
        }
      }
      const email = 'teste.paulista.plataforma@ludora.test', senha = randomBytes(15).toString('base64url');
      const admin = await prisma.usuario.create({ data: { nome: 'TESTE Operador Ludora Paulista', email, senha: await bcrypt.hash(senha, 10), papel_plataforma: 'SUPERADMIN' } });
      manifest.contas.push({ id: admin.id, email, papel: 'SUPERADMIN', clubeId: null }); credentials.push({ email, senha, papel: 'SUPERADMIN' });
      await fs.writeFile(path.join(folder, 'credenciais.json'), JSON.stringify(credentials, null, 2)); await save();
      await guardarDescoberta(prisma, JSON.parse(await fs.readFile(path.join(folder, 'catalogo.json'), 'utf8')));
      for (const eventoId of [...new Set<number>(plan.map((p: any) => p.eventoId))]) {
        const snapshot = JSON.parse(await fs.readFile(path.join(folder, `evento-${eventoId}.json`), 'utf8'));
        await importar(prisma, snapshot, admin.id);
        for (const p of plan.filter((p: any) => p.eventoId === eventoId)) {
          await vincular(prisma, eventoId, p.equipeId, p.clubeId, admin.id, `Conferência individual: lista oficial, SUB, endereço e página de equipe. ${p.key === 'ocian' ? 'Clube 2 confirmado pelo usuário.' : 'Cliente temporário de teste autorizado pelo usuário.'}`);
        }
        const primeira = await importar(prisma, snapshot, admin.id);
        const ids = await prisma.fpfsJogo.findMany({ where: { eventoId }, orderBy: { id: 'asc' }, select: { id: true, partidaId: true } });
        const repetida = await importar(prisma, snapshot, admin.id);
        assert.equal(repetida.criadas, 0);
        assert.deepEqual(await prisma.fpfsJogo.findMany({ where: { eventoId }, orderBy: { id: 'asc' }, select: { id: true, partidaId: true } }), ids);
        await prisma.fpfsCatalogo.update({ where: { id: eventoId }, data: { acompanhado: true, sucessoEm: new Date(), proximaEm: new Date(Date.now() + 86_400_000), erro: null } });
        manifest.passos.push({ eventoId, primeira, repetida }); await save();
        console.log('Confirmado/importado/repetido', eventoId, primeira, repetida);
      }
      manifest.estado = 'CONCLUIDO'; manifest.concluidoEm = new Date().toISOString();
    } catch (e) { manifest.estado = 'INTERROMPIDO'; manifest.erro = e instanceof Error ? e.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[conexão omitida]') : 'Falha'; throw e; }
    finally { await save(); await prisma.fpfsRotina.updateMany({ where: { id: 1, leaseAte: lease }, data: { leaseAte: null } }); }
  } else if (mode === 'resume') {
    const manifest = JSON.parse(await fs.readFile(report, 'utf8'));
    assert.equal(manifest.estado, 'INTERROMPIDO', 'Retomada exige journal interrompido.');
    const baseline = JSON.parse(await fs.readFile(path.join(folder, 'before.json'), 'utf8'));
    const admin = manifest.contas.find((c: any) => c.papel === 'SUPERADMIN'); assert.ok(admin);
    const lease = new Date(Date.now() + 60 * 60_000);
    const lock = await prisma.fpfsRotina.updateMany({ where: { id: 1, OR: [{ leaseAte: null }, { leaseAte: { lt: new Date() } }] }, data: { leaseAte: lease } }); assert.equal(lock.count, 1);
    const save = async () => {
      const after = await inventory();
      manifest.criados = Object.fromEntries(tables.map(t => [t, after[t].filter(id => !baseline[t].includes(id))]));
      await fs.writeFile(report, JSON.stringify(manifest, null, 2));
    };
    try {
      manifest.estado = 'EM_ANDAMENTO'; delete manifest.erro; await save();
      for (const eventoId of [...new Set<number>(manifest.identidades.map((p: any) => p.eventoId))]) {
        if (manifest.passos.some((p: any) => p.eventoId === eventoId)) continue;
        const snapshot = JSON.parse(await fs.readFile(path.join(folder, `evento-${eventoId}.json`), 'utf8'));
        await importar(prisma, snapshot, admin.id);
        for (const p of manifest.identidades.filter((p: any) => p.eventoId === eventoId)) await vincular(prisma, eventoId, p.equipeId, p.clubeId, admin.id, `Identidade individual conferida na lista, página de equipe e endereço. ${p.key === 'ocian' ? 'Ocian existente confirmado pelo usuário.' : 'Cliente temporário autorizado pelo usuário.'}`);
        const primeira = await importar(prisma, snapshot, admin.id);
        const ids = await prisma.fpfsJogo.findMany({ where: { eventoId }, orderBy: { id: 'asc' }, select: { id: true, partidaId: true } });
        const repetida = await importar(prisma, snapshot, admin.id); assert.equal(repetida.criadas, 0);
        assert.deepEqual(await prisma.fpfsJogo.findMany({ where: { eventoId }, orderBy: { id: 'asc' }, select: { id: true, partidaId: true } }), ids);
        await prisma.fpfsCatalogo.update({ where: { id: eventoId }, data: { acompanhado: true, sucessoEm: new Date(), proximaEm: new Date(Date.now() + 86_400_000), erro: null } });
        manifest.passos.push({ eventoId, primeira, repetida }); await save(); console.log('Confirmado/importado/repetido', eventoId, primeira, repetida);
      }
      manifest.estado = 'CONCLUIDO'; manifest.concluidoEm = new Date().toISOString();
    } catch (e) { manifest.estado = 'INTERROMPIDO'; manifest.erro = e instanceof Error ? e.message : 'Falha'; throw e; }
    finally { await save(); await prisma.fpfsRotina.updateMany({ where: { id: 1, leaseAte: lease }, data: { leaseAte: null } }); }
  } else if (mode === 'access') {
    const contas = JSON.parse(await fs.readFile(path.join(folder, 'credenciais.json'), 'utf8'));
    const linhas = ['# Acessos temporários do Paulista', '', 'Somente para testes acadêmicos. Senhas geradas para esta operação; não versionar este arquivo.', '', 'Web: http://localhost:5173/login. Desktop: pnpm dev:desktop; API http://localhost:3000.', '', '| Conta | Senha | Clube | Permissão |', '| --- | --- | --- | --- |'];
    for (const c of contas) {
      const r = await fetch('http://localhost:3000/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: c.email, senha: c.senha }) }); assert.equal(r.status, 200, `Login temporário ${c.email}`);
      linhas.push(`| ${c.email} | ${c.senha} | ${c.clubeId || 'Plataforma'} | ${c.papel}${c.papel === 'TECNICO' ? ' · somente Sub-12' : ''} |`);
    }
    await fs.writeFile(path.join(folder, 'acessos.md'), linhas.join('\n'));
    const manifest = JSON.parse(await fs.readFile(report, 'utf8')); manifest.validacao.loginsVerificados = contas.length; await fs.writeFile(report, JSON.stringify(manifest, null, 2));
    console.log('PASS: sete logins temporários validados; senhas apenas no arquivo local acessos.md.');
  } else if (mode === 'scenario') {
    const manifest = JSON.parse(await fs.readFile(report, 'utf8')); assert.equal(manifest.estado, 'CONCLUIDO');
    assert.ok(!manifest.cenario, 'Cenário já preparado; não repetir sem revisar o manifesto.');
    const p = manifest.identidades.find((p: any) => p.key === 'santos' && p.categoria === 'Sub-12');
    const oficial = await prisma.fpfsJogo.findFirstOrThrow({ where: { eventoId: p.eventoId, partidaId: { not: null }, partida: { categoria: { clube_id: 3 }, participantes: { none: { clube_id: 2 } } } } });
    const jogo = oficial.oficial as any; assert.notEqual(jogo.golsMandante, null); assert.notEqual(jogo.golsVisitante, null);
    assert.ok(manifest.criados.Partida.includes(String(oficial.partidaId)), 'Só alterar partida criada nesta operação.');
    const player = manifest.jogadores.find((j: any) => j.clubeId === 3 && j.categoriaId === p.categoriaId);
    const user = manifest.contas.find((c: any) => c.clubeId === 3 && c.papel === 'ADMIN');
    const { retroativo, registrarPlacarAtual } = await import('../src/modules/paulista/service.js');
    const evento = await retroativo(prisma, oficial.id, 3, user.id, { requestId: 'teste-multiclube-defesa-20261106', jogadorId: player.id, tipo: 'DEFESA', motivo: 'TESTE autorizado: atleta fictício, revisão de divergência sem alterar dados oficiais', periodo: 1, minuto: 5 });
    const antes = await prisma.partida.findUniqueOrThrow({ where: { id: oficial.partidaId! } });
    manifest.cenario = { origem: 'TESTE — anotação local deliberadamente divergente', partidaId: antes.id, jogoId: oficial.id, eventoId: oficial.eventoId, jogadorId: player.id, eventoLocalId: evento.id, placarAnterior: [antes.gols_mandante, antes.gols_visitante], oficial: [jogo.golsMandante, jogo.golsVisitante] };
    await fs.writeFile(report, JSON.stringify(manifest, null, 2));
    await prisma.partida.update({ where: { id: antes.id }, data: { gols_mandante: antes.gols_mandante + 1 } });
    const audit = await prisma.auditoriaPartida.create({ data: { partida_id: antes.id, usuario_id: user.id, clube_id: 3, acao: 'TESTE_DIVERGENCIA', dados: { motivo: 'TESTE temporário autorizado, somente partida nova do cliente de teste; Ocian não participa.', anterior: manifest.cenario.placarAnterior } } });
    const pendencia = await registrarPlacarAtual(prisma, oficial.eventoId, oficial.id);
    assert.deepEqual((await prisma.fpfsJogo.findUniqueOrThrow({ where: { id: oficial.id } })).oficial, oficial.oficial);
    assert.equal(await prisma.evento.count({ where: { id: evento.id } }), 1);
    manifest.cenario.pendenciaId = pendencia.id; manifest.cenario.auditoriaPartidaId = audit.id;
    const baseline = JSON.parse(await fs.readFile(path.join(folder, 'before.json'), 'utf8')), after = await inventory();
    manifest.criados = Object.fromEntries(tables.map(t => [t, after[t].filter(id => !baseline[t].includes(id))]));
    await fs.writeFile(report, JSON.stringify(manifest, null, 2)); console.log('Cenário de teste preparado', manifest.cenario);
  } else if (mode === 'verify') {
    const manifest = JSON.parse(await fs.readFile(report, 'utf8')); assert.equal(manifest.estado, 'CONCLUIDO');
    const jwt = (await import('jsonwebtoken')).default;
    const { JWT_SECRET, JWT_OPTIONS } = await import('../src/config/env.js');
    const own = await prisma.usuarioClube.findFirstOrThrow({ where: { clube_id: 2, papel: 'ADMIN' }, include: { usuario: true } });
    const results = [], sessions = [];
    for (const key of ['ocian', 'santos', 'maua']) {
      const conta = key === 'ocian' ? { id: own.usuario.id, clubeId: 2 } : manifest.contas.find((c: any) => c.email.includes(`.${key}.admin@`));
      const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: conta.id } });
      const clube = await prisma.clube.findUniqueOrThrow({ where: { id: conta.clubeId } });
      const token = jwt.sign({ id: usuario.id, versao_sessao: usuario.versao_sessao }, JWT_SECRET, JWT_OPTIONS);
      const headers = { Authorization: `Bearer ${token}`, 'x-clube-id': String(clube.id) };
      const get = async (route: string) => { const r = await fetch('http://localhost:3000' + route, { headers }); assert.equal(r.status, 200, route); return r.json() as Promise<any>; };
      const list = await get('/paulista/eventos'); assert.equal(list.length, 8, key);
      const competitions = await get('/competicoes');
      for (const p of manifest.identidades.filter((p: any) => p.key === key)) {
        const data = await get(`/paulista/eventos/${p.eventoId}`);
        assert.equal(data.snapshot.categoria, p.categoria); assert.equal(data.snapshot.divisao, p.divisao);
        assert.ok(data.vinculos.some((v: any) => v.clubeId === clube.id && v.equipeId === p.equipeId && v.nome === clube.nome && v.escudo === clube.escudo));
        assert.deepEqual(data.snapshot.classificacao.filter((r: any) => r.equipeId === p.equipeId), p.classificacao);
        const game = p.jogos.find((j: any) => data.jogosLocais.some((l: any) => l.id === j.id && l.partidaId)); assert.ok(game);
        const local = data.jogosLocais.find((j: any) => j.id === game.id);
        const detail = await get(`/partidas/${local.partidaId}/gestao`);
        const equipe = detail.equipes.find((e: any) => e.clube_id === clube.id); assert.ok(equipe);
        assert.equal(equipe.time_id === detail.partida.mandante_id, game.mandanteId === p.equipeId);
        assert.ok(competitions.some((c: any) => c.paulista_evento_id === p.eventoId));
        results.push({ clubeId: clube.id, key, sub: p.categoria, divisao: p.divisao, eventoId: p.eventoId, equipeId: p.equipeId, posicao: p.classificacao.find((r: any) => /CLASSIFICA/i.test(r.fase))?.posicao, jogoConferido: game.id, partidaId: local.partidaId, mandoConferido: true, classificacaoConferida: true, fases: [...new Set(p.jogos.map((j: any) => j.fase))] });
      }
      sessions.push({ key, token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }, clube: { ...clube, meuPapel: 'ADMIN' } });
    }
    const shared = await prisma.partida.findMany({ where: { participantes: { some: { clube_id: 2 } }, AND: { participantes: { some: { clube_id: manifest.clubesTeste[1] } } } }, select: { id: true, fpfsJogo: { select: { id: true, eventoId: true } }, participantes: { select: { clube_id: true, time_id: true, categoria_id: true } } } }); assert.ok(shared.length);
    for (const p of shared) { assert.equal(p.participantes.length, 2); assert.notEqual(p.participantes[0].time_id, p.participantes[1].time_id); assert.ok(p.fpfsJogo); }
    manifest.validacao = { consultadoEm: new Date().toISOString(), categorias: results, partidasCompartilhadas: shared };
    manifest.times = await prisma.fpfsTime.findMany({ where: { equipeId: { in: manifest.identidades.map((p: any) => p.equipeId) } }, include: { time: { select: { id: true, nome: true, categoria_id: true, clube_representado_id: true } } } });
    await fs.writeFile(report, JSON.stringify(manifest, null, 2)); await fs.writeFile(path.join(folder, 'sessoes-web.json'), JSON.stringify(sessions));
    console.log('PASS: categorias verificadas individualmente:', results.length, '; partidas compartilhadas:', shared.length);
  } else if (mode === 'finalize') {
    const manifest = JSON.parse(await fs.readFile(report, 'utf8')); assert.equal(manifest.estado, 'CONCLUIDO');
    const jwt = (await import('jsonwebtoken')).default; const { JWT_SECRET, JWT_OPTIONS } = await import('../src/config/env.js');
    const permissions = [];
    for (const clubeId of manifest.clubesTeste) {
      const samples = await prisma.participantePartida.findMany({ where: { clube_id: clubeId, categoria: { faixaIdade: { in: [7, 12] } }, partida: { status: 'FINALIZADA', fpfsJogo: { isNot: null } } }, include: { categoria: true } });
      for (const conta of manifest.contas.filter((c: any) => c.clubeId === clubeId)) {
        const user = await prisma.usuario.findUniqueOrThrow({ where: { id: conta.id } });
        const headers = { Authorization: `Bearer ${jwt.sign({ id: user.id, versao_sessao: user.versao_sessao }, JWT_SECRET, JWT_OPTIONS)}`, 'x-clube-id': String(clubeId), 'Content-Type': 'application/json' };
        for (const sub of [7, 12]) {
          const sample = samples.find(s => s.categoria.faixaIdade === sub); assert.ok(sample);
          const r = await fetch(`http://localhost:3000/partidas/${sample.partida_id}/gestao`, { headers }); assert.equal(r.status, 200);
          const data = await r.json() as any, permitido = conta.papel === 'ADMIN' || conta.papel === 'TECNICO' && sub === 12;
          assert.equal(data.podePreparar, permitido, `Preparação: clube ${clubeId}, cargo ${conta.papel}, Sub-${sub}`); assert.equal(data.podeAnotarOficial, permitido, `Anotação oficial: clube ${clubeId}, cargo ${conta.papel}, Sub-${sub}`);
          if (!permitido) {
            const denied = await fetch(`http://localhost:3000/partidas/${sample.partida_id}/eventos`, { method: 'POST', headers, body: JSON.stringify({ time_id: sample.time_id, tipo: 'DEFESA', jogador_id: -1, motivo: 'TESTE deve negar antes de gravar', request_id: 'teste-permissao-sem-escrita' }) });
            assert.equal(denied.status, 403);
          }
          permissions.push({ usuarioId: user.id, clubeId, papel: conta.papel, sub, edicaoPermitida: permitido });
        }
        assert.equal((await fetch('http://localhost:3000/admin/paulista', { headers })).status, 403);
      }
    }
    const [ocian] = await prisma.$queryRaw<{ total: bigint; hash: string }[]>`SELECT count(*) AS total, md5(string_agg(to_jsonb(j)::text, chr(10) ORDER BY j.id)) AS hash FROM "Jogador" j JOIN "Categoria" c ON c.id=j.categoria_id WHERE c.clube_id=2`;
    assert.equal(Number(ocian.total), 226); assert.equal(ocian.hash, '7546f2091a91f240af279c8821eda503', 'Elenco real do Ocian deve coincidir com backup anterior.');
    const baseline = JSON.parse(await fs.readFile(path.join(folder, 'before.json'), 'utf8')), after = await inventory();
    for (const t of tables) assert.ok(baseline[t].every((id: string) => after[t].includes(id)), `IDs preexistentes preservados em ${t}`);
    manifest.criados = Object.fromEntries(tables.map(t => [t, after[t].filter(id => !baseline[t].includes(id))]));
    manifest.validacao.permissoes = permissions;
    manifest.validacao.elencoOcian = { total: Number(ocian.total), hashIgualBackup: true, hash: ocian.hash };
    manifest.validacao.backupRestaurado = 'PostgreSQL local existente, banco ludora_multiclube_before; restauração concluída sem erro.';
    manifest.banco.fingerprint = destinoFingerprint();
    manifest.validacao.decisaoTeste = await prisma.fpfsPendencia.findUniqueOrThrow({ where: { id: manifest.cenario.pendenciaId } });
    assert.equal(await prisma.evento.count({ where: { id: manifest.cenario.eventoLocalId } }), 1);
    const official = await prisma.fpfsJogo.findUniqueOrThrow({ where: { id: manifest.cenario.jogoId } });
    assert.deepEqual([(official.oficial as any).golsMandante, (official.oficial as any).golsVisitante], manifest.cenario.oficial);
    manifest.auditoriasTeste = await prisma.fpfsAuditoria.findMany({ where: { usuarioId: { in: manifest.contas.map((c: any) => c.id) } }, select: { id: true, eventoId: true, acao: true } });
    manifest.auditoriasPartida = await prisma.auditoriaPartida.findMany({ where: { usuario_id: { in: manifest.contas.map((c: any) => c.id) } }, select: { id: true, partida_id: true, acao: true } });
    manifest.permissoesCategorias = await prisma.usuarioClubeCategoria.findMany({ where: { usuario_clube_id: { in: manifest.contas.flatMap((c: any) => c.vinculoUsuarioClube ? [c.vinculoUsuarioClube] : []) } } });
    await fs.writeFile(report, JSON.stringify(manifest, null, 2));
    console.log('PASS: 12 verificações de cargo/categoria; 226 atletas reais idênticos ao backup; IDs preexistentes, evento fictício e placar oficial preservados.');
  } else if (mode === 'cleanup-plan') {
    const manifest = JSON.parse(await fs.readFile(report, 'utf8'));
    const clubes = manifest.clubesTeste || [];
    const partidas = await prisma.partida.findMany({ where: { OR: [{ categoria: { clube_id: { in: clubes } } }, { participantes: { some: { clube_id: { in: clubes } } } }] }, select: { id: true, categoria: { select: { clube_id: true } }, participantes: { select: { id: true, clube_id: true } }, _count: { select: { eventos: true, jogadores_escalonados: true } } } });
    const jogadores = await prisma.jogador.findMany({ where: { id: { in: (manifest.criados.Jogador || []).map(Number) } }, select: { id: true, nome: true, cpf: true, _count: { select: { eventos: true, escalacoes: true, competicoes: true } } } });
    const contas = await prisma.usuario.findMany({ where: { id: { in: (manifest.criados.Usuario || []).map(Number) } }, select: { id: true, email: true, clubes: { select: { clube_id: true } } } });
    const vinculos = await prisma.fpfsVinculo.findMany({ where: { clubeId: { in: clubes } } });
    const foreignKeys = await prisma.$queryRaw<any[]>`SELECT child.relname AS tabela, ca.attname AS coluna, parent.relname AS referencia, pa.attname AS destino FROM pg_constraint c JOIN pg_class child ON child.oid = c.conrelid JOIN pg_namespace ns ON ns.oid = child.relnamespace JOIN pg_class parent ON parent.oid = c.confrelid JOIN pg_attribute ca ON ca.attrelid = c.conrelid AND ca.attnum = c.conkey[1] JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = c.confkey[1] WHERE c.contype = 'f' AND ns.nspname = 'public' AND array_length(c.conkey, 1) = 1`;
    const dependencias = [];
    for (const fk of foreignKeys) {
      const ids = manifest.criados[fk.referencia];
      if (!ids?.length || fk.destino !== 'id') continue;
      for (const value of [fk.tabela, fk.coluna]) assert.match(value, /^[A-Za-z_][A-Za-z_0-9]*$/);
      const [r] = await prisma.$queryRawUnsafe<any[]>(`SELECT count(*)::int AS total FROM "${fk.tabela}" WHERE "${fk.coluna}"::text = ANY($1::text[])`, ids);
      if (r.total) dependencias.push({ ...fk, registros: r.total });
    }
    const output = { somenteLeitura: true, geradoEm: new Date().toISOString(), nenhumRegistroRemovido: true,
      preservarSempre: { clubesPreexistentes: [2, 3, 4], partidasComOcian: partidas.filter(p => p.participantes.some(e => e.clube_id === 2)).map(p => p.id), dadosOficiais: 'Manter snapshots, equipes e jogos oficiais. Criado nesta operação não significa dado fictício.' },
      contas, jogadores, vinculos, dependencias, partidas,
      bloqueios: { identidadeJogadorAlterada: jogadores.filter(j => !j.cpf.startsWith('TST-P26-') || !j.nome.startsWith('TESTE')).map(j => j.id), contasComOutroClube: contas.filter(u => !u.email.startsWith('teste.paulista.') || u.clubes.some(c => !clubes.includes(c.clube_id))).map(u => u.id),
        partidasAncoradasEmClienteTeste: partidas.filter(p => clubes.includes(p.categoria.clube_id)).map(p => p.id), jogadoresComHistorico: jogadores.filter(j => Object.values(j._count).some(Boolean)).map(j => j.id) },
      procedimento: ['Fazer novo backup e parar a rotina durante a revisão.', 'Reexecutar este relatório; comparar IDs e dependências com o manifesto.', 'Revogar somente contas temporárias após conferir vínculos; nunca apagar Santos preexistente nem Ocian.', 'Não apagar atletas com eventos, escalações ou inscrições sem revisão explícita desses registros.', 'Desvincular equipes usando a API auditada; se houver âncora ou contribuição própria, interromper e planejar transferência/arquivo. Nunca forçar DELETE em cascata.', 'Preservar partidas compartilhadas e times com histórico. A remoção física completa pode ser bloqueada; preferir arquivar o cliente de teste e desabilitar suas contas até concluir a revisão.'] };
    await fs.writeFile(path.join(folder, 'cleanup-plan.json'), JSON.stringify(output, null, 2));
    console.log('Plano somente leitura:', { partidas: partidas.length, compartilhadasOcian: output.preservarSempre.partidasComOcian.length, bloqueios: Object.fromEntries(Object.entries(output.bloqueios).map(([k, v]) => [k, v.length])) });
  } else if (mode === 'diagnose') {
    const html = await lerFonte('/evento/924'), $ = load(html);
    $('[role="tabpanel"][id^="pills-fase-"]').each((_i, p) => {
      const id = $(p).attr('id'); if (!/^pills-fase-\d+$/.test(id || '')) return;
      $(p).find('tbody tr').each((_j, row) => {
        const c = $(row).children('td').map((_k, el) => $(el).text().replace(/\s+/g, ' ').trim()).get();
        if (c.slice(3, 11).some(v => !Number.isFinite(Number(v)))) console.log(id, JSON.stringify(c));
      });
    });
  } else if (mode === 'plan') {
    const catalogo = JSON.parse(await fs.readFile(path.join(folder, 'catalogo.json'), 'utf8')) as Awaited<ReturnType<typeof descobrirFonte>>;
    const identities = [
      { key: 'ocian', nome: 'OCIAN PRAIA CLUBE', clubeId: 2 },
      { key: 'santos', nome: 'SANTOS FC', clubeId: 3 },
      { key: 'maua', nome: 'A. UNIÃO MAUÁ', clubeId: null },
    ];
    const plan: any[] = [];
    for (const c of catalogo.filter(c => c.equipes.some(e => identities.some(i => i.nome === e.nome)))) {
      const snapshot = await baixarEvento(c.id);
      await fs.writeFile(path.join(folder, `evento-${c.id}.json`), JSON.stringify(snapshot, null, 2));
      for (const i of identities) {
        const equipes = c.equipes.filter(e => e.nome === i.nome);
        if (equipes.length > 1) throw new Error('Identidade ambígua no catálogo.');
        if (!equipes.length) continue;
        const e = equipes[0], href = `/evento/${c.id}/equipe/${e.id}`;
        const $ = load(await lerFonte(href));
        const heading = $('h5').first().text().replace(/\s+/g, ' ').trim();
        const endereco = $('h4').filter((_i, el) => $(el).text().includes('Endereço')).text().replace(/\s+/g, ' ').trim();
        if (!heading.includes(c.categoria) || !endereco) throw new Error(`Página individual sem evidência de categoria/endereço: ${href}`);
        plan.push({ ...i, ano: c.ano, categoria: c.categoria, divisao: c.divisao, eventoId: c.id, equipeId: e.id,
          evidencias: [`https://eventos.admfutsal.com.br/evento/${c.id}/equipes`, `https://eventos.admfutsal.com.br${href}`],
          classificacao: snapshot.classificacao.filter(r => r.equipeId === e.id),
          jogos: snapshot.jogos.filter(j => j.mandanteId === e.id || j.visitanteId === e.id),
          escudo: e.escudo, heading, endereco, conferidoEm: new Date().toISOString() });
      }
    }
    await fs.writeFile(path.join(folder, 'plan.json'), JSON.stringify(plan, null, 2));
    console.table(plan.map(p => ({ clube: p.key, sub: p.categoria, divisao: p.divisao, evento: p.eventoId, equipe: p.equipeId, jogos: p.jogos.length, posicao: p.classificacao.find((r: any) => /CLASSIFICA/i.test(r.fase))?.posicao })));
  } else throw new Error('Use inspect, source, plan, apply, resume, scenario, verify, finalize, access ou cleanup-plan. Modos de escrita são explícitos; leia o handover antes de executar.');
}
main().catch(e => { console.error(e instanceof Error ? e.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[conexão omitida]') : 'Falha operacional'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
