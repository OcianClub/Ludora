import { chaveChamadoPaulista, chaveChamadoVinculo, encaminharPendencia, solicitarAnaliseVinculo } from './chamados';
import { buscarPausa, exigirOperacao, OperacaoPausada, pausaPublica, responderPausa } from '../manutencao/service';
import { Router, type RequestHandler } from 'express';
import type { Server } from 'socket.io';
import { prisma } from '../../lib/prisma';
import { exigirAutenticacao } from '../../middlewares/auth.middleware';
import { exigirGestorDoClube, exigirClubePublico } from '../../middlewares/permissoes.middleware';
import { exigirSuperAdmin } from '../admin/superadmin';
import { limitarRequisicoes } from '../../middlewares/rate-limit.middleware';
import { baixarEvento, conferirCategorias, inteiroFonte } from './provider';
import { ativo, desfazerVinculo, FalhaPaulista, importar, json, painel, registrarPlacarAtual, retroativo, vincular } from './service';
import { rankingCalculado, sugestoes } from './rules';
import type { SnapshotPaulista } from '../../../../../packages/shared-types/src/paulista';
import { candidatosCascas, confirmarCandidato, executarCiclo, resumoAdministrativo, revisarPendencia } from './operations';
const limite = limitarRequisicoes({ janelaMs: 60_000, limite: 5, prefixo: 'paulista-fonte', porEmail: false });
const habilitado: RequestHandler = (_req, res, next) => ativo() ? next() : res.status(503).json({ error: 'Piloto Paulista desativado nesta API. A aba Competições do clube continua disponível.' });
const rota = (h: RequestHandler): RequestHandler => async (req, res, next) => {
  try { await h(req, res, next); }
  catch (e: any) {
    if (responderPausa(e, res)) return;
    const status = e instanceof FalhaPaulista ? e.status : ['P2002', 'P2034'].includes(e?.code) ? 409 : e?.code === 'P2021' ? 503 : e?.code === 'P2025' ? 404 : 502;
    res.status(status).json({ error: e instanceof FalhaPaulista ? e.message : status === 503 ? 'As tabelas do piloto ainda não foram migradas. Competições locais continuam disponíveis.' : status === 409 ? 'Conflito: atualize e revise a operação.' : status === 404 ? 'Registro não encontrado.' : 'Fonte indisponível, formato alterado ou sincronização não validada. Versão anterior preservada.' });
  }
};
function id(v: unknown) { try { return inteiroFonte(v); } catch { throw new FalhaPaulista(400, 'Identificador inválido.'); } }
function motivo(v: unknown) { if (typeof v !== 'string' || v.trim().length < 5 || v.length > 300) throw new FalhaPaulista(400, 'Informe motivo entre 5 e 300 caracteres.'); return v.trim(); }
const equipeOperacional = ['ADMIN', 'TECNICO', 'MESARIO'] as const;
const ocupados = new Set<number>();
export async function sincronizar(idEvento: number, usuarioId: number | null, io: Server) {
  await exigirOperacao(['SINCRONIZAR_PAULISTA', 'AGENDA_OFICIAL'], { eventoId: idEvento });
  if (ocupados.has(idEvento)) throw new FalhaPaulista(409, 'Sincronização já em andamento.');
  ocupados.add(idEvento);
  try {
    const s = await baixarEvento(idEvento);
    await exigirOperacao(['SINCRONIZAR_PAULISTA', 'AGENDA_OFICIAL'], { eventoId: idEvento });
    const anterior = await prisma.fpfsEvento.findUnique({ where: { id: idEvento } });
    if (anterior) {
      const old = anterior.payload as unknown as SnapshotPaulista;
      const atuais = new Set(s.jogos.map(j => j.id));
      const ausentes = old.jogos.filter(j => !atuais.has(j.id));
      const equipes = new Set((await prisma.fpfsVinculo.findMany({
        where: { equipeId: { in: ausentes.flatMap(j => [j.mandanteId, j.visitanteId]) } }, select: { equipeId: true },
      })).map(v => v.equipeId));
      const projetados = new Set((await prisma.fpfsJogo.findMany({
        where: { id: { in: ausentes.map(j => j.id) }, partidaId: { not: null } }, select: { id: true },
      })).map(j => j.id));
      for (const j of ausentes.filter(j => projetados.has(j.id) || equipes.has(j.mandanteId) || equipes.has(j.visitanteId))) {
        const novo = s.jogos.find(n => j.sumulaId && n.sumulaId === j.sumulaId);
        const dados = json({ antes: j, depois: novo || null, procedimento: 'Conferir mando/equipes na fonte e participações históricas. Sem transferência automática.' });
        await prisma.fpfsPendencia.upsert({ where: { jogoId_tipo: { jogoId: j.id, tipo: 'IDENTIDADE' } }, create: { jogoId: j.id, tipo: 'IDENTIDADE', dados }, update: {} });
      }
    }
    const r = await importar(prisma, s, usuarioId);
    const links = await prisma.fpfsVinculo.findMany({ where: { equipeId: { in: s.equipes.map(e => e.id) } } });
    for (const l of links) io.to(`clube:${l.clubeId}`).emit('paulista_atualizado', { eventoId: idEvento });
    return r;
  } catch (e) {
    if (e instanceof OperacaoPausada) throw e;
    const existente = await prisma.fpfsEvento.findUnique({ where: { id: idEvento }, select: { id: true } }).catch(() => null);
    if (existente) await prisma.fpfsAuditoria.create({ data: { eventoId: idEvento, usuarioId, acao: 'FALHA_SINCRONIZACAO', dados: json({ origem: 'FPFS', motivo: e instanceof FalhaPaulista ? e.message : 'FALHA_REDE_FORMATO_OU_TRANSACAO', fonte: `https://eventos.admfutsal.com.br/evento/${idEvento}` }) } }).catch(() => undefined);
    throw e;
  } finally { ocupados.delete(idEvento); }
}
export function criarPaulistaRoutes(io: Server) {
  const r = Router();
  r.get('/paulista/status', exigirAutenticacao, async (_req, res) => {
    if (!ativo()) return res.json({ ativo: false, bancoPronto: false });
    try { await prisma.fpfsEvento.count(); res.json({ ativo: true, bancoPronto: true }); }
    catch { res.json({ ativo: true, bancoPronto: false }); }
  });
  r.get('/paulista/partidas/:id', exigirAutenticacao, rota(async (req, res) => {
    if (!ativo()) return res.json(null);
    const j = await prisma.fpfsJogo.findUnique({ where: { partidaId: id(req.params.id) } });
    if (!j) return res.json(null);
    const p = await painel(prisma, j.eventoId);
    const participante = await prisma.participantePartida.findFirst({ where: { partida_id: j.partidaId!, clube: {
      usuarios: { some: { usuario_id: (req as any).usuarioId, papel: { in: [...equipeOperacional] } } },
    } }, select: { clube_id: true } });
    res.json({ eventoId: j.eventoId, jogo: j.oficial, pendencias: participante ? p.pendencias.filter(v => v.jogoId === j.id) : [], retroativos: p.retroativos.filter(v => v.dados.jogoId === j.id) });
  }));
  r.get('/paulista/eventos', exigirClubePublico, habilitado, rota(async (req, res) => {
    const links = await prisma.fpfsVinculo.findMany({ where: { clubeId: (req as any).clubeId }, select: { equipeId: true } });
    res.json(await prisma.fpfsEvento.findMany({ where: { times: { some: { equipeId: { in: links.map(l => l.equipeId) } } } }, orderBy: [{ ano: 'desc' }, { id: 'asc' }], select: { id: true, ano: true, titulo: true, divisao: true, categoria: true } }));
  }));
  r.get('/paulista/eventos/:id', exigirClubePublico, habilitado, rota(async (req, res) => {
    const p = await painel(prisma, id(req.params.id));
    const { clubeId, usuarioId } = req as any;
    const equipe = p.vinculos.find(v => v.clubeId === clubeId);
    if (!equipe) throw new FalhaPaulista(404, 'Seu clube não tem participação confirmada nesta categoria.');
    const membro = await prisma.usuarioClube.findFirst({ where: { usuario_id: usuarioId, clube_id: clubeId, papel: { in: [...equipeOperacional] } }, select: { id: true } });
    const jogosDoClube = new Set(p.snapshot.jogos.filter(j => j.mandanteId === equipe.equipeId || j.visitanteId === equipe.equipeId).map(j => j.id));
    const pendencias = membro ? p.pendencias.filter(v => jogosDoClube.has(v.jogoId)) : [];
    const pausa = await buscarPausa(['AGENDA_OFICIAL', 'SINCRONIZAR_PAULISTA'], { eventoId: p.snapshot.id });
    res.json({ ...p, pendencias, calculado: rankingCalculado(p.snapshot), manutencao: pausa ? pausaPublica(pausa) : null });
  }));
  r.post('/paulista/jogos/:id/retroativo', exigirGestorDoClube, habilitado, rota(async (req, res) => {
    res.status(201).json(await retroativo(prisma, String(req.params.id), (req as any).clubeId, (req as any).usuarioId, req.body));
  }));
  r.get('/paulista/jogos/:id/jogadores', exigirGestorDoClube, habilitado, rota(async (req, res) => {
    const j = await prisma.fpfsJogo.findUniqueOrThrow({ where: { id: String(req.params.id) } });
    const e = j.partidaId ? await prisma.participantePartida.findUnique({ where: { partida_id_clube_id: { partida_id: j.partidaId, clube_id: (req as any).clubeId } } }) : null;
    if (!e) throw new FalhaPaulista(403, 'Clube não participante.');
    // Reutiliza a restrição de categoria do cadastro de jogadores; o endpoint de
    // escrita revalida o escopo na transação, inclusive se o cargo mudar.
    const { podeAcessarCategoria } = await import('../../middlewares/permissoes.middleware.js');
    if (!await podeAcessarCategoria((req as any).usuarioId, (req as any).clubeId, e.categoria_id)) throw new FalhaPaulista(403, 'Categoria sem autorização.');
    res.json(await prisma.jogador.findMany({ where: { categoria_id: e.categoria_id, ativo: true, numCamisa: { not: null } }, select: { id: true, nome: true, numCamisa: true } }));
  }));
  r.get('/admin/paulista/clubes', exigirSuperAdmin, habilitado, rota(async (_req, res) => { res.json(await prisma.clube.findMany({ select: { id: true, nome: true, cidade: true, categorias: { select: { nome: true, faixaIdade: true } } } })); }));
  r.get('/admin/paulista', exigirSuperAdmin, habilitado, rota(async (_req, res) => {
    const [resumo, pausas, recentes] = await Promise.all([
      resumoAdministrativo(prisma),
      prisma.manutencao.findMany({ where: { ativa: true, operacao: { in: ['AGENDA_OFICIAL', 'SINCRONIZAR_PAULISTA'] } } }),
      prisma.fpfsAuditoria.findMany({ where: { acao: 'DADOS_OFICIAIS_ALTERADOS' }, orderBy: { criadoEm: 'desc' }, take: 8, select: { id: true, eventoId: true, criadoEm: true } }),
    ]);
    res.json({ ...resumo, recentes, catalogo: resumo.catalogo.map(e => {
      const p = pausas.find(p => p.escopo === 'GLOBAL' || p.escopo === 'EVENTO' && p.alvoId === e.id);
      return { ...e, estado: p ? 'PAUSADO' : e.estado, manutencao: p ? pausaPublica(p) : null };
    }) });
  }));
  r.get('/admin/paulista/candidatos', exigirSuperAdmin, habilitado, rota(async (req, res) => {
    const nome = String(req.query.nome || '').trim();
    res.json(nome.length >= 3 && nome.length <= 80 ? await candidatosCascas(prisma, nome) : []);
  }));
  r.get('/admin/paulista/eventos/:id', exigirSuperAdmin, habilitado, rota(async (req, res) => {
    const eventoId = id(req.params.id);
    const p = await painel(prisma, eventoId);
    const chamados = await prisma.suporteChamado.findMany({ where: { fingerprint: { in: [
      ...p.pendencias.filter(v => v.id > 0).map(v => chaveChamadoPaulista(v.id)), ...p.vinculos.map(v => chaveChamadoVinculo(eventoId, v.equipeId)),
    ] } }, select: { id: true, fingerprint: true, status: true } });
    res.json({ ...p,
      chamados: Object.fromEntries(chamados.filter(c => c.fingerprint?.startsWith('paulista-pendencia:')).map(c => [c.fingerprint?.split(':').at(-1), { id: c.id, status: c.status }])),
      vinculoChamados: Object.fromEntries(chamados.filter(c => c.fingerprint?.startsWith('paulista-vinculo:')).map(c => [c.fingerprint?.split(':').at(-1), c.id])),
    });
  }));
  r.post('/admin/paulista/verificar', exigirSuperAdmin, habilitado, limite, rota(async (_req, res) => {
    await exigirOperacao(['SINCRONIZAR_PAULISTA', 'AGENDA_OFICIAL']);
    res.json(await executarCiclo(prisma, n => sincronizar(n, null, io)));
  }));
  r.post('/admin/paulista/eventos/:id/rejeitar-sugestao', exigirSuperAdmin, habilitado, rota(async (req, res) => {
    const eventoId = id(req.params.id), equipeId = id(req.body.equipeId), clubeId = id(req.body.clubeId);
    const c = await prisma.fpfsCatalogo.findUniqueOrThrow({ where: { id: eventoId } });
    if (!(c.equipes as any[]).some(e => e.id === equipeId)) throw new FalhaPaulista(404, 'Equipe não pertence ao campeonato.');
    await prisma.clube.findUniqueOrThrow({ where: { id: clubeId } });
    if (await prisma.fpfsVinculo.findUnique({ where: { equipeId } })) throw new FalhaPaulista(409, 'Identidade já confirmada: use a revisão de vínculo para preservar o histórico.');
    if (!await prisma.fpfsEvento.findUnique({ where: { id: eventoId } })) {
      await exigirOperacao(['SINCRONIZAR_PAULISTA', 'AGENDA_OFICIAL'], { eventoId });
      await importar(prisma, await baixarEvento(eventoId), (req as any).usuarioId);
    }
    await prisma.fpfsAuditoria.create({ data: { eventoId, usuarioId: (req as any).usuarioId, acao: 'SUGESTAO_REJEITADA', dados: json({ equipeId, clubeId, motivo: motivo(req.body.motivo), antes: 'SUGESTAO', depois: 'REJEITADA' }) } });
    res.json({ ok: true });
  }));
  r.post('/admin/paulista/eventos/:id/confirmar', exigirSuperAdmin, habilitado, limite, rota(async (req, res) => {
    if (req.body?.confirmacao !== 'CONFIRMAR_IDENTIDADE') throw new FalhaPaulista(400, 'Confirme a identidade antes de reaproveitar histórico.');
    const eventoId = id(req.params.id);
    await exigirOperacao(['SINCRONIZAR_PAULISTA', 'AGENDA_OFICIAL'], { eventoId });
    await confirmarCandidato(prisma, eventoId, id(req.body.equipeId), id(req.body.clubeId), (req as any).usuarioId, motivo(req.body.motivo));
    await executarCiclo(prisma, n => sincronizar(n, (req as any).usuarioId, io));
    res.json({ ok: true });
  }));
  r.post('/admin/paulista/eventos/:id/pendencias/:pendenciaId/chamado', exigirSuperAdmin, habilitado, rota(async (req, res) => {
    const resultado = await encaminharPendencia(id(req.params.id), id(req.params.pendenciaId), (req as any).usuarioId, motivo(req.body?.motivo));
    res.status(resultado.criado ? 201 : 200).json(resultado);
  }));
  r.post('/admin/paulista/eventos/:id/pendencias/:pendenciaId', exigirSuperAdmin, habilitado, rota(async (req, res) => {
    res.json(await revisarPendencia(prisma, id(req.params.id), id(req.params.pendenciaId), (req as any).usuarioId, motivo(req.body.motivo), String(req.body.acao), req.body.esperado));
  }));
  r.post('/admin/paulista/eventos/:id/chamado-placar', exigirSuperAdmin, habilitado, rota(async (req, res) => {
    const eventoId = id(req.params.id), razao = motivo(req.body?.motivo);
    if (typeof req.body.jogoId !== 'string' || req.body.jogoId.length > 100) throw new FalhaPaulista(400, 'Jogo inválido.');
    const p = await registrarPlacarAtual(prisma, eventoId, req.body.jogoId);
    const resultado = await encaminharPendencia(eventoId, p.id, (req as any).usuarioId, razao);
    res.status(resultado.criado ? 201 : 200).json(resultado);
  }));
  r.post('/admin/paulista/eventos/:id/avaliar-placar', exigirSuperAdmin, habilitado, rota(async (req, res) => {
    const eventoId = id(req.params.id), razao = motivo(req.body.motivo);
    if (typeof req.body.jogoId !== 'string' || req.body.jogoId.length > 100) throw new FalhaPaulista(400, 'Jogo inválido.');
    const p = await registrarPlacarAtual(prisma, eventoId, req.body.jogoId);
    res.json(await revisarPendencia(prisma, eventoId, p.id, (req as any).usuarioId, razao, String(req.body.acao), req.body.esperado));
  }));
  r.post('/admin/paulista/eventos/:id/acompanhamento', exigirSuperAdmin, habilitado, rota(async (req, res) => {
    const eventoId = id(req.params.id), razao = motivo(req.body?.motivo);
    if (typeof req.body.acompanhado !== 'boolean') throw new FalhaPaulista(400, 'Informe acompanhamento.');
    const e = await prisma.fpfsEvento.findUniqueOrThrow({ where: { id: eventoId } });
    if (req.body.acompanhado && !e.verificadoEm) throw new FalhaPaulista(409, 'Confirme uma identidade antes de acompanhar.');
    await prisma.$transaction([
      prisma.fpfsCatalogo.update({ where: { id: eventoId }, data: { acompanhado: req.body.acompanhado, proximaEm: req.body.acompanhado ? new Date() : null } }),
      prisma.fpfsAuditoria.create({ data: { eventoId, usuarioId: (req as any).usuarioId, acao: 'ACOMPANHAMENTO', dados: json({ acompanhado: req.body.acompanhado, motivo: razao }) } }),
    ]);
    res.json({ ok: true });
  }));
  r.post('/admin/paulista/eventos/:id/revisar-vinculo', exigirSuperAdmin, habilitado, rota(async (req, res) => {
    res.json(await solicitarAnaliseVinculo(id(req.params.id), id(req.body.equipeId), (req as any).usuarioId, motivo(req.body.motivo)));
  }));
  r.post('/admin/paulista/eventos/:id/sincronizar', exigirSuperAdmin, habilitado, limite, rota(async (req, res) => { res.json(await sincronizar(id(req.params.id), (req as any).usuarioId, io)); }));
  r.get('/admin/paulista/conferencia', exigirSuperAdmin, habilitado, limite, rota(async (req, res) => { res.json(await conferirCategorias(id(req.query.ano), id(req.query.equipe))); }));
  r.get('/admin/paulista/eventos/:id/sugestoes', exigirSuperAdmin, habilitado, rota(async (req, res) => {
    const p = await painel(prisma, id(req.params.id));
    const clubes = await prisma.clube.findMany({ select: { id: true, nome: true, cidade: true, estado: true } });
    res.json(p.snapshot.equipes.map(e => ({ equipe: e, sugestoes: sugestoes(e.nome, clubes) })));
  }));
  r.post('/admin/paulista/eventos/:id/vincular', exigirSuperAdmin, habilitado, rota(async (req, res) => {
    if (req.body?.confirmacao !== 'CONFIRMAR_IDENTIDADE') throw new FalhaPaulista(400, 'Confirme explicitamente a identidade externa e o clube.');
    const eventId = id(req.params.id);
    await exigirOperacao(['AGENDA_OFICIAL'], { eventoId: eventId });
    await vincular(prisma, eventId, id(req.body.equipeId), id(req.body.clubeId), (req as any).usuarioId, motivo(req.body.motivo));
    res.json({ ok: true, mensagem: 'Identidade confirmada. Sincronize para distribuir as partidas.' });
  }));
  r.post('/admin/paulista/eventos/:id/desvincular', exigirSuperAdmin, habilitado, rota(async (req, res) => {
    await exigirOperacao(['AGENDA_OFICIAL'], { eventoId: id(req.params.id) });
    await desfazerVinculo(prisma, id(req.params.id), id(req.body.equipeId), (req as any).usuarioId, motivo(req.body.motivo)); res.json({ ok: true });
  }));
  r.post('/admin/paulista/eventos/:id/programar', exigirSuperAdmin, habilitado, rota(async (req, res) => {
    if (typeof req.body?.diario !== 'boolean') throw new FalhaPaulista(400, 'Informe diario como booleano.');
    const e = await prisma.fpfsEvento.findUniqueOrThrow({ where: { id: id(req.params.id) } });
    if (req.body.diario && !e.verificadoEm) throw new FalhaPaulista(409, 'Primeiro verificar o evento e confirmar um vínculo.');
    await prisma.fpfsEvento.update({ where: { id: e.id }, data: { diario: req.body.diario } });
    await prisma.fpfsAuditoria.create({ data: { eventoId: e.id, usuarioId: (req as any).usuarioId, acao: 'PROGRAMACAO', dados: json(req.body) } });
    res.json({ diario: req.body.diario });
  }));
  r.get('/admin/paulista/eventos/:id/historico', exigirSuperAdmin, habilitado, rota(async (req, res) => {
    const jogo = typeof req.query.jogo === 'string' && req.query.jogo.length <= 100 ? req.query.jogo : '';
    const pendencia = Number(req.query.pendencia);
    const filtro = Number.isSafeInteger(pendencia) && pendencia > 0 ? { path: ['pendenciaId'], equals: pendencia }
      : jogo ? { path: ['jogoId'], equals: jogo } : undefined;
    const a = await prisma.fpfsAuditoria.findMany({ where: { eventoId: id(req.params.id), dados: filtro }, orderBy: { id: 'desc' }, take: 30 });
    const operadores = await prisma.usuario.findMany({ where: { id: { in: a.flatMap(r => r.usuarioId ? [r.usuarioId] : []) } }, select: { id: true, nome: true } });
    res.json(a.map(row => { const { snapshot, ...dados } = row.dados as any; return { ...row, operador: operadores.find(u => u.id === row.usuarioId)?.nome || 'Sistema', dados }; }));
  }));
  return r;
}

// Feature flag e ausência de tabelas não bloqueiam os fluxos antigos.
export const protegerPaulista: RequestHandler = async (req, res, next) => {
  const path = req.path.replace(/\/+$/, '').toLowerCase();
  const partida = path.match(/^\/partidas\/(\d+)(?:\/(local|status))?$/);
  const comp = path.match(/^\/competicoes\/(\d+)$/);
  const agenda = partida && ['PATCH', 'PUT', 'DELETE'].includes(req.method) && (partida[2] !== 'status' || req.body?.status === 'CANCELADA');
  const competition = comp && ['PATCH', 'DELETE'].includes(req.method);
  const criar = path === '/partidas' && req.method === 'POST' && req.body?.competicao_id;
  const time = path === '/times/vinculo' && req.method === 'PATCH';
  if (!agenda && !competition && !criar && !time) return next();
  return exigirAutenticacao(req, res, async () => {
    try {
      const existe = agenda ? await prisma.fpfsJogo.findFirst({ where: { partidaId: Number(partida![1]) } })
        : time ? await prisma.fpfsTime.findFirst({ where: { timeId: { in: Array.isArray(req.body?.time_ids) ? req.body.time_ids.filter(Number.isSafeInteger) : [] } } })
        : await prisma.fpfsEvento.findFirst({ where: { competicaoId: Number(comp?.[1] || req.body.competicao_id) } });
      if (existe) {
        const eventoId = 'eventoId' in existe ? existe.eventoId : existe.id;
        await exigirOperacao(['AGENDA_OFICIAL'], { eventoId });
      }
      if (existe) return res.status(409).json({ error: 'Registro do Paulista: calendário e vínculos são revisados pela integração; as anotações do clube permanecem separadas.' });
      next();
    } catch (e: any) { if (responderPausa(e, res)) return; if (e.code === 'P2021') return next(); next(e); }
  });
};

export function iniciarPaulistaDiario(io: Server) {
  if (!ativo() || process.env.PAULISTA_SYNC_DIARIA !== 'true') return () => undefined;
  console.log('Paulista: rotina ativa; verifica agendamentos a cada minuto, descoberta e acompanhamento com intervalo de 24h.');
  let ocupado = false, encerrado = false;
  const tick = async () => {
    if (ocupado || encerrado) return; ocupado = true;
    try {
      if (!await buscarPausa(['SINCRONIZAR_PAULISTA', 'AGENDA_OFICIAL'])) await executarCiclo(prisma, id => sincronizar(id, null, io));
    } catch { console.error('Paulista: não foi possível consultar programação diária.'); }
    finally { ocupado = false; }
  };
  const timer = setInterval(() => void tick(), 60_000);
  void tick();
  timer.unref(); return () => { encerrado = true; clearInterval(timer); };
}
