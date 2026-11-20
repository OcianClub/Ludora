import { createHash } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { idPositivo } from '../../utils/id';
import { limitarRequisicoes } from '../../middlewares/rate-limit.middleware';
import { consultarHome, dataHomeValida } from '../partidas/home.service';
import { escopoPartidas } from '../partidas/visibilidade';
import { referenciasCompeticoes, ativo as paulistaAtivo } from '../paulista/service';
import type { CatalogoPaulistaPublico, EventoPublicoPaulista, PublicacaoPaulistaDetalhe, SnapshotPaulista } from '../../../../../packages/shared-types/src/paulista';
import { consultarAoVivo } from './ao-vivo.service';
import { consultarAgenda } from '../partidas/agenda.service';
import { FiltroDataInvalido } from '../partidas/filtros-data.utils';
import { resumirCompeticoes } from '../cadastros/competicao-resumo.service';
import { clubePublicoSelect, consultarPartidaPublica, partidaPublicaSelect, publicarPartida, competicaoPublicaSelect, escopoCompeticoesPublicas, classificarPartidas } from './publico.service';

const camposCatalogo = { id: true, ano: true, divisao: true, categoria: true, hash: true, verificadoEm: true } as const;
type EventoCatalogo = Prisma.FpfsEventoGetPayload<{ select: typeof camposCatalogo }>;
type EventoComPublicacao = EventoCatalogo & { payload: Prisma.JsonValue };
const ordemEventos: Prisma.FpfsEventoOrderByWithRelationInput[] = [{ ano: 'desc' }, { id: 'asc' }];

function publicarEvento(e: EventoComPublicacao, equipes: number[]): EventoPublicoPaulista {
  const s = e.payload as unknown as SnapshotPaulista;
  return { id: e.id, ano: e.ano, divisao: e.divisao, categoria: e.categoria, fonte: s.fonte,
    equipes: s.equipes, jogos: s.jogos, classificacao: s.classificacao, fasesExcluidas: s.fasesExcluidas || [],
    equipesClube: equipes.filter(id => s.equipes.some(t => t.id === id)), verificadoEm: e.verificadoEm?.toISOString() ?? null };
}

function revisaoPublicacao(e: EventoCatalogo, equipes: number[]) {
  // O vínculo do clube e a data de verificação podem mudar sem nova importação.
  const identidade = [e.id, e.ano, e.divisao, e.categoria, e.hash, e.verificadoEm, equipes];
  return createHash('sha256').update(JSON.stringify(identidade)).digest('base64url');
}

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
  async function equipesPaulista(clubeId: number) {
    const links = await banco.fpfsVinculo.findMany({ where: { clubeId }, select: { equipeId: true } });
    return links.map(l => l.equipeId);
  }
  const eventosDoClube = (equipes: number[]): Prisma.FpfsEventoWhereInput => ({
    times: { some: { equipeId: { in: equipes } } },
  });
  async function detalhePaulista(id: number, equipes: number[]): Promise<PublicacaoPaulistaDetalhe | null> {
    if (!equipes.length) return null;
    const evento = await banco.fpfsEvento.findFirst({
      where: { id, ...eventosDoClube(equipes) }, select: { ...camposCatalogo, payload: true },
    });
    return evento ? { revisao: revisaoPublicacao(evento, equipes), evento: publicarEvento(evento, equipes) } : null;
  }
  router.get('/publico/clubes/:clubeId/paulista', clube, safe(async (_req, res) => {
    if (!paulistaAtivo()) { res.json([]); return; }
    const equipes = await equipesPaulista(res.locals.clube.id);
    const eventos = await banco.fpfsEvento.findMany({ where: eventosDoClube(equipes),
      select: { ...camposCatalogo, payload: true }, orderBy: ordemEventos });
    // Somente a publicação oficial armazenada. Nenhuma sincronização, motivo interno ou auditoria.
    res.json(eventos.map(e => publicarEvento(e, equipes)));
  }));
  router.get('/publico/clubes/:clubeId/paulista/catalogo', clube, safe(async (req, res) => {
    if (!paulistaAtivo()) { res.json({ eventos: [] }); return; }
    const equipes = (await equipesPaulista(res.locals.clube.id)).sort((a, b) => a - b);
    const eventos = equipes.length ? await banco.fpfsEvento.findMany({
      where: eventosDoClube(equipes), select: camposCatalogo, orderBy: ordemEventos,
    }) : [];
    const catalogo: CatalogoPaulistaPublico = {
      eventos: eventos.map(e => ({
        id: e.id, ano: e.ano, divisao: e.divisao, categoria: e.categoria, revisao: revisaoPublicacao(e, equipes),
      })),
    };
    if (req.query.incluirInicial === '1' && eventos.length) {
      const sub = (e: EventoCatalogo) => Number(e.categoria.match(/\d+/)?.[0]) || 0;
      const evento = [...eventos].sort((a, b) => b.ano - a.ano || sub(a) - sub(b))[0];
      const inicial = await detalhePaulista(evento.id, equipes);
      if (inicial) catalogo.inicial = inicial;
    }
    res.json(catalogo);
  }));
  router.get('/publico/clubes/:clubeId/paulista/eventos/:eventoId', clube, safe(async (req, res) => {
    const id = idPositivo(req.params.eventoId);
    if (!id || id > 2_147_483_647) { res.status(400).json({ error: 'Evento inválido.' }); return; }
    const equipes = paulistaAtivo() ? (await equipesPaulista(res.locals.clube.id)).sort((a, b) => a - b) : [];
    const detalhe = await detalhePaulista(id, equipes);
    if (!detalhe) { res.status(404).json({ error: 'Publicação não encontrada para este clube.' }); return; }
    res.json(detalhe);
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
        ...(req.query.formato === 'web' ? { categoria_id: p.categoria.id, mandante_id: p.mandante.id, visitante_id: p.visitante.id,
          organizador_id: p.organizador_id, clube_origem_id: p.clube_origem_id,
          paulista_evento_id: 'paulista_evento_id' in p ? p.paulista_evento_id : undefined,
          revisao_grupo: 'revisao_grupo' in p ? p.revisao_grupo : undefined } : {}),
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
