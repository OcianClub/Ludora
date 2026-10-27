import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { exigirClubePublico, obterEscopoCategoriasLeitura, podeAcessarCategoria } from '../../middlewares/permissoes.middleware';
import { idPositivo } from '../../utils/id';

export function participacaoAtleta(id: number, clubeId: number, categories: number[] | null): Prisma.PartidaWhereInput {
  return { categoria: { clube_id: clubeId }, ...(categories ? { categoria_id: { in: categories } } : {}),
    OR: [{ jogadores_escalonados: { some: { jogador_id: id } } }, { eventos: { some: { jogador_id: id } } }] };
}
const matchSelect = { id: true, data: true, horario: true, local: true, status: true, gols_mandante: true, gols_visitante: true,
  mandante: { select: { nome: true, escudo: true } }, visitante: { select: { nome: true, escudo: true } },
  competicao: { select: { id: true, nome: true, ano: true } } } satisfies Prisma.PartidaSelect;
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
    const categoryIds = scope.acessoTotal ? null : scope.categoriaIds;
    const matches = participacaoAtleta(id, clubeId, categoryIds);
    // Championships include explicit enrollment or actual participation, never the whole club calendar.
    const competitions: Prisma.CompeticaoWhereInput = { clube_id: clubeId, OR: [
      { jogadores_inscritos: { some: { jogador_id: id } } }, { partidas: { some: matches } },
    ] };
    if (req.path.endsWith('/partidas')) {
      const status = typeof req.query.status === 'string' ? req.query.status : '';
      if (status && !['AGENDADA','PREPARADA','AO_VIVO','FINALIZADA','CANCELADA'].includes(status)) return res.status(400).json({ error: 'Situação inválida.' });
      const where: Prisma.PartidaWhereInput = { ...matches, ...(status ? { status: status as any } : {}) };
      const [total, items] = await prisma.$transaction([prisma.partida.count({ where }), prisma.partida.findMany({ where, select: matchSelect, orderBy: [{ data: 'desc' }, { id: 'desc' }], skip: (page - 1) * 20, take: 20 })]);
      return res.json({ items, total, pagina: page, porPagina: 20 });
    }
    if (req.path.endsWith('/campeonatos')) {
      const year = req.query.ano === undefined ? null : Number(req.query.ano);
      if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100)) return res.status(400).json({ error: 'Ano inválido.' });
      const where = { ...competitions, ...(year ? { ano: year } : {}) };
      const [total, items] = await prisma.$transaction([prisma.competicao.count({ where }), prisma.competicao.findMany({ where, select: { id: true, nome: true, ano: true, tipo: true }, orderBy: [{ ano: 'desc' }, { id: 'desc' }], skip: (page - 1) * 20, take: 20 })]);
      return res.json({ items, total, pagina: page, porPagina: 20 });
    }
    const membership = await prisma.usuarioClube.findUnique({ where: { usuario_id_clube_id: { usuario_id: usuarioId, clube_id: clubeId } }, select: { papel: true } });
    const canEdit = !!membership && ['ADMIN','TECNICO','MESARIO'].includes(membership.papel) && await podeAcessarCategoria(usuarioId, clubeId, player.categoria_id);
    const canViewCpf = canEdit && ['ADMIN','TECNICO'].includes(membership!.papel);
    const [totalPartidas, previewMatches, totalCompeticoes, previewCompetitions] = await prisma.$transaction([
      prisma.partida.count({ where: matches }), prisma.partida.findMany({ where: matches, select: matchSelect, orderBy: [{ data: 'desc' }, { id: 'desc' }], take: 3 }),
      prisma.competicao.count({ where: competitions }), prisma.competicao.findMany({ where: competitions, select: { id: true, nome: true, ano: true, tipo: true }, orderBy: [{ ano: 'desc' }, { id: 'desc' }], take: 3 }),
    ]);
    const privateData = canViewCpf ? await prisma.jogador.findUnique({ where: { id }, select: { cpf: true } }) : null;
    res.setHeader('Cache-Control', 'private, no-store');
    return res.json({ ...player, ...(canViewCpf ? { cpf: privateData?.cpf } : {}), podeEditar: canEdit, totalPartidas, totalCompeticoes, partidas: previewMatches, campeonatos: previewCompetitions });
  } catch { return res.status(500).json({ error: 'Não foi possível carregar o perfil do jogador.' }); }
});
export default router;
