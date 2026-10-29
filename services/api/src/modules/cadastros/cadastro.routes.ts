import { Router } from 'express';

import { prisma } from '../../lib/prisma';
import {
  exigirAcessoTotalCategorias,
  exigirCompeticaoDoClube,
  exigirClubePublico,
  exigirGestorDoClube,
  exigirTimeDoClube,
  obterEscopoCategorias,
  obterEscopoCategoriasLeitura,
  podeAcessarCategoria,
} from '../../middlewares/permissoes.middleware';
import { idPositivo } from '../../utils/id';
import { nomeBaseTime } from './time-identity';
import { chaveTime, resumirConfrontos } from './time-context';

const router = Router();

function timeError(message: string, status = 409) {
  return Object.assign(new Error(message), { status });
}

async function timesDoContexto(usuarioId: number, clubeId: number) {
  const escopo = await obterEscopoCategoriasLeitura(usuarioId, clubeId);
  return prisma.time.findMany({ where: { categoria: { clube_id: clubeId,
    ...(escopo.acessoTotal ? {} : { id: { in: escopo.categoriaIds } }) } }, include: { categoria: { select: { nome: true } } } });
}

async function timesCompartilhados(locais: Awaited<ReturnType<typeof timesDoContexto>>, clubeId: number) {
  const clubes = [...new Set(locais.map(time => time.clube_representado_id).filter((id): id is number => !!id))];
  if (!clubes.includes(clubeId)) return locais;
  const categorias = locais.flatMap(time => time.categoria ? [time.categoria.nome] : []);
  const externos = await prisma.time.findMany({
    where: {
      clube_representado_id: { in: clubes },
      categoria: { clube_id: { not: clubeId }, nome: { in: categorias, mode: 'insensitive' } },
      OR: [
        { partidas_mandante: { some: { visitante: { clube_representado_id: clubeId } } } },
        { partidas_visitante: { some: { mandante: { clube_representado_id: clubeId } } } },
        { clube_representado_id: clubeId },
      ],
    },
    include: { categoria: { select: { nome: true } } },
  });
  return [...locais, ...externos.map(time => ({ ...time,
    categoria_id: locais.find(local => local.categoria?.nome.toLocaleLowerCase('pt-BR') === time.categoria?.nome.toLocaleLowerCase('pt-BR'))?.categoria_id || time.categoria_id,
  }))];
}

function hoje() {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  return new Date(`${date}T00:00:00Z`);
}

router.get('/times/contexto', exigirClubePublico, async (req, res) => {
  try {
    const clubeId = (req as any).clubeId as number;
    const locais = await timesDoContexto((req as any).usuarioId, clubeId);
    const times = await timesCompartilhados(locais, clubeId);
    const ids = times.map(time => time.id);
    const own = times.filter(time => time.clube_representado_id === clubeId).map(time => time.id);
    const where = { mandante_id: { in: ids }, visitante_id: { in: ids }, OR: [
      { mandante_id: { in: own } }, { visitante_id: { in: own } },
    ] };
    const [resultados, proximas] = await Promise.all([
      prisma.partida.groupBy({ by: ['mandante_id', 'visitante_id', 'gols_mandante', 'gols_visitante'],
        where: { ...where, status: 'FINALIZADA' }, _count: { _all: true } }),
      prisma.partida.groupBy({ by: ['mandante_id', 'visitante_id', 'categoria_id'],
        where: { ...where, status: { in: ['AGENDADA', 'PREPARADA'] }, data: { gte: hoje() } }, _min: { data: true } }),
    ]);
    const locaisKeys = new Set(locais.map(chaveTime));
    res.json(resumirConfrontos(times, resultados, proximas, clubeId).filter(item => locaisKeys.has(item.key)));
  } catch {
    res.status(500).json({ error: 'Não foi possível carregar o retrospecto dos adversários.' });
  }
});

router.get('/times/:id/contexto', exigirClubePublico, async (req, res) => {
  try {
    const clubeId = (req as any).clubeId as number;
    const locais = await timesDoContexto((req as any).usuarioId, clubeId);
    const source = locais.find(time => time.id === Number(req.params.id));
    if (!source) return res.status(404).json({ error: 'Time não encontrado no clube ativo.' });
    const categoriaId = req.query.categoria_id ? idPositivo(req.query.categoria_id) : null;
    if (req.query.categoria_id && !categoriaId) return res.status(400).json({ error: 'Categoria inválida.' });
    if (categoriaId && !locais.some(time => time.categoria_id === categoriaId)) return res.status(403).json({ error: 'Categoria indisponível para seu acesso.' });
    const allTimes = await timesCompartilhados(locais, clubeId);
    const times = categoriaId ? allTimes.filter(time => time.categoria_id === categoriaId) : allTimes;
    const isOwn = source.clube_representado_id === clubeId;
    const ids = times.filter(time => isOwn ? time.clube_representado_id !== clubeId : chaveTime(time) === chaveTime(source)).map(time => time.id);
    const own = times.filter(time => time.clube_representado_id === clubeId).map(time => time.id);
    const where = { OR: [
      { mandante_id: { in: own }, visitante_id: { in: ids } },
      { mandante_id: { in: ids }, visitante_id: { in: own } },
    ] };
    const teamSelect = { id: true, nome: true, escudo: true, clube_representado_id: true,
      clubeRepresentado: { select: { id: true, nome: true, escudo: true } } } as const;
    const select = { id: true, data: true, horario: true, status: true, local: true, gols_mandante: true, gols_visitante: true,
      categoria: { select: { id: true, nome: true } }, mandante: { select: teamSelect }, visitante: { select: teamSelect } } as const;
    const [ultimas, proximas] = await Promise.all([
      prisma.partida.findMany({ where: { ...where, status: 'FINALIZADA' }, orderBy: [{ data: 'desc' }, { horario: 'desc' }, { id: 'desc' }], take: 5, select }),
      prisma.partida.findMany({ where: { ...where, status: { in: ['AGENDADA', 'PREPARADA'] }, data: { gte: hoje() } }, orderBy: [{ data: 'asc' }, { horario: 'asc' }, { id: 'asc' }], take: 3, select }),
    ]);
    res.json({ ultimas, proximas });
  } catch {
    res.status(500).json({ error: 'Não foi possível carregar os confrontos. Tente novamente.' });
  }
});

router.patch('/times/:id/nome', exigirGestorDoClube, exigirTimeDoClube, async (req, res) => {
  const nome = req.body?.nome;
  if (typeof nome !== 'string' || nome.trim().length < 2 || nome.length > 120) return res.status(400).json({ error: 'Informe um nome entre 2 e 120 caracteres.' });
  try {
    const resultado = await prisma.$transaction(async tx => {
      const times = await tx.time.findMany({ where: { categoria: { clube_id: (req as any).clubeId } }, include: { categoria: true } });
      const source = times.find(time => time.id === Number(req.params.id));
      if (!source) throw timeError('Time não encontrado.', 404);
      if (source.clube_representado_id && (source.clube_representado_id !== (req as any).clubeId || (req as any).papelUsuario !== 'ADMIN')) {
        throw timeError('Somente o administrador do próprio clube pode alterar o nome oficial.', 403);
      }
      const group = times.filter(time => chaveTime(time) === chaveTime(source));
      if (times.some(time => chaveTime(time) !== chaveTime(source) && nomeBaseTime(time.nome) === nomeBaseTime(nome))) {
        throw timeError('Já existe um time com este nome. Escolha outro nome para evitar duplicação.');
      }
      for (const time of group) {
        if (!time.categoria_id || !await podeAcessarCategoria((req as any).usuarioId, (req as any).clubeId, time.categoria_id)) {
          throw timeError('É necessário administrar todas as categorias deste time.', 403);
        }
      }
      if (source.clube_representado_id) await tx.clube.update({ where: { id: (req as any).clubeId }, data: { nome: nome.trim() } });
      const items = [];
      for (const time of group) {
        items.push(await tx.time.update({ where: { id: time.id }, data: { nome: `${nome.trim()} ${time.categoria?.nome || ''}`.trim() },
          include: { clubeRepresentado: { select: { id: true, nome: true, escudo: true } } } }));
      }
      return { items, clubeId: source.clube_representado_id, nome: nome.trim() };
    }, { isolationLevel: 'Serializable' });
    res.json(resultado);
  } catch (error: any) {
    res.status(error.status || 409).json({ error: error.status ? error.message : 'Não foi possível alterar o nome. Atualize os dados e tente novamente.' });
  }
});

router.patch('/times/:id/arquivo', exigirGestorDoClube, exigirTimeDoClube, async (req, res) => {
  if (typeof req.body?.arquivado !== 'boolean') return res.status(400).json({ error: 'Informe se o time deve ser arquivado.' });
  try {
    const ids = await prisma.$transaction(async tx => {
      const times = await tx.time.findMany({ where: { categoria: { clube_id: (req as any).clubeId } } });
      const source = times.find(time => time.id === Number(req.params.id));
      if (!source) throw timeError('Time não encontrado.', 404);
      if (source.clube_representado_id === (req as any).clubeId) throw timeError('O time do clube ativo não pode ser arquivado.', 403);
      const group = times.filter(time => chaveTime(time) === chaveTime(source));
      for (const time of group) {
        if (!time.categoria_id || !await podeAcessarCategoria((req as any).usuarioId, (req as any).clubeId, time.categoria_id)) {
          throw timeError('É necessário administrar todas as categorias deste time.', 403);
        }
      }
      const ids = group.map(time => time.id);
      await tx.time.updateMany({ where: { id: { in: ids } }, data: { arquivado: req.body.arquivado } });
      return ids;
    }, { isolationLevel: 'Serializable' });
    res.json({ ids, arquivado: req.body.arquivado });
  } catch (error: any) {
    res.status(error.status || 409).json({ error: error.status ? error.message : 'Não foi possível alterar o arquivamento. Tente novamente.' });
  }
});

router.patch('/times/:id/escudo', exigirGestorDoClube, exigirTimeDoClube, async (req, res) => {
  const escudo = req.body?.escudo;
  if (typeof escudo !== 'string' || escudo.length > 2048) {
    return res.status(400).json({ error: 'Informe uma URL de escudo válida.' });
  }
  if (escudo.trim()) {
    try {
      if (!['https:', 'http:'].includes(new URL(escudo.trim()).protocol)) throw new Error();
    } catch {
      return res.status(400).json({ error: 'Use um endereço iniciado por https:// ou http://.' });
    }
  }
  try {
    const resultado = await prisma.$transaction(async tx => {
      const todos = await tx.time.findMany({ where: { categoria: { clube_id: (req as any).clubeId } } });
      const origem = todos.find(time => time.id === Number(req.params.id));
      if (!origem) throw timeError('Time não encontrado.', 404);
      if (origem.clube_representado_id && origem.clube_representado_id !== (req as any).clubeId) {
        throw timeError('O escudo oficial deve ser alterado pelo clube vinculado.', 403);
      }
      if (origem.clube_representado_id && (req as any).papelUsuario !== 'ADMIN') {
        throw timeError('Somente o administrador pode alterar o escudo oficial do clube.', 403);
      }
      const grupo = todos.filter(time => origem.clube_representado_id
        ? time.clube_representado_id === origem.clube_representado_id
        : !time.clube_representado_id && nomeBaseTime(time.nome) === nomeBaseTime(origem.nome));
      for (const time of grupo) {
        if (!time.categoria_id || !await podeAcessarCategoria((req as any).usuarioId, (req as any).clubeId, time.categoria_id)) {
          throw timeError('É necessário administrar todas as categorias deste time para alterar seu escudo.', 403);
        }
      }
      const result = await tx.time.updateMany({
        where: { id: { in: grupo.map(time => time.id) }, clube_representado_id: origem.clube_representado_id, categoria: { clube_id: (req as any).clubeId } },
        data: { escudo: escudo.trim() || null },
      });
      if (result.count !== grupo.length) throw timeError('O cadastro mudou. Atualize a página e tente novamente.');
      if (origem.clube_representado_id) {
        await tx.clube.update({ where: { id: (req as any).clubeId }, data: { escudo: escudo.trim() || null } });
      }
      return { ids: grupo.map(time => time.id), clubeId: origem.clube_representado_id, escudo: escudo.trim() || null };
    }, { isolationLevel: 'Serializable' });
    res.json(resultado);
  } catch (error: any) {
    res.status(error.status || 409).json({ error: error.status ? error.message : 'Não foi possível atualizar o escudo. Atualize os dados e tente novamente.' });
  }
});

router.post('/times/:id/categorias', exigirGestorDoClube, exigirTimeDoClube, async (req, res) => {
  const categoriaId = idPositivo(req.body?.categoria_id);
  if (!categoriaId) return res.status(400).json({ error: 'Selecione uma categoria.' });
  try {
    const categoria = await prisma.categoria.findFirst({ where: { id: categoriaId, clube_id: (req as any).clubeId } });
    if (!categoria || !await podeAcessarCategoria((req as any).usuarioId, (req as any).clubeId, categoriaId)) {
      return res.status(403).json({ error: 'Você não administra esta categoria.' });
    }
    const result = await prisma.$transaction(async tx => {
      const todos = await tx.time.findMany({ where: { categoria: { clube_id: (req as any).clubeId } } });
      const origem = todos.find(time => time.id === Number(req.params.id));
      if (!origem) throw timeError('Time não encontrado.', 404);
      if (origem.arquivado) throw timeError('Restaure o time antes de adicionar uma categoria.');
      const grupo = todos.filter(time => origem.clube_representado_id
        ? time.clube_representado_id === origem.clube_representado_id
        : !time.clube_representado_id && nomeBaseTime(time.nome) === nomeBaseTime(origem.nome));
      if (grupo.some(time => time.categoria_id === categoriaId)) throw timeError('O time já possui esta categoria.');
      return tx.time.create({
        data: { nome: origem.nome.replace(/\s*[-–—·(]?\s*sub[\s-]*\d{1,2}\)?\s*$/i, '').trim() + ' ' + categoria.nome,
          escudo: origem.escudo, categoria_id: categoriaId, clube_representado_id: origem.clube_representado_id },
        include: { categoria: true, clubeRepresentado: { select: { id: true, nome: true, escudo: true } } },
      });
    }, { isolationLevel: 'Serializable' });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(error.status || 409).json({ error: error.status ? error.message : 'Não foi possível adicionar. Atualize os dados e confira se a categoria já existe.' });
  }
});

router.get('/times/:id/impacto', exigirGestorDoClube, exigirTimeDoClube, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [partidas, competicoes] = await Promise.all([
      prisma.partida.count({ where: { OR: [{ mandante_id: id }, { visitante_id: id }] } }),
      prisma.competicaoTime.count({ where: { time_id: id } }),
    ]);
    res.json({ partidas, competicoes });
  } catch {
    res.status(500).json({ error: 'Não foi possível consultar os vínculos desta categoria.' });
  }
});

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
      include: { categoria: true, clubeRepresentado: {select:{id:true,nome:true,escudo:true}} }
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
      include: { categoria: true, clubeRepresentado: {select:{id:true,nome:true,escudo:true}} }
    });
    res.json(time);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao atualizar time' }); }
});

router.get('/times', exigirClubePublico, async (req, res) => {
  const clube_id = (req as any).clubeId as number;
  try {
    const escopo = await obterEscopoCategoriasLeitura((req as any).usuarioId, clube_id);
    const times = await prisma.time.findMany({
      where: {
        ...(req.query.incluir_arquivados === 'true' ? {} : { arquivado: false }),
        categoria: {
          clube_id,
          ...(escopo.acessoTotal ? {} : { id: { in: escopo.categoriaIds } }),
        },
      },
      orderBy: { nome: 'asc' },
      include: { categoria: true, clubeRepresentado: {select:{id:true,nome:true,escudo:true}} }
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

router.get('/competicoes', exigirClubePublico, async (req, res) => {
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

router.get('/competicoes/:id/jogadores', exigirClubePublico, exigirCompeticaoDoClube, async (req, res) => {
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

router.get('/categorias', exigirClubePublico, async (req, res) => {
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
