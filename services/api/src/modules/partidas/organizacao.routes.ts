import { Router, type Request, type Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { exigirGestorDoClube, obterEscopoCategorias } from '../../middlewares/permissoes.middleware';
import { filtroPartidasAtrasadas } from './horario';
import { acesso, chaveConfronto, exigir, filtroConflitoAgenda, FluxoInvalido, inteiro, validarDados } from './compartilhadas.service';
import type { ContextoOrganizacao, ConflitoOrganizacao } from '../../../../../packages/shared-types/src/matchOrganization';

export function criarOrganizacaoRoutes() {
  const router = Router();
  const tratar = (fn: (req: Request, res: Response) => Promise<void>) => async (req: Request, res: Response) => {
    try { await fn(req, res); }
    catch (error) {
      if (error instanceof FluxoInvalido) { res.status(error.status).json({ error: error.message }); return; }
      console.error('Consulta de organização indisponível.'); res.status(500).json({ error: 'Não foi possível consultar a organização da partida.' });
    }
  };
  router.get('/partidas/atrasadas', exigirGestorDoClube, tratar(async(req,res)=>{
    const ctx = { usuarioId:(req as any).usuarioId as number, clubeId:(req as any).clubeId as number };
    const escopo = await obterEscopoCategorias(ctx.usuarioId,ctx.clubeId);
    const rows=await prisma.partida.findMany({where:{AND:[filtroPartidasAtrasadas(),{fpfsJogo:null,categoria:{clube_id:ctx.clubeId},...(!escopo.acessoTotal ? {categoria_id:{in:escopo.categoriaIds}} : {})}]},orderBy:[{data:'desc'},{id:'desc'}],take:100,select:{id:true,data:true,horario:true,categoria:{select:{id:true,nome:true}}}});
    res.json(rows);
  }));
  router.get('/partidas/organizacao/contexto', exigirGestorDoClube, tratar(async (req, res) => {
    const ctx = { usuarioId: (req as any).usuarioId as number, clubeId: (req as any).clubeId as number };
    const categoriaId = inteiro(req.query.categoria_id);
    const categoria = await prisma.categoria.findUnique({ where: { id: categoriaId } });
    exigir(categoria?.clube_id === ctx.clubeId && await acesso(prisma, ctx, categoriaId), 'Você não administra esta categoria.', 403);
    const scope: Prisma.PartidaWhereInput = { status: { in: ['AO_VIVO', 'FINALIZADA'] }, OR: [{ categoria_id: categoriaId }, { participantes: { some: { clube_id: ctx.clubeId, categoria_id: categoriaId } } }] };
    const [recentes, casa] = await Promise.all([
      prisma.partida.findMany({ where: scope, take: 30, orderBy: [{ data: 'desc' }, { id: 'desc' }], select: { id: true, data: true, emCasa: true,
        mandante: { select: { id: true, nome: true, clube_representado_id: true } }, visitante: { select: { id: true, nome: true, clube_representado_id: true } },
        participantes: { where: { clube_id: ctx.clubeId }, select: { time_id: true } } } }),
      prisma.partida.findFirst({ where: { AND: [scope, { local: { not: null } }, { local: { not: '' } }, { mandante: { clube_representado_id: ctx.clubeId } }] }, orderBy: [{ data: 'desc' }, { id: 'desc' }], select: { id: true, local: true } }),
    ]);
    const response: ContextoOrganizacao = {
      recentes: recentes.map(p => {
        const own = p.participantes[0]?.time_id;
        const emCasa = own ? own === p.mandante.id : p.mandante.clube_representado_id === ctx.clubeId || p.visitante.clube_representado_id !== ctx.clubeId && p.emCasa;
        const outro = emCasa ? p.visitante : p.mandante;
        return { timeId: outro.id, clubeId: outro.clube_representado_id, nome: outro.nome, data: p.data.toISOString().slice(0, 10) };
      }),
      ultimoLocalCasa: casa?.local?.trim() ? { local: casa.local.trim(), partidaId: casa.id } : null,
    };
    res.json(response);
  }));
  router.get('/partidas/organizacao/conflitos', exigirGestorDoClube, tratar(async (req, res) => {
    const ctx = { usuarioId: (req as any).usuarioId as number, clubeId: (req as any).clubeId as number };
    const v = await validarDados(prisma, ctx, req.query);
    const destino = v.destino?.clube_id || null;
    const [partida, proposta] = await Promise.all([
      prisma.partida.findFirst({ where: filtroConflitoAgenda(ctx.clubeId, destino, v.cat, v.dados), select: { id: true, categoria: { select: { clube_id: true } }, participantes: { select: { clube_id: true } } } }),
      prisma.propostaPartida.findFirst({ where: { chave: chaveConfronto(ctx.clubeId, destino, v.cat, v.dados), status: 'PENDENTE' }, select: { id: true } }),
    ]);
    const proprio = partida && (partida.categoria.clube_id === ctx.clubeId || partida.participantes.some(e => e.clube_id === ctx.clubeId));
    const response: ConflitoOrganizacao = { conflito: !!partida || !!proposta,
      mensagem: partida ? proprio ? 'Seu clube já tem uma partida nesta categoria e horário.' : 'O adversário já tem um compromisso nesta categoria e horário.' : proposta ? 'Já existe uma proposta pendente para este confronto e horário.' : 'Nenhum conflito encontrado neste horário.',
      partidaId: proprio ? partida.id : null, propostaId: !partida ? proposta?.id || null : null };
    res.json(response);
  }));
  return router;
}
