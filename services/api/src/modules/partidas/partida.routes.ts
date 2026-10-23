import { Router } from 'express';
import type { Server } from 'socket.io';

import { prisma } from '../../lib/prisma';
import {
  exigirGestorDoClube,
  exigirClubePublico,
  exigirPartidaDoClube,
  exigirPartidaVisivelDoClube,
  obterEscopoCategorias,
  podeAcessarCategoria,
} from '../../middlewares/permissoes.middleware';
import { processarMachineLearning } from '../../services/scout-ia.service';
import { criarNotificacoesDoClube } from '../../services/notificacoes.service';
import { idPositivo } from '../../utils/id';
import { consultarListaPartidas } from './partidas-lista.service';
import { FiltroDataInvalido } from './filtros-data.utils';
import { consultarHome } from './home.service';
import { criarHomeRoutes } from './home.routes';
import { criarAgendaRoutes } from './agenda.routes';
import { consultarAgenda } from './agenda.service';
import { perspectivaPartida } from './visibilidade';
import {
  aplicarMudancaPlacar,
  ConflitoPartida,
  gravarEventoComPlacar,
  removerEventoComPlacar,
  mudancaGolValida,
  placarValido,
} from './placar.utils';

function formatarDataPartida(data: Date, horario: string | null) {
  const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(data);
  return horario ? `${dataFormatada} às ${horario}` : dataFormatada;
}

export function criarPartidaRoutes(io: Server) {
  const router = Router();
  router.use(criarHomeRoutes(exigirClubePublico, (clubeId, hoje) => consultarHome(prisma, clubeId, hoje)));
  router.use(criarAgendaRoutes(exigirClubePublico, (clubeId, filtros) => consultarAgenda(prisma, clubeId, filtros)));

  const notificarGol = async (
    clubeId: number,
    anterior: {
      emCasa: boolean;
      gols_mandante: number;
      gols_visitante: number;
    },
    partida: any
  ) => {
    const antes = anterior.emCasa
      ? anterior.gols_mandante
      : anterior.gols_visitante;
    const depois = partida.emCasa
      ? partida.gols_mandante
      : partida.gols_visitante;
    if (depois <= antes) return;
    const time = partida.emCasa ? partida.mandante : partida.visitante;
    try {
      await criarNotificacoesDoClube({
        io,
        clubeId,
        partidaId: partida.id,
        tipo: 'GOL_PARTIDA',
        titulo: `Gol do ${time.nome}!`,
        corpo: `Placar agora: ${partida.mandante.nome} ${partida.gols_mandante} x ${partida.gols_visitante} ${partida.visitante.nome}`,
        dados: { partidaId: partida.id, clubeId },
      });
    } catch {
      console.error('Não foi possível criar notificações de gol.');
    }
  };

  router.get(
    '/partidas/:id',
    exigirClubePublico,
    exigirPartidaVisivelDoClube((req) => Number(req.params.id)),
    async (req, res) => {
      const partida = await prisma.$transaction(
        (tx) =>
          tx.partida.findUnique({
            where: { id: Number(req.params.id) },
            include: {
              mandante: {include:{clubeRepresentado:{select:{nome:true,escudo:true}}}},
              visitante: {include:{clubeRepresentado:{select:{nome:true,escudo:true}}}},
              categoria: true,
              competicao: true,
              eventos: {
                include: { jogador: { select: { id: true, nome: true } } },
                orderBy: { id: 'asc' },
              },
            },
          }),
        { isolationLevel: 'RepeatableRead' }
      );
      if (!partida)
        return res.status(404).json({ error: 'Partida não encontrada' });
      return res.json(perspectivaPartida(partida, (req as any).clubeId));
    }
  );

  // ==========================================
  // 3. PARTIDAS E EVENTOS
  // ==========================================

  router.post('/partidas', exigirGestorDoClube, async (req, res) => {
    const {
      mandante_id,
      visitante_id,
      data,
      horario,
      local,
      emCasa,
      categoria_id,
      competicao_id,
      rodada,
      grupo,
    } = req.body;
    try {
      const dataFormatada = data ? new Date(`${data}T00:00:00Z`) : new Date();
      const catId = idPositivo(categoria_id);
      const mandanteId = idPositivo(mandante_id);
      const visitanteId = idPositivo(visitante_id);
      const compId = competicao_id ? idPositivo(competicao_id) : null;
      if (
        !catId ||
        !mandanteId ||
        !visitanteId ||
        mandanteId === visitanteId ||
        (competicao_id && !compId)
      ) {
        return res.status(400).json({ error: 'Dados da partida inválidos' });
      }
      if (Number.isNaN(dataFormatada.getTime()))
        return res.status(400).json({ error: 'Data inválida' });

      // Garante que a categoria escolhida pertence mesmo ao clube ativo
      // (evita criar partida "vazando" pra categoria de outro clube).
      const categoria = await prisma.categoria.findUnique({
        where: { id: catId },
      });
      if (!categoria || categoria.clube_id !== (req as any).clubeId) {
        return res
          .status(403)
          .json({ error: 'Categoria não pertence ao clube ativo' });
      }
      if (
        !(await podeAcessarCategoria(
          (req as any).usuarioId,
          (req as any).clubeId,
          catId
        ))
      ) {
        return res
          .status(403)
          .json({ error: 'Você não administra a categoria selecionada' });
      }
      const timesValidos = await prisma.time.count({
        where: { id: { in: [mandanteId, visitanteId] }, categoria_id: catId },
      });
      if (timesValidos !== 2)
        return res
          .status(403)
          .json({ error: 'Times não pertencem à categoria selecionada' });
      if (compId) {
        const competicaoValida = await prisma.competicao.count({
          where: { id: compId, clube_id: (req as any).clubeId },
        });
        if (!competicaoValida)
          return res
            .status(403)
            .json({ error: 'Competição não pertence ao clube ativo' });
      }

      if (horario) {
        const choqueHorario = await prisma.partida.findFirst({
          where: { categoria_id: catId, data: dataFormatada, horario },
        });
        if (choqueHorario)
          return res
            .status(400)
            .json({
              error:
                'Conflito de agenda! A categoria já tem jogo neste horário.',
            });
      }

      const partida = await prisma.partida.create({
        data: {
          mandante_id: mandanteId,
          visitante_id: visitanteId,
          data: dataFormatada,
          horario,
          local,
          emCasa: emCasa !== undefined ? emCasa : true,
          categoria_id: catId,
          competicao_id: compId,
          rodada: rodada ? Number(rodada) : null,
          grupo,
          status: 'AGENDADA',
        },
        include: {
          mandante: true,
          visitante: true,
          categoria: true,
          competicao: true,
        },
      });

      try {
        await criarNotificacoesDoClube({
          io,
          clubeId: (req as any).clubeId,
          partidaId: partida.id,
          tipo: 'PARTIDA_AGENDADA',
          titulo: 'Nova partida marcada',
          corpo: `${partida.mandante.nome} x ${partida.visitante.nome} · ${formatarDataPartida(partida.data, partida.horario)}`,
          dados: { partidaId: partida.id, clubeId: (req as any).clubeId },
        });
      } catch (erro) {
        console.error('Não foi possível criar notificações da partida:', erro);
      }

      res.status(201).json(partida);
    } catch (error: any) {
      console.error('Erro ao criar partida:', error.message || error);
      res.status(500).json({ error: 'Erro ao criar partida' });
    }
  });

  router.get('/partidas', exigirClubePublico, async (req, res) => {
    const clube_id = (req as any).clubeId as number;

    try {
      const partidas = await consultarListaPartidas(prisma, clube_id, req.query);
      res.json(partidas);
    } catch (error: any) {
      if (error instanceof FiltroDataInvalido) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Erro ao buscar partidas' });
    }
  });

  router.patch<{ id: string }>(
    '/partidas/:id',
    exigirGestorDoClube,
    exigirPartidaDoClube((req) => Number(req.params.id)),
    async (req, res) => {
      const {
        mandante_id,
        visitante_id,
        data,
        horario,
        local,
        emCasa,
        rodada,
        grupo,
        categoria_id,
      } = req.body;
      try {
        const atual = await prisma.partida.findUnique({
          where: { id: Number(req.params.id) },
          select: { mandante_id: true, visitante_id: true, categoria_id: true },
        });
        if (!atual)
          return res.status(404).json({ error: 'Partida não encontrada' });
        const categoriaId = categoria_id
          ? idPositivo(categoria_id)
          : atual.categoria_id;
        const mandanteId = mandante_id
          ? idPositivo(mandante_id)
          : atual.mandante_id;
        const visitanteId = visitante_id
          ? idPositivo(visitante_id)
          : atual.visitante_id;
        if (
          !categoriaId ||
          !mandanteId ||
          !visitanteId ||
          mandanteId === visitanteId
        ) {
          return res.status(400).json({ error: 'Dados da partida inválidos' });
        }
        const [categoriaValida, timesValidos] = await Promise.all([
          prisma.categoria.count({
            where: { id: categoriaId, clube_id: (req as any).clubeId },
          }),
          prisma.time.count({
            where: {
              id: { in: [mandanteId, visitanteId] },
              categoria_id: categoriaId,
            },
          }),
        ]);
        if (!categoriaValida || timesValidos !== 2) {
          return res
            .status(403)
            .json({ error: 'Categoria ou times não pertencem ao clube ativo' });
        }
        if (
          !(await podeAcessarCategoria(
            (req as any).usuarioId,
            (req as any).clubeId,
            categoriaId
          ))
        ) {
          return res
            .status(403)
            .json({ error: 'Você não administra a categoria de destino' });
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
            horario,
            local,
            emCasa,
            rodada: rodada ? Number(rodada) : undefined,
            grupo: grupo ?? null,
            categoria_id: categoria_id ? categoriaId : undefined,
          },
          include: { mandante: true, visitante: true, categoria: true },
        });
        io.to(`clube:${(req as any).clubeId}`).emit(
          'partida_atualizada',
          partida
        );
        res.json(partida);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
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
      if (
        ![golsMandante, golsVisitante].every(
          (gols) => Number.isSafeInteger(gols) && gols >= 0 && gols <= 99
        )
      ) {
        return res.status(400).json({ error: 'Placar inválido' });
      }
      if (req.body.anterior != null && !placarValido(req.body.anterior)) {
        return res.status(400).json({ error: 'Placar anterior inválido' });
      }
      try {
        const anterior = await prisma.partida.findUnique({
          where: { id: Number(req.params.id) },
          include: { mandante: true, visitante: true },
        });
        if (!anterior)
          return res.status(404).json({ error: 'Partida não encontrada' });

        const partida = await prisma.$transaction(async (tx) => {
          await aplicarMudancaPlacar(tx, anterior.id, {
            anterior: req.body.anterior ?? {
              gols_mandante: anterior.gols_mandante,
              gols_visitante: anterior.gols_visitante,
            },
            novo: {
              gols_mandante: golsMandante,
              gols_visitante: golsVisitante,
            },
          });
          return tx.partida.findUniqueOrThrow({
            where: { id: anterior.id },
            include: { mandante: true, visitante: true },
          });
        });
        io.to(`clube:${(req as any).clubeId}`).emit(
          'placar_atualizado',
          partida
        );
        await notificarGol((req as any).clubeId, anterior, partida);

        res.json(partida);
      } catch (error: any) {
        if (error instanceof ConflitoPartida)
          return res.status(409).json({ error: error.message });
        res.status(500).json({ error: 'Erro ao atualizar placar' });
      }
    }
  );

  router.patch<{ id: string }>(
    '/partidas/:id/status',
    exigirGestorDoClube,
    exigirPartidaDoClube((req) => Number(req.params.id)),
    async (req, res) => {
      const partidaId = Number(req.params.id);
      const { status } = req.body;
      if (
        ![
          'AGENDADA',
          'PREPARADA',
          'AO_VIVO',
          'FINALIZADA',
          'CANCELADA',
        ].includes(status)
      ) {
        return res.status(400).json({ error: 'Status inválido' });
      }
      if (
        req.body.status_anterior != null &&
        ![
          'AGENDADA',
          'PREPARADA',
          'AO_VIVO',
          'FINALIZADA',
          'CANCELADA',
        ].includes(req.body.status_anterior)
      ) {
        return res.status(400).json({ error: 'Status anterior inválido' });
      }
      try {
        const anterior = await prisma.partida.findUnique({
          where: { id: partidaId },
          select: { status: true },
        });
        if (!anterior)
          return res.status(404).json({ error: 'Partida não encontrada' });
        const partida = await prisma.$transaction(async (tx) => {
          const alteracao = await tx.partida.updateMany({
            where: {
              id: partidaId,
              status: req.body.status_anterior ?? anterior.status,
            },
            data: { status },
          });
          if (!alteracao.count)
            throw new ConflitoPartida(
              'O status da partida mudou. Atualize antes de continuar.'
            );
          return tx.partida.findUniqueOrThrow({
            where: { id: partidaId },
            include: { mandante: true, visitante: true },
          });
        });
        io.to(`clube:${(req as any).clubeId}`).emit(
          'partida_atualizada',
          partida
        );

        if (status === 'FINALIZADA' && anterior?.status !== 'FINALIZADA') {
          const clubeId = (req as any).clubeId as number;
          setImmediate(() => {
            processarMachineLearning(clubeId).catch((err) =>
              console.error('Erro na IA:', err)
            );
          });

          const golsDoClube = partida.emCasa
            ? partida.gols_mandante
            : partida.gols_visitante;
          const golsAdversario = partida.emCasa
            ? partida.gols_visitante
            : partida.gols_mandante;
          const resultado =
            golsDoClube > golsAdversario
              ? 'Vitória!'
              : golsDoClube < golsAdversario
                ? 'Partida finalizada'
                : 'Empate!';
          const resumo =
            golsDoClube > golsAdversario
              ? 'Seu time venceu a partida.'
              : golsDoClube < golsAdversario
                ? 'Seu time foi derrotado nesta partida.'
                : 'A partida terminou empatada.';

          try {
            await criarNotificacoesDoClube({
              io,
              clubeId,
              partidaId: partida.id,
              tipo: 'RESULTADO_PARTIDA',
              titulo: resultado,
              corpo: `${resumo} ${partida.mandante.nome} ${partida.gols_mandante} x ${partida.gols_visitante} ${partida.visitante.nome}`,
              dados: { partidaId: partida.id, clubeId },
            });
          } catch (erro) {
            console.error(
              'Não foi possível criar notificações de resultado:',
              erro
            );
          }
        }
        res.json(partida);
      } catch (error: any) {
        if (error instanceof ConflitoPartida)
          return res.status(409).json({ error: error.message });
        res.status(500).json({ error: 'Erro ao atualizar status' });
      }
    }
  );

  router.get(
    '/jogadores/:id/estatisticas',
    exigirClubePublico,
    async (req, res) => {
      const jogadorId = Number(req.params.id);
      const jogadorExiste = await prisma.jogador.count({
        where: {
          id: jogadorId,
          categoria: { clube_id: (req as any).clubeId },
        },
      });
      if (!jogadorExiste)
        return res
          .status(404)
          .json({ error: 'Jogador não encontrado neste clube' });
      const estatisticas = await prisma.evento.groupBy({
        by: ['tipo'],
        where: { jogador_id: jogadorId },
        _count: { tipo: true },
      });
      const formatado = estatisticas.reduce((acc: any, curr: any) => {
        acc[curr.tipo] = curr._count.tipo;
        return acc;
      }, {});
      res.json({ jogador_id: jogadorId, estatisticas: formatado });
    }
  );

  router.post<{ id: string }>(
    '/partidas/:id/eventos',
    exigirGestorDoClube,
    exigirPartidaDoClube((req) => Number(req.params.id)),
    async (req, res) => {
      const partidaId = Number(req.params.id);
      const { jogador_id, tipo, minuto, periodo } = req.body;
      const tiposPermitidos = [
        'GOL',
        'ASSISTENCIA',
        'DEFESA',
        'CARTAO_AMARELO',
        'CARTAO_VERMELHO',
        'CARTAO_AZUL',
        'FALTA',
      ];
      if (!tiposPermitidos.includes(tipo))
        return res.status(400).json({ error: 'Tipo de evento inválido' });
      const mudanca = req.body.placar;
      if (
        mudanca != null &&
        (tipo !== 'GOL' || !mudancaGolValida(mudanca, 1))
      ) {
        return res
          .status(400)
          .json({ error: 'Alteração de placar inválida para o gol' });
      }
      const minutoNumero = minuto == null ? null : Number(minuto);
      const periodoNumero = periodo == null ? 1 : Number(periodo);
      if (
        (minutoNumero != null &&
          (!Number.isSafeInteger(minutoNumero) ||
            minutoNumero < 0 ||
            minutoNumero > 200)) ||
        !Number.isSafeInteger(periodoNumero) ||
        periodoNumero < 1 ||
        periodoNumero > 10
      ) {
        return res.status(400).json({ error: 'Minuto ou período inválido' });
      }
      try {
        const partida = await prisma.partida.findUnique({
          where: { id: partidaId },
          select: { categoria_id: true },
        });
        if (!partida)
          return res.status(404).json({ error: 'Partida não encontrada' });
        if (jogador_id) {
          const jogadorValido = await prisma.jogador.count({
            where: {
              id: Number(jogador_id),
              categoria_id: partida.categoria_id,
            },
          });
          if (!jogadorValido)
            return res
              .status(403)
              .json({ error: 'Jogador não pertence à categoria da partida' });
        }
        const resultado = await prisma.$transaction((tx) =>
          gravarEventoComPlacar(
            tx,
            {
              partida_id: partidaId,
              jogador_id: jogador_id ? Number(jogador_id) : null,
              tipo,
              minuto: minutoNumero,
              periodo: periodoNumero,
            },
            mudanca
          )
        );
        const { evento, partida: atual } = resultado;

        if (atual) {
          io.to(`clube:${(req as any).clubeId}`).emit(
            'placar_atualizado',
            atual
          );
          await notificarGol(
            (req as any).clubeId,
            { ...mudanca.anterior, emCasa: atual.emCasa },
            atual
          );
        }

        const nomeJogador = evento.jogador?.nome ?? 'Adversário';

        io.to(`clube:${(req as any).clubeId}`).emit('evento_partida', {
          tipo: evento.tipo,
          jogador: nomeJogador,
          minuto: evento.minuto,
          partida_id: partidaId,
        });

        res.status(201).json(evento);
      } catch (error: any) {
        if (error instanceof ConflitoPartida)
          return res.status(409).json({ error: error.message });
        res.status(500).json({ error: 'Erro ao salvar evento' });
      }
    }
  );

  router.get(
    '/partidas/:id/eventos',
    exigirClubePublico,
    exigirPartidaVisivelDoClube((req) => Number(req.params.id)),
    async (req, res) => {
      try {
        const eventos = await prisma.evento.findMany({
          where: { partida_id: Number(req.params.id) },
          include: {
            jogador: {
              select: { id: true, nome: true, posicao: true, numCamisa: true },
            },
          },
          orderBy: { id: 'asc' },
        });
        res.json(eventos);
      } catch (error: any) {
        res.status(500).json({ error: 'Erro ao buscar eventos' });
      }
    }
  );

  router.delete<{ id: string }>(
    '/eventos/:id',
    exigirGestorDoClube,
    async (req, res) => {
      try {
        const evento = await prisma.evento.findUnique({
          where: { id: Number(req.params.id) },
          include: {
            partida: {
              select: {
                categoria_id: true,
                categoria: { select: { clube_id: true } },
              },
            },
          },
        });
        if (!evento)
          return res.status(404).json({ error: 'Evento não encontrado' });

        if (evento.partida.categoria.clube_id !== (req as any).clubeId) {
          return res
            .status(403)
            .json({ error: 'Este evento não pertence ao clube ativo' });
        }
        if (
          !(await podeAcessarCategoria(
            (req as any).usuarioId,
            (req as any).clubeId,
            evento.partida.categoria_id
          ))
        ) {
          return res
            .status(403)
            .json({ error: 'Você não administra a categoria deste evento' });
        }

        const mudanca = req.body?.placar;
        if (
          mudanca != null &&
          (evento.tipo !== 'GOL' || !mudancaGolValida(mudanca, -1))
        ) {
          return res
            .status(400)
            .json({ error: 'Alteração de placar inválida para remover o gol' });
        }
        const atual = await prisma.$transaction((tx) =>
          removerEventoComPlacar(tx, evento.id, evento.partida_id, mudanca)
        );
        io.to(`clube:${(req as any).clubeId}`).emit('evento_partida', {
          partida_id: evento.partida_id,
          removido: true,
          id: evento.id,
        });
        if (atual) {
          io.to(`clube:${(req as any).clubeId}`).emit(
            'placar_atualizado',
            atual
          );
        }
        res.json({ mensagem: 'Evento deletado' });
      } catch (error: any) {
        if (error instanceof ConflitoPartida)
          return res.status(409).json({ error: error.message });
        res.status(500).json({ error: 'Erro ao deletar evento' });
      }
    }
  );

  return router;
}
