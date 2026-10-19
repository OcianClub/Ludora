import { Router, type Response } from 'express';
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
  try { res.status(201).json(await salvarAluno((req as any).clubeId, (req as any).usuarioId, req.body)); }
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
    const jogadores = await prisma.jogador.findMany({
      where: {
        ativo: true,
        categoria: { clube_id },
        ...(categoria_id
          ? { categoria_id }
          : escopo.acessoTotal
            ? {}
            : { categoria_id: { in: escopo.categoriaIds } }),
      },
      include: { eventos: true, categoria: true, escalacoes: true },
      orderBy: { nota_geral: 'desc' },
    });
    
    const formatados = jogadores.map(j => {
      const stats = j.eventos.reduce((acc: any, ev) => {
        acc[ev.tipo] = (acc[ev.tipo] || 0) + 1;
        return acc;
      }, {});
      const jogos = j.escalacoes ? j.escalacoes.length : 0;
      return {
        id_jogador:        j.id,
        nome:              j.nome,
        posicao:           j.posicao,
        numCamisa:         j.numCamisa,
        idade:             new Date().getFullYear() - new Date(j.dtNasc).getFullYear(),
        perfil_ml:         j.perfil_ml || 'Sem dados',
        scores_ml:         j.scores_ml,
        nota_geral:        j.nota_geral ?? 0,
        categoria:         j.categoria.nome,
        categoria_tipo:    j.categoria.tipo,
        categoria_id:      j.categoria_id,
        time:              'Clube', // Pode ser ajustado futuramente para buscar o nome do clube
        jogos_disputados:  jogos,
        gols:              stats['GOL']             || 0,
        assistencias:      stats['ASSISTENCIA']     || 0,
        defesas:           stats['DEFESA']          || 0,
        cartoes_amarelos:  stats['CARTAO_AMARELO']  || 0,
        cartoes_vermelhos: stats['CARTAO_VERMELHO'] || 0,
        faltas_cometidas:  stats['FALTA']           || 0,
      };
    });
    res.json(formatados);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar perfis' });
  }
});

router.get('/jogadores', exigirClubePublico, async (req, res) => {
  const clube_id = (req as any).clubeId as number;

  try {
    const escopo = await obterEscopoCategoriasLeitura((req as any).usuarioId, clube_id);
    const jogadores = await prisma.jogador.findMany({
      where: { 
        ativo: true,
        categoria: { clube_id },
        ...(escopo.acessoTotal ? {} : { categoria_id: { in: escopo.categoriaIds } }),
      },
      orderBy: { nome: 'asc' },
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
    res.json(jogadores);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao buscar jogadores' }); }
});

router.patch('/jogadores/:id', exigirGestorDoClube, exigirJogadorDoClube, async (req, res) => {
  const id = idPositivo(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  try { res.json(await salvarAluno((req as any).clubeId, (req as any).usuarioId, req.body, id)); }
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
