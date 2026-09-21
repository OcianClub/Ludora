import { Router } from 'express';

import { prisma } from '../../lib/prisma';
import {
  exigirAcessoTotalCategorias,
  exigirGestorDoClube,
  exigirJogadorDoClube,
  exigirMembroDoClube,
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

router.post('/jogadores', exigirGestorDoClube, async (req, res) => {
  const clube_id = (req as any).clubeId as number;
  const usuario_id = (req as any).usuarioId as number;

  const { nome, cpf, dtNasc, posicao, numCamisa } = req.body;
  if (!nome || !cpf || !dtNasc) return res.status(400).json({ error: 'Nome, CPF e data de nascimento obrigatórios' });
  try {
    const cpfExistente = await prisma.jogador.findUnique({ where: { cpf } });
    if (cpfExistente) return res.status(409).json({ error: 'Este CPF já está cadastrado' });

    const anoNasc = new Date(dtNasc).getFullYear();
    const idade = new Date().getFullYear() - anoNasc;
    const regrasCategorias = [
      { limite: 7,  nome: 'sub-7'  }, { limite: 8,  nome: 'sub-8'  },
      { limite: 9,  nome: 'sub-9'  }, { limite: 10, nome: 'sub-10' },
      { limite: 12, nome: 'sub-12' }, { limite: 14, nome: 'sub-14' },
      { limite: 16, nome: 'sub-16' }, { limite: 18, nome: 'sub-18' },
    ];
    const categoriaAdequada = regrasCategorias.find(r => idade <= r.limite);
    if (!categoriaAdequada) return res.status(403).json({ error: 'Idade fora das categorias permitidas.' });

    const categoria = await prisma.categoria.findFirst({
      where: { nome: categoriaAdequada.nome, clube_id }
    });
    
    if (!categoria) {
      return res.status(404).json({
        error: `Categoria ${categoriaAdequada.nome} não encontrada no banco do clube.`,
      });
    }

    const temAcessoCategoria = await podeAcessarCategoria(
      usuario_id,
      clube_id,
      categoria.id
    );

    if (!temAcessoCategoria) {
      return res.status(403).json({
        error: `Você não tem permissão para administrar a categoria ${categoria.nome}.`,
      });
    }

    if (numCamisa) {
      const camisaEmUso = await prisma.jogador.findFirst({
        where: { categoria_id: categoria.id, numCamisa: Number(numCamisa) }
      });
      if (camisaEmUso) return res.status(409).json({ error: `A camisa ${numCamisa} já está sendo usada na categoria.` });
    }

    const jogador = await prisma.jogador.create({
      data: {
        nome, cpf, dtNasc: new Date(dtNasc),
        posicao: posicao || 'Ala',
        numCamisa: numCamisa ? Number(numCamisa) : null,
        categoria_id: categoria.id,
        perfil_ml: 'Sem dados',
      },
      include: { categoria: true }
    });
    res.status(201).json(jogador);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/jogadores/perfis', exigirMembroDoClube, async (req, res) => {
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

router.get('/jogadores', exigirMembroDoClube, async (req, res) => {
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
  const clube_id = (req as any).clubeId as number;
  const usuario_id = (req as any).usuarioId as number;
  const { nome, dtNasc, posicao, numCamisa } = req.body;
  try {
    let dados: any = { nome, posicao, numCamisa: numCamisa ? Number(numCamisa) : null };
    if (dtNasc) {
      const anoNasc = new Date(dtNasc).getFullYear();
      const idade = new Date().getFullYear() - anoNasc;
      const regras = [
        { limite: 7,  nome: 'sub-7'  }, { limite: 8,  nome: 'sub-8'  },
        { limite: 9,  nome: 'sub-9'  }, { limite: 10, nome: 'sub-10' },
        { limite: 12, nome: 'sub-12' }, { limite: 14, nome: 'sub-14' },
        { limite: 16, nome: 'sub-16' }, { limite: 18, nome: 'sub-18' },
      ];
      const catAdequada = regras.find(r => idade <= r.limite);
      if (catAdequada) {
        const cat = await prisma.categoria.findFirst({
          where: { nome: catAdequada.nome, clube_id }
        });
        if (cat) {
          if (!(await podeAcessarCategoria(usuario_id, clube_id, cat.id))) {
            return res.status(403).json({ error: `Você não administra a categoria ${cat.nome}` });
          }
          dados.dtNasc = new Date(dtNasc);
          dados.categoria_id = cat.id;
        }
      }
    }
    const jogador = await prisma.jogador.update({
      where: { id: Number(req.params.id) },
      data: dados,
      include: { categoria: true },
    });
    res.json(jogador);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
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
  const clube_id = (req as any).clubeId as number;

  try {
    const anoAtual = new Date().getFullYear();
    const regras = [
      { limite: 7,  nome: 'sub-7'  }, { limite: 8,  nome: 'sub-8'  },
      { limite: 9,  nome: 'sub-9'  }, { limite: 10, nome: 'sub-10' },
      { limite: 12, nome: 'sub-12' }, { limite: 14, nome: 'sub-14' },
      { limite: 16, nome: 'sub-16' }, { limite: 18, nome: 'sub-18' },
    ];
    const [jogadores, categorias] = await Promise.all([
      prisma.jogador.findMany({ 
        where: { categoria: { clube_id } },
        select: { id: true, dtNasc: true, categoria_id: true, ativo: true } 
      }),
      prisma.categoria.findMany({ where: { clube_id } }),
    ]);
    
    let atualizados = 0, desativados = 0;
    for (const j of jogadores) {
      const idade = anoAtual - new Date(j.dtNasc).getFullYear();
      const catAdequada = regras.find(r => idade <= r.limite);
      if (!catAdequada) {
        if (j.ativo) { await prisma.jogador.update({ where: { id: j.id }, data: { ativo: false } }); desativados++; }
      } else {
        const cat = categorias.find(c => c.nome.toLowerCase() === catAdequada.nome.toLowerCase());
        if (cat && (cat.id !== j.categoria_id || !j.ativo)) {
          await prisma.jogador.update({ where: { id: j.id }, data: { categoria_id: cat.id, ativo: true } });
          atualizados++;
        }
      }
    }
    res.json({ ok: true, atualizados, desativados, total: jogadores.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


export default router;
