import { Router, type RequestHandler } from 'express';
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { idPositivo } from '../../utils/id';
import { limitarRequisicoes } from '../../middlewares/rate-limit.middleware';
import { consultarHome, dataHomeValida } from '../partidas/home.service';
import { escopoPartidas } from '../partidas/visibilidade';
import { referenciasCompeticoes, ativo as paulistaAtivo } from '../paulista/service';
import type { SnapshotPaulista } from '../../../../../packages/shared-types/src/paulista';
import { consultarAoVivo } from './ao-vivo.service';
import { consultarAgenda } from '../partidas/agenda.service';
import { FiltroDataInvalido } from '../partidas/filtros-data.utils';
import { resumirCompeticoes } from '../cadastros/competicao-resumo.service';
import { clubePublicoSelect, consultarPartidaPublica, partidaPublicaSelect, publicarPartida, competicaoPublicaSelect, escopoCompeticoesPublicas, classificarPartidas } from './publico.service';

export function criarPublicoRoutes(banco: PrismaClient = prisma) {
  const router = Router();
  router.use('/publico', limitarRequisicoes({ janelaMs: 60_000, limite: 240, prefixo: 'consulta-publica', porEmail: false }));
  const safe = (handler: RequestHandler): RequestHandler => async (req, res, next) => {
    try { await handler(req, res, next); } catch { res.status(500).json({ error: 'Não foi possível carregar esta consulta. Tente novamente.' }); }
  };
  router.get('/publico/partidas/ao-vivo', safe(async (_req, res) => {
    res.json(await consultarAoVivo(banco));
  }));
  const clube: RequestHandler = safe(async (req, res, next) => {
    const id = idPositivo(req.params.clubeId);
    if (!id) { res.status(400).json({ error: 'Clube inválido.' }); return; }
    const found = await banco.clube.findUnique({ where: { id }, select: { ...clubePublicoSelect, ativo: true } });
    if (!found) { res.status(404).json({ error: 'Clube não encontrado.' }); return; }
    if (found.ativo === false && req.route.path !== '/publico/clubes/:clubeId') {
      res.status(423).json({ error: 'Clube indisponível no momento.', code: 'CLUBE_DESATIVADO' }); return;
    }
    res.locals.clube = found; next();
  });
  router.get('/publico/clubes/:clubeId', clube, (_req, res) => { res.json(res.locals.clube); });
  router.get('/publico/clubes/:clubeId/categorias', clube, safe(async (_req, res) => {
    res.json(await banco.categoria.findMany({ where: { clube_id: res.locals.clube.id }, select: { id: true, nome: true, tipo: true, clube_id: true }, orderBy: { nome: 'asc' } }));
  }));
  router.get('/publico/clubes/:clubeId/times', clube, safe(async (_req, res) => {
    const rows = await banco.time.findMany({ where: { categoria: { clube_id: res.locals.clube.id } }, select: { id: true, nome: true, escudo: true, categoria_id: true, clube_representado_id: true }, orderBy: { nome: 'asc' } });
    res.json(rows);
  }));
  router.get('/publico/clubes/:clubeId/paulista', clube, safe(async (_req, res) => {
    if (!paulistaAtivo()) { res.json([]); return; }
    const links = await banco.fpfsVinculo.findMany({ where: { clubeId: res.locals.clube.id }, select: { equipeId: true } });
    const ids = links.map(l => l.equipeId);
    const eventos = await banco.fpfsEvento.findMany({ where: { times: { some: { equipeId: { in: ids } } } },
      select: { id: true, ano: true, divisao: true, categoria: true, payload: true, verificadoEm: true }, orderBy: [{ ano: 'desc' }, { id: 'asc' }] });
    // Somente a publicação oficial armazenada. Nenhuma sincronização, motivo interno ou auditoria.
    res.json(eventos.map(e => {
      const s = e.payload as unknown as SnapshotPaulista;
      return { id: e.id, ano: e.ano, divisao: e.divisao, categoria: e.categoria, fonte: s.fonte,
        equipes: s.equipes, jogos: s.jogos, classificacao: s.classificacao, fasesExcluidas: s.fasesExcluidas || [],
        equipesClube: ids.filter(id => s.equipes.some(t => t.id === id)), verificadoEm: e.verificadoEm };
    }));
  }));
  router.get('/publico/clubes/:clubeId/partidas/home', clube, safe(async (req, res) => {
    if (!dataHomeValida(req.query.hoje)) { res.status(400).json({ error: 'Data inválida.' }); return; }
    const rows = await consultarHome(banco, res.locals.clube.id, req.query.hoje);
    res.json(rows.map(p => ({ id: p.id, data: p.data, horario: p.horario, local: p.local, status: p.status,
      gols_mandante: p.gols_mandante, gols_visitante: p.gols_visitante, emCasa: p.emCasa,
      mandante: p.mandante, visitante: p.visitante, categoria: p.categoria, competicao: p.competicao,
      competicao_id: p.competicao_id, rodada: p.rodada, grupo: p.grupo, somente_leitura: true })));
  }));
  router.get('/publico/clubes/:clubeId/partidas', clube, safe(async (req, res) => {
    const where: Prisma.PartidaWhereInput = { AND: [escopoPartidas(res.locals.clube.id)] };
    const filters: Prisma.PartidaWhereInput[] = [];
    for (const key of ['categoria_id', 'competicao_id'] as const) {
      if (req.query[key] === undefined) continue;
      const value = idPositivo(req.query[key]);
      if (!value) { res.status(400).json({ error: 'Filtro inválido.' }); return; }
      filters.push(key === 'categoria_id' ? { OR: [{ categoria_id: value }, { participantes: { some: { clube_id: res.locals.clube.id, categoria_id: value } } }] } : { competicao_id: value });
    }
    if (req.query.status !== undefined) {
      const value = String(req.query.status);
      if (!['AGENDADA', 'PREPARADA', 'AO_VIVO', 'FINALIZADA', 'CANCELADA'].includes(value)) { res.status(400).json({ error: 'Situação inválida.' }); return; }
      filters.push({ status: value as any });
    }
    where.AND = [escopoPartidas(res.locals.clube.id), ...filters];
    const rows = await banco.partida.findMany({ where, select: partidaPublicaSelect, take: 1000, orderBy: [{ data: 'desc' }, { horario: 'desc' }, { id: 'desc' }] });
    res.json(rows.map(p => publicarPartida(p, res.locals.clube.id)));
  }));
  router.get('/publico/clubes/:clubeId/partidas/agenda', clube, safe(async (req, res) => {
    try {
      const rows = await consultarAgenda(banco, res.locals.clube.id, req.query);
      res.json(rows.map(p => ({ id: p.id, data: p.data, horario: p.horario, local: p.local, status: p.status,
        gols_mandante: p.gols_mandante, gols_visitante: p.gols_visitante, emCasa: p.emCasa,
        mandante: p.mandante, visitante: p.visitante, categoria: p.categoria, competicao: p.competicao,
        competicao_id: p.competicao_id, rodada: p.rodada, grupo: p.grupo, somente_leitura: true,
        grupo_agenda: p.grupo_agenda, posicao: p.posicao, total_grupo: p.total_grupo })));
    } catch (error) {
      if (error instanceof FiltroDataInvalido) { res.status(400).json({ error: error.message }); return; }
      throw error;
    }
  }));
  router.get('/publico/partidas/:id', safe(async (req, res) => {
    const id = idPositivo(req.params.id);
    if (!id) { res.status(400).json({ error: 'Partida inválida.' }); return; }
    const data = await consultarPartidaPublica(banco, id, idPositivo(req.query.clube_id) || undefined);
    if (!data?.clube) { res.status(404).json({ error: 'Partida não encontrada.' }); return; }
    res.json(data);
  }));
  router.get('/publico/clubes/:clubeId/competicoes', clube, safe(async (req, res) => {
    const rows = await banco.competicao.findMany({ where: escopoCompeticoesPublicas(res.locals.clube.id), select: competicaoPublicaSelect, orderBy: [{ ano: 'desc' }, { nome: 'asc' }] });
    const oficiais = await referenciasCompeticoes(banco, rows.map(row => row.id));
    const resumos = req.query.resumo === 'true' ? await resumirCompeticoes(banco, rows.filter(row => !oficiais.has(row.id)).map(row => row.id)) : new Map();
    res.json(rows.map(({ clube: organizador, ...competition }) => ({
      ...competition,
      resumo: resumos.get(competition.id),
      organizador,
      somente_leitura: true,
      paulista_evento_id: oficiais.get(competition.id),
    })));
  }));
  router.get('/publico/clubes/:clubeId/competicoes/:id/classificacao', clube, safe(async (req, res) => {
    const id = idPositivo(req.params.id);
    if (!id) { res.status(400).json({ error: 'Competição inválida.' }); return; }
    const competition = await banco.competicao.findFirst({ where: { AND: [{ id }, escopoCompeticoesPublicas(res.locals.clube.id)] }, select: { id: true } });
    if (!competition) { res.status(404).json({ error: 'Competição não encontrada neste clube.' }); return; }
    const rows = await banco.partida.findMany({ where: { competicao_id: id, status: 'FINALIZADA' }, select: partidaPublicaSelect, take: 5000 });
    res.json(classificarPartidas(rows));
  }));
  return router;
}
