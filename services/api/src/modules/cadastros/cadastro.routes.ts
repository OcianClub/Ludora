import { Router } from 'express';

import { prisma } from '../../lib/prisma';
import {
  exigirAcessoTotalCategorias,
  exigirCompeticaoDoClube,
  exigirGestorDoClube,
  exigirMembroDoClube,
  exigirTimeDoClube,
  obterEscopoCategorias,
  obterEscopoCategoriasLeitura,
  podeAcessarCategoria,
} from '../../middlewares/permissoes.middleware';
import { idPositivo } from '../../utils/id';

const router = Router();

// ==========================================
// 2. CADASTROS E BUSCAS
// ==========================================

router.post('/times', exigirGestorDoClube, async (req, res) => {
  const { nome, escudo, categoria_id } = req.body;
  try {
    const categoriaId = idPositivo(categoria_id);
    if (!categoriaId) return res.status(400).json({ error: 'Categoria inválida' });
    const categoriaValida = await prisma.categoria.count({
      where: { id: categoriaId, clube_id: (req as any).clubeId },
    });
    if (!categoriaValida) return res.status(403).json({ error: 'Categoria não pertence ao clube ativo' });
    if (!(await podeAcessarCategoria((req as any).usuarioId, (req as any).clubeId, categoriaId))) {
      return res.status(403).json({ error: 'Você não administra esta categoria' });
    }
    const time = await prisma.time.create({
      data: { nome, escudo, categoria_id: categoriaId },
      include: { categoria: true }
    });
    res.status(201).json(time);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao criar time' }); }
});

router.patch('/times/:id', exigirGestorDoClube, exigirTimeDoClube, async (req, res) => {
  const { nome, escudo, categoria_id } = req.body;
  try {
    const categoriaId = idPositivo(categoria_id);
    if (!categoriaId) return res.status(400).json({ error: 'Categoria inválida' });
    const categoriaValida = await prisma.categoria.count({
      where: { id: categoriaId, clube_id: (req as any).clubeId },
    });
    if (!categoriaValida) return res.status(403).json({ error: 'Categoria não pertence ao clube ativo' });
    if (!(await podeAcessarCategoria((req as any).usuarioId, (req as any).clubeId, categoriaId))) {
      return res.status(403).json({ error: 'Você não administra a categoria de destino' });
    }
    const time = await prisma.time.update({
      where: { id: Number(req.params.id) },
      data: { nome, escudo, categoria_id: categoriaId },
      include: { categoria: true }
    });
    res.json(time);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao atualizar time' }); }
});

router.get('/times', exigirMembroDoClube, async (req, res) => {
  const clube_id = (req as any).clubeId as number;
  try {
    const escopo = await obterEscopoCategoriasLeitura((req as any).usuarioId, clube_id);
    const times = await prisma.time.findMany({
      where: {
        categoria: {
          clube_id,
          ...(escopo.acessoTotal ? {} : { id: { in: escopo.categoriaIds } }),
        },
      },
      orderBy: { nome: 'asc' },
      include: { categoria: true }
    });
    res.json(times);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao buscar times' }); }
});

router.delete('/times/:id', exigirGestorDoClube, exigirTimeDoClube, async (req, res) => {
  try {
    await prisma.time.delete({ where: { id: Number(req.params.id) } });
    res.json({ mensagem: 'Time excluído' });
  } catch (error: any) {
    res.status(409).json({ error: 'Time possui partidas vinculadas e não pode ser excluído.' });
  }
});

router.post('/competicoes', exigirGestorDoClube, exigirAcessoTotalCategorias, async (req, res) => {
  const clube_id = (req as any).clubeId as number;

  const { nome, ano, tipo } = req.body;
  try {
    // RESOLVIDO: Passando o clube_id para a criação
    const competicao = await prisma.competicao.create({ 
      data: { nome, ano: Number(ano), tipo, clube_id } 
    });
    res.status(201).json(competicao);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao criar competição' }); }
});

router.patch('/competicoes/:id', exigirGestorDoClube, exigirAcessoTotalCategorias, exigirCompeticaoDoClube, async (req, res) => {
  const { nome, ano, tipo } = req.body;
  try {
    const competicao = await prisma.competicao.update({
      where: { id: Number(req.params.id) },
      data: { nome, ano: Number(ano), tipo },
    });
    res.json(competicao);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao atualizar competição' }); }
});

router.get('/competicoes', exigirMembroDoClube, async (req, res) => {
  const clube_id = (req as any).clubeId as number;
  try {
    const escopo = await obterEscopoCategoriasLeitura((req as any).usuarioId, clube_id);
    const competicoes = await prisma.competicao.findMany({ 
      where: {
        clube_id,
        ...(escopo.acessoTotal ? {} : {
          OR: [
            { categorias: { some: { id: { in: escopo.categoriaIds } } } },
            { partidas: { some: { categoria_id: { in: escopo.categoriaIds } } } },
            { jogadores_inscritos: { some: { jogador: { categoria_id: { in: escopo.categoriaIds } } } } },
          ],
        }),
      },
      orderBy: { nome: 'asc' } 
    });
    res.json(competicoes);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao buscar competições' }); }
});

router.delete('/competicoes/:id', exigirGestorDoClube, exigirAcessoTotalCategorias, exigirCompeticaoDoClube, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const totalPartidas = await prisma.partida.count({ where: { competicao_id: id } });
    if (totalPartidas > 0) {
      return res.status(409).json({
        error: `Não é possível excluir: este campeonato possui ${totalPartidas} partida(s) vinculada(s). Exclua as partidas primeiro.`
      });
    }
    await prisma.competicaoJogador.deleteMany({ where: { competicao_id: id } });
    await prisma.competicaoTime.deleteMany({ where: { competicao_id: id } });
    await prisma.competicao.delete({ where: { id } });
    res.json({ mensagem: 'Campeonato excluído com sucesso.' });
  } catch (error: any) { res.status(500).json({ error: 'Erro ao excluir campeonato.' }); }
});

router.get('/competicoes/:id/jogadores', exigirMembroDoClube, exigirCompeticaoDoClube, async (req, res) => {
  const competicao_id = Number(req.params.id);
  const categoria_id  = req.query.categoria_id ? Number(req.query.categoria_id) : undefined;
  try {
    const escopo = await obterEscopoCategoriasLeitura((req as any).usuarioId, (req as any).clubeId);
    if (categoria_id && !escopo.acessoTotal && !escopo.categoriaIds.includes(categoria_id)) {
      return res.status(403).json({ error: 'Você não administra a categoria solicitada' });
    }
    const where: any = { competicao_id };
    where.jogador = categoria_id
      ? { categoria_id }
      : escopo.acessoTotal
        ? { categoria: { clube_id: (req as any).clubeId } }
        : { categoria_id: { in: escopo.categoriaIds } };
    const inscricoes = await prisma.competicaoJogador.findMany({
      where,
      include: {
        jogador: { select: { id: true, nome: true, posicao: true, numCamisa: true, categoria_id: true } },
      },
      orderBy: { jogador: { numCamisa: 'asc' } },
    });
    res.json(inscricoes.map(i => ({
      id_jogador: i.jogador.id,
      nome:       i.jogador.nome,
      posicao:    i.jogador.posicao,
      numCamisa:  i.jogador.numCamisa,
    })));
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar elenco da competição' });
  }
});

router.put('/competicoes/:id/jogadores', exigirGestorDoClube, exigirCompeticaoDoClube, async (req, res) => {
  const competicao_id = Number(req.params.id);
  const { jogador_ids }: { jogador_ids: number[] } = req.body;
  if (!Array.isArray(jogador_ids)) return res.status(400).json({ error: 'jogador_ids deve ser um array' });
  try {
    const escopo = await obterEscopoCategorias((req as any).usuarioId, (req as any).clubeId);
    const idsValidos = [...new Set(jogador_ids.map(Number))]
      .filter((id) => Number.isSafeInteger(id) && id > 0);
    if (idsValidos.length !== jogador_ids.length || idsValidos.length > 200) {
      return res.status(400).json({ error: 'Lista de jogadores inválida ou muito grande' });
    }
    const jogadoresDoClube = await prisma.jogador.count({
      where: {
        id: { in: idsValidos },
        categoria: { clube_id: (req as any).clubeId },
        ...(escopo.acessoTotal ? {} : { categoria_id: { in: escopo.categoriaIds } }),
      },
    });
    if (jogadoresDoClube !== idsValidos.length) {
      return res.status(403).json({ error: 'Um ou mais jogadores não pertencem ao clube ativo' });
    }
    await prisma.$transaction([
      prisma.competicaoJogador.deleteMany({
        where: {
          competicao_id,
          ...(escopo.acessoTotal ? {} : {
            jogador: { categoria_id: { in: escopo.categoriaIds } },
          }),
        },
      }),
      prisma.competicaoJogador.createMany({
        data: idsValidos.map((jogador_id) => ({ competicao_id, jogador_id })),
        skipDuplicates: true,
      }),
    ]);
    res.json({ ok: true, total: idsValidos.length });
  } catch (error: any) {
    console.error('Erro ao salvar elenco:', error.message || error);
    res.status(500).json({ error: 'Erro ao salvar elenco da competição' });
  }
});

router.get('/categorias', exigirMembroDoClube, async (req, res) => {
  const usuario_id = (req as any).usuarioId as number;
  const clube_id = (req as any).clubeId as number;

  try {
    const escopo = await obterEscopoCategoriasLeitura(
      usuario_id,
      clube_id
    );

    const categorias = await prisma.categoria.findMany({
      where: {
        clube_id,
        ...(escopo.acessoTotal
          ? {}
          : {
              id: {
                in: escopo.categoriaIds,
              },
            }),
      },
      orderBy: {
        nome: 'asc',
      },
    });

    res.json(categorias);
  } catch (error: any) {
    console.error('Erro ao buscar categorias:', error);

    res.status(500).json({
      error: 'Erro ao buscar categorias',
    });
  }
});


export default router;
