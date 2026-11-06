import { Router, type RequestHandler } from 'express';
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { idPositivo } from '../../utils/id';
import { limitarRequisicoes } from '../../middlewares/rate-limit.middleware';
import { consultarHome, dataHomeValida } from '../partidas/home.service';
import { escopoPartidas } from '../partidas/visibilidade';
import { clubePublicoSelect, consultarPartidaPublica, partidaPublicaSelect, publicarPartida, competicaoPublicaSelect, escopoCompeticoesPublicas, classificarPartidas } from './publico.service';

export function criarPublicoRoutes(banco: PrismaClient = prisma) {
  const router = Router();
  router.use('/publico', limitarRequisicoes({ janelaMs: 60_000, limite: 240, prefixo: 'consulta-publica', porEmail: false }));
  const safe = (handler: RequestHandler): RequestHandler => async (req, res, next) => {
    try { await handler(req, res, next); } catch { res.status(500).json({ error: 'Não foi possível carregar esta consulta. Tente novamente.' }); }
  };
  const clube: RequestHandler = safe(async (req, res, next) => {
    const id = idPositivo(req.params.clubeId);
    if (!id) { res.status(400).json({ error: 'Clube inválido.' }); return; }
    const found = await banco.clube.findUnique({ where: { id }, select: clubePublicoSelect });
    if (!found) { res.status(404).json({ error: 'Clube não encontrado.' }); return; }
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
  router.get('/publico/partidas/:id', safe(async (req, res) => {
    const id = idPositivo(req.params.id);
    if (!id) { res.status(400).json({ error: 'Partida inválida.' }); return; }
    const data = await consultarPartidaPublica(banco, id, idPositivo(req.query.clube_id) || undefined);
    if (!data?.clube) { res.status(404).json({ error: 'Partida não encontrada.' }); return; }
    res.json(data);
  }));
  router.get('/publico/clubes/:clubeId/competicoes', clube, safe(async (_req, res) => {
    const rows = await banco.competicao.findMany({ where: escopoCompeticoesPublicas(res.locals.clube.id), select: competicaoPublicaSelect, orderBy: [{ ano: 'desc' }, { nome: 'asc' }] });
    res.json(rows.map(({ clube: organizador, ...competition }) => ({ ...competition, organizador, somente_leitura: true })));
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
