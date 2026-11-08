import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { exigirClubePublico, obterEscopoCategoriasLeitura, podeAcessarCategoria } from '../../middlewares/permissoes.middleware';
import { idPositivo } from '../../utils/id';
import { registrosAtleta, resumirPartidaAtleta } from './perfil-resumo';

export function participacaoAtleta(id: number, clubeId: number, categories: number[] | null): Prisma.PartidaWhereInput {
  return { status: { in: ['AO_VIVO', 'FINALIZADA'] }, AND: [{ OR: [{ categoria: { clube_id: clubeId }, ...(categories ? { categoria_id: { in: categories } } : {}) }, { participantes: { some: { clube_id: clubeId, ...(categories ? { categoria_id: { in: categories } } : {}) } } }] }],
    OR: [{ jogadores_escalonados: { some: { jogador_id: id } } }, { eventos: { some: { jogador_id: id } } }] };
}
const matchSelect = (id: number, clubeId: number) => ({ id: true, data: true, horario: true, local: true, status: true, gols_mandante: true, gols_visitante: true,
  mandante_id: true, visitante_id: true, emCasa: true, categoria: { select: { clube_id: true } },
  participantes: { where: { clube_id: clubeId }, select: { time_id: true } },
  jogadores_escalonados: { where: { jogador_id: id }, select: { time_id: true, titular_inicial: true } },
  eventos: { where: { jogador_id: id }, select: { tipo: true, gol_contra: true, time_id: true } },
  mandante: { select: { nome: true, escudo: true, clubeRepresentado: { select: { escudo: true } } } },
  visitante: { select: { nome: true, escudo: true, clubeRepresentado: { select: { escudo: true } } } },
  competicao: { select: { id: true, nome: true, ano: true } } } satisfies Prisma.PartidaSelect);
const order = [{ data: 'desc' }, { horario: 'desc' }, { id: 'desc' }] satisfies Prisma.PartidaOrderByWithRelationInput[];
const router = Router();
router.get(['/jogadores/:id', '/jogadores/:id/partidas', '/jogadores/:id/campeonatos'], exigirClubePublico, async (req, res) => {
  const id = idPositivo(req.params.id), clubeId = (req as any).clubeId as number, usuarioId = (req as any).usuarioId as number;
  if (!id) return res.status(400).json({ error: 'Jogador inválido.' });
  const page = req.query.pagina === undefined ? 1 : Number(req.query.pagina);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) return res.status(400).json({ error: 'Página inválida.' });
  try {
    const scope = await obterEscopoCategoriasLeitura(usuarioId, clubeId);
    const player = await prisma.jogador.findFirst({ where: { id, categoria: { clube_id: clubeId }, ...(scope.acessoTotal ? {} : { categoria_id: { in: scope.categoriaIds } }) },
      select: { id: true, nome: true, foto: true, dtNasc: true, numCamisa: true, posicao: true, ativo: true, categoria_id: true,
        categoria: { select: { id: true, nome: true, tipo: true } } } });
    if (!player) return res.status(404).json({ error: 'Jogador não encontrado neste clube ou nas categorias permitidas.' });
    res.setHeader('Cache-Control', 'private, no-store');
    const categoryIds = scope.acessoTotal ? null : scope.categoriaIds;
    const matches = participacaoAtleta(id, clubeId, categoryIds);
    const finalized: Prisma.PartidaWhereInput = { ...matches, status: 'FINALIZADA' };
    const select = matchSelect(id, clubeId);
    const identity = (time: { nome: string; escudo: string | null; clubeRepresentado?: { escudo: string | null } | null }) =>
      ({ nome: time.nome, escudo: time.clubeRepresentado?.escudo || time.escudo });
    const matchWithIdentity = (item: Prisma.PartidaGetPayload<{ select: ReturnType<typeof matchSelect> }>) =>
      ({ ...resumirPartidaAtleta(item, clubeId), mandante: identity(item.mandante), visitante: identity(item.visitante) });
    const competitionSelect = { id: true, nome: true, ano: true, tipo: true,
      _count: { select: { jogadores_inscritos: { where: { jogador_id: id } } } } } satisfies Prisma.CompeticaoSelect;
    // Uma consulta por lote, sem buscar o Scout ou executar uma consulta por campeonato.
    async function enrichCompetitions<T extends { id: number; _count?: { jogadores_inscritos: number } }>(items: T[]) {
      if (!items.length) return [];
      const rows = await prisma.partida.findMany({ where: { ...finalized, competicao_id: { in: items.map(item => item.id) } },
        select: { competicao_id: true, jogadores_escalonados: { where: { jogador_id: id! }, select: { titular_inicial: true } },
          eventos: { where: { jogador_id: id! }, select: { tipo: true, gol_contra: true } } } });
      return items.map(item => {
        const games = rows.filter(row => row.competicao_id === item.id);
        const { _count, ...data } = item;
        return { ...data, inscrito: (_count?.jogadores_inscritos ?? 0) > 0, partidasFinalizadas: games.length,
          convocacoes: games.filter(game => game.jogadores_escalonados.length > 0).length,
          registros: registrosAtleta(games.flatMap(game => game.eventos)) };
      });
    }
    // Championships include explicit enrollment or actual participation, never the whole club calendar.
    const competitions: Prisma.CompeticaoWhereInput = { OR: [
      { jogadores_inscritos: { some: { jogador_id: id } } }, { partidas: { some: matches } },
    ] };
    if (req.path.endsWith('/partidas')) {
      const status = typeof req.query.status === 'string' ? req.query.status : '';
      if (status && !['AGENDADA','PREPARADA','AO_VIVO','FINALIZADA','CANCELADA'].includes(status)) return res.status(400).json({ error: 'Situação inválida.' });
      const year = req.query.ano === undefined ? null : Number(req.query.ano);
      const competitionId = req.query.competicao_id === undefined ? null : idPositivo(req.query.competicao_id);
      if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100)) return res.status(400).json({ error: 'Ano inválido.' });
      if (req.query.competicao_id !== undefined && !competitionId) return res.status(400).json({ error: 'Campeonato inválido.' });
      const where: Prisma.PartidaWhereInput = { ...matches, ...(status ? { status: status as any } : {}),
        ...(competitionId ? { competicao_id: competitionId } : {}),
        ...(year ? { data: { gte: new Date(`${year}-01-01T00:00:00Z`), lt: new Date(`${year + 1}-01-01T00:00:00Z`) } } : {}) };
      const [total, items] = await prisma.$transaction([prisma.partida.count({ where }), prisma.partida.findMany({ where, select, orderBy: order, skip: (page - 1) * 20, take: 20 })]);
      return res.json({ items: items.map(matchWithIdentity), total, pagina: page, porPagina: 20 });
    }
    if (req.path.endsWith('/campeonatos')) {
      const year = req.query.ano === undefined ? null : Number(req.query.ano);
      if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100)) return res.status(400).json({ error: 'Ano inválido.' });
      const where = { ...competitions, ...(year ? { ano: year } : {}) };
      const [total, items] = await prisma.$transaction([prisma.competicao.count({ where }), prisma.competicao.findMany({ where, select: competitionSelect, orderBy: [{ ano: 'desc' }, { id: 'desc' }], skip: (page - 1) * 20, take: 20 })]);
      return res.json({ items: await enrichCompetitions(items), total, pagina: page, porPagina: 20 });
    }
    const membership = await prisma.usuarioClube.findUnique({ where: { usuario_id_clube_id: { usuario_id: usuarioId, clube_id: clubeId } }, select: { papel: true } });
    const canEdit = !!membership && ['ADMIN','TECNICO','MESARIO'].includes(membership.papel) && await podeAcessarCategoria(usuarioId, clubeId, player.categoria_id);
    const canViewCpf = canEdit && ['ADMIN','TECNICO'].includes(membership!.papel);
    const [totalPartidas, previewMatches, totalCompeticoes, previewCompetitions, events, lineups, dates, competitionOptions] = await prisma.$transaction([
      prisma.partida.count({ where: matches }), prisma.partida.findMany({ where: matches, select, orderBy: order, take: 3 }),
      prisma.competicao.count({ where: competitions }), prisma.competicao.findMany({ where: competitions, select: competitionSelect, orderBy: [{ ano: 'desc' }, { id: 'desc' }], take: 3 }),
      prisma.evento.groupBy({ by: ['tipo', 'gol_contra'], where: { jogador_id: id, partida: { is: finalized } }, _count: { _all: true } }),
      prisma.escalacaoPartida.groupBy({ by: ['titular_inicial'], where: { jogador_id: id, partida: { is: finalized } }, _count: { _all: true } }),
      prisma.partida.findMany({ where: matches, distinct: ['data'], select: { data: true } }),
      prisma.competicao.findMany({ where: competitions, select: { id: true, nome: true, ano: true }, orderBy: [{ ano: 'desc' }, { nome: 'asc' }] }),
    ]);
    const summary = registrosAtleta([]);
    for (const event of events) {
      const values = registrosAtleta([event]);
      for (const key of Object.keys(summary) as (keyof typeof summary)[]) summary[key] += values[key] * event._count._all;
    }
    const privateData = canViewCpf ? await prisma.jogador.findUnique({ where: { id }, select: { cpf: true } }) : null;
    return res.json({ ...player, ...(canViewCpf ? { cpf: privateData?.cpf } : {}), podeEditar: canEdit, totalPartidas, totalCompeticoes,
      resumo: { ...summary, convocacoes: lineups.reduce((n, row) => n + row._count._all, 0) },
      temporadas: [...new Set(dates.map(row => row.data.getUTCFullYear()))].sort((a, b) => b - a),
      opcoesCampeonatos: competitionOptions,
      partidas: previewMatches.map(matchWithIdentity), campeonatos: await enrichCompetitions(previewCompetitions) });
  } catch { return res.status(500).json({ error: 'Não foi possível carregar o perfil do jogador.' }); }
});
export default router;
