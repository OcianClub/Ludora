import { Router, type Response } from 'express';
import type { Prisma } from '@prisma/client';
import { salvarAluno, ErroElenco, categoriaCalculada, atualizarTemporada } from './elenco.service';
import { anoTemporada } from './elenco.rules';

import { prisma } from '../../lib/prisma';
import {
  exigirAcessoTotalCategorias,
  exigirGestorDoClube,
  exigirJogadorDoClube,
  exigirClubePublico,
  obterEscopoCategorias,
  obterEscopoCategoriasLeitura,
  podeAcessarCategoria,
} from '../../middlewares/permissoes.middleware';
import { limitarOperacaoPesada } from '../../middlewares/rate-limit.middleware';
import { idPositivo } from '../../utils/id';
import { consultarPerfis } from './perfis.service';
import { consultarContextoScout } from './contexto-scout.service';
import { contarParticipacoes } from './participacoes';

const router = Router();

// ==========================================
// JOGADORES
// ==========================================

function responderErro(res: Response, erro: unknown) {
  if (erro instanceof ErroElenco) return res.status(erro.status).json({ error: erro.message, ...erro.detalhes });
  console.error('Falha na operação do elenco');
  return res.status(500).json({ error: 'Não foi possível salvar o elenco. Tente novamente.' });
}

router.get('/jogadores/categoria', exigirGestorDoClube, async (req, res) => {
  try {
    const categoria = await categoriaCalculada(prisma, (req as any).clubeId, String(req.query.nascimento ?? ''));
    if (!(await podeAcessarCategoria((req as any).usuarioId, (req as any).clubeId, categoria.id))) {
      return res.status(403).json({ error: 'Você não pode administrar esta categoria.' });
    }
    res.json({ categoria, temporada: anoTemporada() });
  } catch (erro) { responderErro(res, erro); }
});

router.post('/jogadores', exigirGestorDoClube, async (req, res) => {
  try { const { cpf: _private, ...player } = await salvarAluno((req as any).clubeId, (req as any).usuarioId, req.body); res.status(201).json(player); }
  catch (erro) { responderErro(res, erro); }
});

router.get('/jogadores/perfis', exigirClubePublico, async (req, res) => {
  const clube_id = (req as any).clubeId as number;
  const usuario_id = (req as any).usuarioId as number;
  const categoriaInformada = req.query.categoria_id !== undefined;
  const categoria_id = categoriaInformada ? idPositivo(req.query.categoria_id) : null;
  if (categoriaInformada && !categoria_id) {
    return res.status(400).json({ error: 'Categoria inválida' });
  }

  try {
    const escopo = await obterEscopoCategoriasLeitura(usuario_id, clube_id);
    if (categoria_id && !escopo.acessoTotal && !escopo.categoriaIds.includes(categoria_id)) {
      return res.status(403).json({ error: 'Você não administra a categoria solicitada' });
    }
    const formatados = await prisma.$transaction(tx => consultarPerfis(tx, {
        ativo: true,
        categoria: { clube_id },
        ...(categoria_id
          ? { categoria_id }
          : escopo.acessoTotal
            ? {}
            : { categoria_id: { in: escopo.categoriaIds } }),
    }), { isolationLevel: 'RepeatableRead' });
    res.json(formatados);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar perfis' });
  }
});

router.get('/jogadores/:id/scout-contexto', exigirClubePublico, async (req, res) => {
  const jogadorId = idPositivo(req.params.id);
  if (!jogadorId) return res.status(400).json({ error: 'Atleta inválido.' });
  const clubeId = (req as any).clubeId as number;
  try {
    const escopo = await obterEscopoCategoriasLeitura(
      (req as any).usuarioId,
      clubeId
    );
    const contexto = await prisma.$transaction(
      (tx) => consultarContextoScout(
        tx,
        jogadorId,
        clubeId,
        escopo.acessoTotal ? null : escopo.categoriaIds
      ),
      { isolationLevel: 'RepeatableRead' }
    );
    if (!contexto) {
      return res.status(404).json({
        error: 'Atleta não encontrado neste clube ou nas categorias permitidas.',
      });
    }
    res.json(contexto);
  } catch {
    res.status(500).json({ error: 'Não foi possível carregar o histórico do atleta.' });
  }
});

router.get('/jogadores', exigirClubePublico, async (req, res) => {
  const clube_id = (req as any).clubeId as number;

  try {
    const escopo = await obterEscopoCategoriasLeitura((req as any).usuarioId, clube_id);
    const category = req.query.categoria_id === undefined ? null : idPositivo(req.query.categoria_id);
    const limit = req.query.limite === undefined ? null : idPositivo(req.query.limite);
    if (req.query.categoria_id !== undefined && !category || req.query.limite !== undefined && (!limit || limit > 100)) return res.status(400).json({ error: 'Categoria ou limite inválido (máximo 100).' });
    if (category && !escopo.acessoTotal && !escopo.categoriaIds.includes(category)) return res.status(403).json({ error: 'Categoria fora do seu acesso.' });
    const search = typeof req.query.busca === 'string' ? req.query.busca.trim().slice(0, 160) : '';
    const position = typeof req.query.posicao === 'string' ? req.query.posicao : '';
    if (position && !['Goleiro', 'Fixo', 'Pivô', 'Alas'].includes(position)) return res.status(400).json({ error: 'Posição inválida.' });
    const phase = req.query.fase;
    if (phase !== undefined && phase !== 'INICIACAO' && phase !== 'BASE') return res.status(400).json({ error: 'Grupo de categorias inválido.' });
    const where: Prisma.JogadorWhereInput = {
      ativo: true, categoria: { clube_id, ...(phase ? { tipo: phase } : {}) },
      ...(category ? { categoria_id: category } : escopo.acessoTotal ? {} : { categoria_id: { in: escopo.categoriaIds } }),
      ...(search ? { nome: { contains: search, mode: 'insensitive' } } : {}),
      ...(position ? { posicao: position === 'Alas' ? { startsWith: 'ala', mode: 'insensitive' } : { equals: position, mode: 'insensitive' } } : {}),
      ...(req.query.camisa === 'missing' ? { numCamisa: null } : req.query.camisa === 'assigned' ? { numCamisa: { not: null } } : {}),
    };
    if (req.query.resumo === 'true') {
      const groups = await prisma.jogador.groupBy({ by: ['categoria_id'], where, _count: { _all: true, numCamisa: true } });
      return res.json(groups.map(group => ({ categoria_id: group.categoria_id, total: group._count._all, semCamisa: group._count._all - group._count.numCamisa })));
    }
    const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) return res.status(400).json({ error: 'Página inválida.' });
    const sortBy = req.query.ordenar_por ?? 'nome';
    if (typeof sortBy !== 'string' || !['nome', 'camisa', 'posicao', 'idade', 'categoria'].includes(sortBy)) return res.status(400).json({ error: 'Ordenação inválida.' });
    const direction = req.query.ordem === 'desc' ? 'desc' : 'asc';
    const primaryOrder: Prisma.JogadorOrderByWithRelationInput[] =
      sortBy === 'camisa' ? [{ numCamisa: { sort: direction, nulls: 'last' } }] :
      sortBy === 'posicao' ? [{ posicao: direction }] :
      sortBy === 'idade' ? [{ dtNasc: direction === 'asc' ? 'desc' : 'asc' }] :
      sortBy === 'categoria' ? [{ categoria: { faixaIdade: direction } }, { categoria: { nome: direction } }] :
      [{ nome: direction }];
    const jogadores = await prisma.jogador.findMany({
      where,
      orderBy: [...primaryOrder, ...(sortBy === 'nome' ? [] : [{ nome: 'asc' as const }]), { id: 'asc' }],
      ...(limit ? { take: limit, skip: offset } : {}),
      select: {
        id: true,
        nome: true,
        dtNasc: true,
        posicao: true,
        numCamisa: true,
        categoria_id: true,
        ativo: true,
      },
    });
    const participations = await contarParticipacoes(prisma, jogadores.map(player => player.id), clube_id);
    res.json(jogadores.map(player => ({ ...player, totalPartidas: participations.get(player.id) ?? 0 })));
  } catch (error: any) { res.status(500).json({ error: 'Erro ao buscar jogadores' }); }
});

router.patch('/jogadores/:id', exigirGestorDoClube, exigirJogadorDoClube, async (req, res) => {
  const id = idPositivo(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  try { const { cpf: _private, ...player } = await salvarAluno((req as any).clubeId, (req as any).usuarioId, req.body, id); res.json(player); }
  catch (erro) { responderErro(res, erro); }
});

router.delete('/jogadores/:id', exigirGestorDoClube, exigirJogadorDoClube, async (req, res) => {
  try {
    await prisma.jogador.delete({ where: { id: Number(req.params.id) } });
    res.json({ mensagem: 'Excluído com sucesso' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// ADMIN
// ==========================================

router.patch('/admin/atualizar-idades', exigirGestorDoClube, exigirAcessoTotalCategorias, limitarOperacaoPesada, async (req, res) => {
  try { res.json(await atualizarTemporada((req as any).clubeId)); }
  catch (erro) { responderErro(res, erro); }
});

export default router;
