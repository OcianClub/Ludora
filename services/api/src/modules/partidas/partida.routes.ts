import { Router } from 'express';
import type { Server } from 'socket.io';

import { prisma } from '../../lib/prisma';
import {
  exigirGestorDoClube,
  exigirJogadorDoClube,
  exigirPartidaDoClube,
  obterEscopoCategorias,
  podeAcessarCategoria,
} from '../../middlewares/permissoes.middleware';
import { processarMachineLearning } from '../../services/scout-ia.service';
import { idPositivo } from '../../utils/id';

export function criarPartidaRoutes(io: Server) {
  const router = Router();

// ==========================================
// 3. PARTIDAS E EVENTOS
// ==========================================

router.post('/partidas', exigirGestorDoClube, async (req, res) => {
  const { mandante_id, visitante_id, data, horario, local, emCasa, categoria_id, competicao_id, rodada, grupo } = req.body;
  try {
    const dataFormatada = data ? new Date(`${data}T00:00:00Z`) : new Date();
    const catId = idPositivo(categoria_id);
    const mandanteId = idPositivo(mandante_id);
    const visitanteId = idPositivo(visitante_id);
    const compId = competicao_id ? idPositivo(competicao_id) : null;
    if (!catId || !mandanteId || !visitanteId || mandanteId === visitanteId || (competicao_id && !compId)) {
      return res.status(400).json({ error: 'Dados da partida inválidos' });
    }
    if (Number.isNaN(dataFormatada.getTime())) return res.status(400).json({ error: 'Data inválida' });

    // Garante que a categoria escolhida pertence mesmo ao clube ativo
    // (evita criar partida "vazando" pra categoria de outro clube).
    const categoria = await prisma.categoria.findUnique({ where: { id: catId } });
    if (!categoria || categoria.clube_id !== (req as any).clubeId) {
      return res.status(403).json({ error: 'Categoria não pertence ao clube ativo' });
    }
    if (!(await podeAcessarCategoria((req as any).usuarioId, (req as any).clubeId, catId))) {
      return res.status(403).json({ error: 'Você não administra a categoria selecionada' });
    }
    const timesValidos = await prisma.time.count({
      where: { id: { in: [mandanteId, visitanteId] }, categoria_id: catId },
    });
    if (timesValidos !== 2) return res.status(403).json({ error: 'Times não pertencem à categoria selecionada' });
    if (compId) {
      const competicaoValida = await prisma.competicao.count({
        where: { id: compId, clube_id: (req as any).clubeId },
      });
      if (!competicaoValida) return res.status(403).json({ error: 'Competição não pertence ao clube ativo' });
    }

    if (horario) {
      const choqueHorario = await prisma.partida.findFirst({
        where: { categoria_id: catId, data: dataFormatada, horario }
      });
      if (choqueHorario) return res.status(400).json({ error: 'Conflito de agenda! A categoria já tem jogo neste horário.' });
    }

    const partida = await prisma.partida.create({
      data: {
        mandante_id: mandanteId, visitante_id: visitanteId,
        data: dataFormatada, horario, local,
        emCasa: emCasa !== undefined ? emCasa : true,
        categoria_id: catId, competicao_id: compId,
        rodada: rodada ? Number(rodada) : null, grupo, status: 'AGENDADA',
      },
      include: { mandante: true, visitante: true, categoria: true, competicao: true },
    });
    res.status(201).json(partida);
  } catch (error: any) {
    console.error('Erro ao criar partida:', error.message || error);
    res.status(500).json({ error: 'Erro ao criar partida' });
  }
});

router.get('/partidas', async (req, res) => {
  const clube_id = Number(req.headers['x-clube-id']);
  if (!clube_id) return res.status(400).json({ error: 'Header x-clube-id é obrigatório' });

  const { categoria_id, mes, status, competicao_id } = req.query;
  try {
    const where: any = { categoria: { clube_id } }; // Garante restrição do tenant
    if (categoria_id)  where.categoria_id  = Number(categoria_id);
    if (status)        where.status        = status;
    if (competicao_id) where.competicao_id = Number(competicao_id);
    if (mes) {
      const ano    = new Date().getFullYear();
      const mesNum = Number(mes);
      const dataInicio = new Date(Date.UTC(ano, mesNum - 1, 1));
      const dataFim    = new Date(Date.UTC(ano, mesNum, 1));
      where.data = { gte: dataInicio, lt: dataFim };
    }
    const partidas = await prisma.partida.findMany({
      where,
      orderBy: { data: 'asc' },
      include: {
        mandante: true,
        visitante: true,
        categoria: true,
        competicao: true,
        eventos: true,
      },
    });
    res.json(partidas);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao buscar partidas' }); }
});

router.patch<{ id: string }>(
  '/partidas/:id',
  exigirGestorDoClube,
  exigirPartidaDoClube((req) => Number(req.params.id)),
  async (req, res) => {
    const { mandante_id, visitante_id, data, horario, local, emCasa, rodada, grupo, categoria_id } = req.body;
    try {
      const atual = await prisma.partida.findUnique({
        where: { id: Number(req.params.id) },
        select: { mandante_id: true, visitante_id: true, categoria_id: true },
      });
      if (!atual) return res.status(404).json({ error: 'Partida não encontrada' });
      const categoriaId = categoria_id ? idPositivo(categoria_id) : atual.categoria_id;
      const mandanteId = mandante_id ? idPositivo(mandante_id) : atual.mandante_id;
      const visitanteId = visitante_id ? idPositivo(visitante_id) : atual.visitante_id;
      if (!categoriaId || !mandanteId || !visitanteId || mandanteId === visitanteId) {
        return res.status(400).json({ error: 'Dados da partida inválidos' });
      }
      const [categoriaValida, timesValidos] = await Promise.all([
        prisma.categoria.count({ where: { id: categoriaId, clube_id: (req as any).clubeId } }),
        prisma.time.count({ where: { id: { in: [mandanteId, visitanteId] }, categoria_id: categoriaId } }),
      ]);
      if (!categoriaValida || timesValidos !== 2) {
        return res.status(403).json({ error: 'Categoria ou times não pertencem ao clube ativo' });
      }
      if (!(await podeAcessarCategoria((req as any).usuarioId, (req as any).clubeId, categoriaId))) {
        return res.status(403).json({ error: 'Você não administra a categoria de destino' });
      }
      const dataAtualizada = data ? new Date(`${data}T00:00:00Z`) : undefined;
      if (dataAtualizada && Number.isNaN(dataAtualizada.getTime())) {
        return res.status(400).json({ error: 'Data inválida' });
      }
      const partida = await prisma.partida.update({
        where: { id: Number(req.params.id) },
        data: {
          mandante_id: mandante_id ? mandanteId : undefined,
          visitante_id: visitante_id ? visitanteId : undefined,
          data: dataAtualizada,
          horario, local, emCasa,
          rodada:       rodada     ? Number(rodada)     : undefined,
          grupo:        grupo ?? null,
          categoria_id: categoria_id ? categoriaId : undefined,
        },
        include: { mandante: true, visitante: true, categoria: true },
      });
      res.json(partida);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }
);

router.delete<{ id: string }>(
  '/partidas/:id',
  exigirGestorDoClube,
  exigirPartidaDoClube((req) => Number(req.params.id)),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      await prisma.evento.deleteMany({ where: { partida_id: id } });
      await prisma.escalacaoPartida.deleteMany({ where: { partida_id: id } });
      await prisma.partida.delete({ where: { id } });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message ?? 'Erro ao excluir partida' });
    }
  }
);

router.patch<{ id: string }>(
  '/partidas/:id/placar',
  exigirGestorDoClube,
  exigirPartidaDoClube((req) => Number(req.params.id)),
  async (req, res) => {
    const { gols_mandante, gols_visitante } = req.body;
    const golsMandante = Number(gols_mandante);
    const golsVisitante = Number(gols_visitante);
    if (![golsMandante, golsVisitante].every((gols) => Number.isSafeInteger(gols) && gols >= 0 && gols <= 99)) {
      return res.status(400).json({ error: 'Placar inválido' });
    }
    try {
      const partida = await prisma.partida.update({
        where: { id: Number(req.params.id) },
        data: { gols_mandante: golsMandante, gols_visitante: golsVisitante },
      });
      io.to(`clube:${(req as any).clubeId}`).emit('placar_atualizado', partida);
      res.json(partida);
    } catch (error: any) { res.status(500).json({ error: 'Erro ao atualizar placar' }); }
  }
);

router.patch<{ id: string }>(
  '/partidas/:id/status',
  exigirGestorDoClube,
  exigirPartidaDoClube((req) => Number(req.params.id)),
  async (req, res) => {
    const partidaId = Number(req.params.id);
    const { status } = req.body;
    if (!['AGENDADA', 'PREPARADA', 'AO_VIVO', 'FINALIZADA', 'CANCELADA'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }
    try {
      const partida = await prisma.partida.update({ where: { id: partidaId }, data: { status } });
      if (status === 'FINALIZADA') {
        const clubeId = (req as any).clubeId as number;
        setImmediate(() => {
          processarMachineLearning(clubeId).catch(err => console.error('Erro na IA:', err));
        });
      }
      res.json(partida);
    } catch (error: any) { res.status(500).json({ error: 'Erro ao atualizar status' }); }
  }
);

router.get('/jogadores/:id/estatisticas', exigirGestorDoClube, exigirJogadorDoClube, async (req, res) => {
  const jogadorId = Number(req.params.id);
  const estatisticas = await prisma.evento.groupBy({
    by: ['tipo'],
    where: { jogador_id: jogadorId },
    _count: { tipo: true }
  });
  const formatado = estatisticas.reduce((acc: any, curr: any) => {
    acc[curr.tipo] = curr._count.tipo;
    return acc;
  }, {});
  res.json({ jogador_id: jogadorId, estatisticas: formatado });
});

router.post<{ id: string }>(
  '/partidas/:id/eventos',
  exigirGestorDoClube,
  exigirPartidaDoClube((req) => Number(req.params.id)),
  async (req, res) => {
    const partidaId = Number(req.params.id);
    // RESOLVIDO: Removendo o doOcian do payload, ele não existe mais!
    const { jogador_id, tipo, minuto, periodo } = req.body;
    const tiposPermitidos = ['GOL', 'ASSISTENCIA', 'DEFESA', 'CARTAO_AMARELO', 'CARTAO_VERMELHO', 'FALTA'];
    if (!tiposPermitidos.includes(tipo)) return res.status(400).json({ error: 'Tipo de evento inválido' });
    const minutoNumero = minuto == null ? null : Number(minuto);
    const periodoNumero = periodo == null ? 1 : Number(periodo);
    if ((minutoNumero != null && (!Number.isSafeInteger(minutoNumero) || minutoNumero < 0 || minutoNumero > 200)) ||
        !Number.isSafeInteger(periodoNumero) || periodoNumero < 1 || periodoNumero > 10) {
      return res.status(400).json({ error: 'Minuto ou período inválido' });
    }
    try {
      const partida = await prisma.partida.findUnique({
        where: { id: partidaId },
        select: { categoria_id: true },
      });
      if (!partida) return res.status(404).json({ error: 'Partida não encontrada' });
      if (jogador_id) {
        const jogadorValido = await prisma.jogador.count({
          where: { id: Number(jogador_id), categoria_id: partida.categoria_id },
        });
        if (!jogadorValido) return res.status(403).json({ error: 'Jogador não pertence à categoria da partida' });
      }
      const evento = await prisma.evento.create({
        data: {
          partida_id: partidaId,
          jogador_id: jogador_id ? Number(jogador_id) : null,
          tipo,
          minuto: minutoNumero,
          periodo: periodoNumero,
        },
      });

      let nomeJogador = 'Adversário';
      if (evento.jogador_id) {
        const jog = await prisma.jogador.findUnique({
          where: { id: evento.jogador_id },
          select: { nome: true },
        });
        nomeJogador = jog?.nome ?? 'Adversário';
      }

      io.to(`clube:${(req as any).clubeId}`).emit('evento_partida', {
        tipo:       evento.tipo,
        jogador:    nomeJogador,
        minuto:     evento.minuto,
        partida_id: partidaId,
      });

      res.status(201).json({ ...evento, jogador: nomeJogador ? { nome: nomeJogador } : null });
    } catch (error: any) { res.status(500).json({ error: 'Erro ao salvar evento' }); }
  }
);

router.get('/partidas/:id/eventos', async (req, res) => {
  try {
    const eventos = await prisma.evento.findMany({
      where: { partida_id: Number(req.params.id) },
      include: { jogador: true },
      orderBy: { id: 'asc' }
    });
    res.json(eventos);
  } catch (error: any) { res.status(500).json({ error: 'Erro ao buscar eventos' }); }
});

router.delete<{ id: string }>('/eventos/:id', exigirGestorDoClube, async (req, res) => {
  try {
    const evento = await prisma.evento.findUnique({
      where: { id: Number(req.params.id) },
      include: { partida: { select: { categoria_id: true, categoria: { select: { clube_id: true } } } } },
    });
    if (!evento) return res.status(404).json({ error: 'Evento não encontrado' });

    if (evento.partida.categoria.clube_id !== (req as any).clubeId) {
      return res.status(403).json({ error: 'Este evento não pertence ao clube ativo' });
    }
    if (!(await podeAcessarCategoria(
      (req as any).usuarioId,
      (req as any).clubeId,
      evento.partida.categoria_id,
    ))) {
      return res.status(403).json({ error: 'Você não administra a categoria deste evento' });
    }

    await prisma.evento.delete({ where: { id: Number(req.params.id) } });
    res.json({ mensagem: 'Evento deletado' });
  } catch (error: any) { res.status(500).json({ error: 'Erro ao deletar evento' }); }
});


  return router;
}
