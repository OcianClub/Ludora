import { Router, type Request, type Response } from 'express';
import type { Server } from 'socket.io';
import { prisma } from '../../lib/prisma';
import { exigirClubePublico, exigirGestorDoClube } from '../../middlewares/permissoes.middleware';
import { criarNotificacoesDoClube, enviarPushParaUsuarios } from '../../services/notificacoes.service';
import { processarMachineLearning } from '../../services/scout-ia.service';
import { FluxoInvalido, acesso, auditar, bloquearDuplicidade, criarOficial, exigir, incluirPartida, inteiro, partida, tocar, transacao, validarDados, validarDataHorario, validarEquipe, type Contexto, type PartidaCompleta } from './compartilhadas.service';

const contexto = (req: Request): Contexto => ({ usuarioId: (req as any).usuarioId, clubeId: (req as any).clubeId });
const json = (value: unknown): any => JSON.parse(JSON.stringify(value));
export function criarCompartilhadasRoutes(io: Server) {
  const router = Router();
  const tratar = (fn: (req: Request, res: Response) => Promise<unknown>) => async (req: Request, res: Response) => {
    try { req.body ??= {}; await fn(req, res); }
    catch (error) {
      if (error instanceof FluxoInvalido) return res.status(error.status).json({ error: error.message });
      console.error('Fluxo de partidas:', error instanceof Error ? error.message : error);
      res.status(500).json({ error: 'Não foi possível concluir a operação. Atualize e tente novamente.' });
    }
  };
  async function transmitir(id: number, resultado = false, golTimeId?: number) {
    const p = await prisma.partida.findUniqueOrThrow({ where: { id }, include: incluirPartida });
    for (const equipe of p.participantes) {
      io.to(`clube:${equipe.clube_id}`).emit('partida_atualizada', { id });
      io.to(`clube:${equipe.clube_id}`).emit('placar_atualizado', { id, gols_mandante: p.gols_mandante, gols_visitante: p.gols_visitante });
    }
    await Promise.all(p.participantes.map(async equipe => {
      const time = equipe.time_id === p.mandante_id ? p.mandante : p.visitante;
      if (resultado || golTimeId === equipe.time_id) {
        const pro = equipe.time_id === p.mandante_id ? p.gols_mandante : p.gols_visitante;
        const contra = equipe.time_id === p.mandante_id ? p.gols_visitante : p.gols_mandante;
        await criarNotificacoesDoClube({ io, clubeId: equipe.clube_id, partidaId: id,
          tipo: resultado ? 'RESULTADO_PARTIDA' : 'GOL_PARTIDA',
          titulo: resultado ? pro > contra ? 'Vitória!' : pro < contra ? 'Derrota' : 'Empate!' : `Gol do ${time.nome}!`,
          corpo: `${p.mandante.nome} ${p.gols_mandante} x ${p.gols_visitante} ${p.visitante.nome}`,
          dados: { partidaId: id, clubeId: equipe.clube_id } }).catch(() => console.error('Não foi possível notificar o resultado da partida.'));
      }
    }));
  }
  async function avisoProposta(id: string, acao = 'CRIAR', autorId?: number) {
    const p = await prisma.propostaPartida.findUniqueOrThrow({ where: { id } });
    const clubes = await prisma.clube.findMany({ where: { id: { in: [p.origem_id, p.destino_id] } }, select: { id: true, nome: true } });
    const autor = clubes.find(clube => clube.id === autorId)?.nome || clubes.find(clube => clube.id === p.origem_id)?.nome || 'O outro clube';
    const dados = p.dados as { data?: string; horario?: string; local?: string };
    const titulo = acao === 'SUGERIR' ? `${autor} sugeriu uma alteração`
      : p.status === 'ACEITA' ? 'Proposta de partida aceita'
      : p.status === 'RECUSADA' ? 'Proposta de partida recusada'
      : p.status === 'CANCELADA' ? 'Proposta de partida cancelada'
      : p.tipo === 'SUMULA' ? 'Transferência de súmula solicitada'
      : p.tipo === 'ALTERACAO' ? `${autor} propôs uma alteração` : `${autor} enviou uma proposta de partida`;
    const detalhes = [dados.data?.split('-').reverse().join('/'), dados.horario, dados.local].filter(Boolean).join(' · ');
    for (const clubeId of [p.origem_id, p.destino_id]) {
      const categoriaId = clubeId === p.origem_id ? p.categoria_origem_id : p.categoria_destino_id;
      const gestores = await prisma.usuarioClube.findMany({ where: { clube_id: clubeId, papel: { in: ['ADMIN', 'TECNICO', 'MESARIO'] }, OR: [{ papel: 'ADMIN' }, { acesso_todas_categorias: true }, { categorias: { some: { categoria_id: categoriaId } } }] } });
      for (const gestor of gestores) {
        const n = await prisma.notificacao.create({ data: { usuario_id: gestor.usuario_id, clube_id: clubeId, tipo: 'PARTIDA_AGENDADA',
          titulo,
          corpo: `${p.status === 'PENDENTE' ? p.respondente_id === clubeId ? 'Seu clube precisa responder.' : 'Aguardando a resposta do outro clube.' : 'Confira a resposta em Solicitações.'}${detalhes ? ` ${detalhes}` : ''}`,
          dados: { solicitacaoId: p.id, clubeId, acao } } });
        io.to(`usuario:${gestor.usuario_id}`).emit('notificacao_criada', n);
      }
      void enviarPushParaUsuarios(gestores.map(g => g.usuario_id), clubeId, 'PARTIDA_AGENDADA', titulo, detalhes || 'Consulte a proposta em Solicitações de partidas.', { solicitacaoId: p.id, clubeId }).catch(() => console.error('Falha ao enviar push da proposta.'));
      io.to(`clube:${clubeId}`).emit('solicitacao_partida', { id });
    }
  }
  async function agendamento(id: number, titulo: string) {
    const p = await prisma.partida.findUniqueOrThrow({ where: { id }, include: incluirPartida });
    for (const equipe of p.participantes) await criarNotificacoesDoClube({ io, clubeId: equipe.clube_id, partidaId: id, tipo: 'PARTIDA_AGENDADA', titulo,
      corpo: `${p.mandante.nome} x ${p.visitante.nome} · ${p.data.toISOString().slice(0, 10)} às ${p.horario}`, dados: { partidaId: id, clubeId: equipe.clube_id } }).catch(() => console.error('Falha ao notificar agenda.'));
  }

  router.get('/partidas/solicitacoes', exigirGestorDoClube, tratar(async (req, res) => {
    const ctx = contexto(req);
    const propostas = await prisma.propostaPartida.findMany({ where: { OR: [{ origem_id: ctx.clubeId }, { destino_id: ctx.clubeId }] }, orderBy: { criado_em: 'desc' }, take: 100 });
    const vinculo = await prisma.usuarioClube.findUnique({ where: { usuario_id_clube_id: { usuario_id: ctx.usuarioId, clube_id: ctx.clubeId } }, include: { categorias: true } });
    const permitidas = propostas.filter(p => vinculo && (vinculo.papel === 'ADMIN' || vinculo.acesso_todas_categorias || vinculo.categorias.some(c => c.categoria_id === (p.origem_id === ctx.clubeId ? p.categoria_origem_id : p.categoria_destino_id))));
    const ids = [...new Set(permitidas.flatMap(p => [p.origem_id, p.destino_id]))];
    const clubes = await prisma.clube.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true, escudo: true } });
    const categorias = await prisma.categoria.findMany({ where: { id: { in: [...new Set(permitidas.map(p => p.origem_id === ctx.clubeId ? p.categoria_origem_id : p.categoria_destino_id))] } }, select: { id: true, nome: true } });
    res.json(permitidas.map(p => ({ ...p, categoria_nome: categorias.find(c => c.id === (p.origem_id === ctx.clubeId ? p.categoria_origem_id : p.categoria_destino_id))?.nome, origem: clubes.find(c => c.id === p.origem_id), destino: clubes.find(c => c.id === p.destino_id) })));
  }));

  router.post('/partidas', exigirGestorDoClube, tratar(async (req, res) => {
    const ctx = contexto(req);
    const resultado = await transacao(async tx => {
      const v = await validarDados(tx, ctx, req.body);
      const chave = await bloquearDuplicidade(tx, ctx.clubeId, v.destino?.clube_id || null, v.cat, v.dados);
      if (v.destino) return { solicitacao: await tx.propostaPartida.create({ data: {
        origem_id: ctx.clubeId, destino_id: v.destino.clube_id, respondente_id: v.destino.clube_id,
        categoria_origem_id: v.cat.id, categoria_destino_id: v.destino.id, dados: json(v.dados), chave, criado_por_id: ctx.usuarioId,
      } }) };
      return criarOficial(tx, ctx, v.dados, null, null);
    });
    if ('solicitacao' in resultado) await avisoProposta(resultado.solicitacao.id).catch(() => console.error('Falha ao notificar proposta.'));
    else await agendamento(resultado.id, 'Nova partida marcada');
    res.status(201).json(resultado);
  }));

  router.post('/partidas/solicitacoes/:id/responder', exigirGestorDoClube, tratar(async (req, res) => {
    const ctx = contexto(req);
    const result = await transacao(async tx => {
      const proposta = await tx.propostaPartida.findUnique({ where: { id: String(req.params.id) } });
      exigir(proposta && [proposta.origem_id, proposta.destino_id].includes(ctx.clubeId), 'Solicitação não encontrada.', 404);
      exigir(await acesso(tx, ctx, proposta.origem_id === ctx.clubeId ? proposta.categoria_origem_id : proposta.categoria_destino_id), 'Você não administra esta categoria.', 403);
      exigir(proposta.status === 'PENDENTE' && proposta.versao === inteiro(req.body.versao, 0), 'A proposta mudou ou já foi respondida. Atualize.', 409);
      const acao = req.body.acao;
      exigir(['ACEITAR', 'RECUSAR', 'CANCELAR', 'SUGERIR'].includes(acao), 'Escolha uma resposta válida.');
      exigir(acao === 'CANCELAR' ? ctx.clubeId === proposta.origem_id : ctx.clubeId === proposta.respondente_id, 'Aguarde a resposta do outro clube.', 403);
      let dados: any = proposta.dados;
      if (acao === 'SUGERIR') {
        exigir(proposta.tipo !== 'SUMULA', 'Para a súmula, aceite ou recuse a transferência.');
        const validos = validarDataHorario(req.body.data, req.body.horario);
        dados = { ...dados, data: validos.data.toISOString().slice(0, 10), horario: validos.horario, local: String(req.body.local || '').trim().slice(0, 300), sugestao: { clube_id: ctx.clubeId, motivo: String(req.body.motivo || '').trim().slice(0, 500), criada_em: new Date().toISOString() } };
        const cat = await tx.categoria.findUniqueOrThrow({ where: { id: proposta.categoria_origem_id } });
        const chave = await bloquearDuplicidade(tx, proposta.origem_id, proposta.destino_id, cat, dados, proposta.partida_id || undefined, proposta.id);
        await tx.propostaPartida.update({ where: { id: proposta.id }, data: { dados: json(dados), chave, versao: { increment: 1 }, respondente_id: ctx.clubeId === proposta.origem_id ? proposta.destino_id : proposta.origem_id } });
        return { solicitacaoId: proposta.id };
      }
      let partidaId = proposta.partida_id;
      if (acao === 'ACEITAR') {
        const cat = await tx.categoria.findUniqueOrThrow({ where: { id: proposta.categoria_origem_id } });
        if (proposta.tipo === 'CRIACAO') {
          await bloquearDuplicidade(tx, proposta.origem_id, proposta.destino_id, cat, dados, undefined, proposta.id);
          const originalCtx = { usuarioId: proposta.criado_por_id, clubeId: proposta.origem_id };
          const v = await validarDados(tx, originalCtx, dados, true);
          exigir(v.destino?.id === proposta.categoria_destino_id, 'As categorias dos clubes mudaram. Envie uma nova proposta.');
          const p = await criarOficial(tx, originalCtx, v.dados, proposta.destino_id, proposta.categoria_destino_id);
          partidaId = p.id;
        } else {
          const { p } = await partida(tx, proposta.partida_id!, ctx, true);
          exigir(!['AO_VIVO', 'FINALIZADA', 'CANCELADA'].includes(p.status), 'Esta partida não permite mais alterações de preparação.');
          if (proposta.tipo === 'SUMULA') exigir(p.sumula_clube_id === proposta.origem_id, 'O responsável pela súmula mudou. Envie uma nova proposta.', 409);
          else if (dados.base) exigir(p.data.toISOString().slice(0, 10) === dados.base.data && p.horario === dados.base.horario && p.local === dados.base.local, 'Os dados da partida mudaram. Envie uma nova proposta.', 409);
          await tocar(tx, p);
          if (proposta.tipo === 'SUMULA') await tx.partida.update({ where: { id: p.id }, data: { sumula_clube_id: proposta.destino_id } });
          else {
            await bloquearDuplicidade(tx, proposta.origem_id, proposta.destino_id, cat, dados, p.id, proposta.id);
            await tx.partida.update({ where: { id: p.id }, data: { ...validarDataHorario(dados.data, dados.horario), local: dados.local, status: 'AGENDADA' } });
            await tx.participantePartida.updateMany({ where: { partida_id: p.id }, data: { pronta: false } });
          }
          await auditar(tx, ctx, p.id, proposta.tipo === 'SUMULA' ? 'SUMULA_TRANSFERIDA' : 'ALTERACAO_ACEITA', json(dados));
        }
      }
      await tx.propostaPartida.update({ where: { id: proposta.id }, data: { status: acao === 'ACEITAR' ? 'ACEITA' : acao === 'RECUSAR' ? 'RECUSADA' : 'CANCELADA', chave: null,
        partida_id: partidaId, motivo: String(req.body.motivo || '').trim().slice(0, 500) || null, respondido_em: new Date(), versao: { increment: 1 } } });
      return { solicitacaoId: proposta.id, partidaId };
    });
    await avisoProposta(result.solicitacaoId, req.body.acao, ctx.clubeId).catch(() => console.error('Falha ao notificar resposta.'));
    if (result.partidaId) { await transmitir(result.partidaId); await agendamento(result.partidaId, 'Confronto confirmado ou atualizado'); }
    res.json(result);
  }));

  router.get('/partidas/:id/gestao', exigirClubePublico, tratar(async (req, res) => {
    const ctx = contexto(req);
    const { p, equipe, pode } = await partida(prisma, inteiro(req.params.id), ctx);
    const organizador = await prisma.clube.findUnique({ where: { id: p.organizador_id || p.categoria.clube_id }, select: { id: true, nome: true } });
    const rows = await prisma.escalacaoPartida.findMany({ where: { partida_id: p.id }, include: { jogador: { select: { nome: true, posicao: true } } }, orderBy: [{ time_id: 'asc' }, { ordem: 'asc' }] });
    const dados = p.participantes.map(e => ({ ...e, escalacao: e.publicada_em || (pode && e.clube_id === ctx.clubeId) ? rows.filter(r => r.time_id === e.time_id) : [] }));
    const eventos = await prisma.evento.findMany({ where: { partida_id: p.id }, include: { jogador: { select: { nome: true } } }, orderBy: { id: 'desc' } });
    const identidade = (time: typeof p.mandante) => time.clubeRepresentado ? { ...time, nome: time.clubeRepresentado.nome, escudo: time.clubeRepresentado.escudo } : time;
    res.json({ partida: { ...p, mandante: identidade(p.mandante), visitante: identidade(p.visitante) }, organizador, equipes: dados, minhaEquipeId: equipe?.id, podePreparar: pode, podeSumula: pode && p.sumula_clube_id === ctx.clubeId,
      eventos, auditoria: pode ? await prisma.auditoriaPartida.findMany({ where: { partida_id: p.id }, orderBy: { id: 'desc' }, take: 40 }) : [] });
  }));

  router.put('/partidas/:id/escalacao', exigirGestorDoClube, tratar(async (req, res) => {
    const ctx = contexto(req), id = inteiro(req.params.id);
    const rows = await transacao(async tx => {
      const { p, equipe } = await partida(tx, id, ctx, true);
      exigir(!['AO_VIVO', 'FINALIZADA', 'CANCELADA'].includes(p.status), 'Durante o jogo, use substituições. A escalação inicial fica preservada.');
      exigir(Array.isArray(req.body.jogadores) && req.body.jogadores.length <= 50, 'Informe até 50 convocados.');
      const entrada = req.body.jogadores.map((j: any, ordem: number) => ({ partida_id: id, time_id: equipe!.time_id, jogador_id: inteiro(j.jogador_id), numCamisa: inteiro(j.numCamisa, 1, 99), titular: j.titular === true, ordem }));
      exigir(new Set(entrada.map((r: any) => r.jogador_id)).size === entrada.length && new Set(entrada.map((r: any) => r.numCamisa)).size === entrada.length, 'Jogadores e camisas não podem se repetir na mesma equipe.');
      const validos = await tx.jogador.count({ where: { id: { in: entrada.map((r: any) => r.jogador_id) }, categoria_id: equipe!.categoria_id, ativo: true, numCamisa: { not: null } } });
      exigir(validos === entrada.length, 'Escolha jogadores ativos da categoria da sua equipe.');
      await tocar(tx, p, req.body.versao);
      await tx.escalacaoPartida.deleteMany({ where: { partida_id: id, time_id: equipe!.time_id } });
      await tx.escalacaoPartida.createMany({ data: entrada });
      await tx.participantePartida.update({ where: { id: equipe!.id }, data: { pronta: false, publicada_em: null, versao: { increment: 1 } } });
      if (p.status === 'PREPARADA') await tx.partida.update({ where: { id }, data: { status: 'AGENDADA' } });
      await auditar(tx, ctx, id, 'ESCALACAO_SALVA');
      return entrada;
    });
    // Somente a confirmação publica a escalação; rascunhos não são transmitidos.
    res.json(rows);
  }));
  router.get('/partidas/:id/escalacao', exigirClubePublico, tratar(async (req, res) => {
    const { p, pode, equipe } = await partida(prisma, inteiro(req.params.id), contexto(req));
    const times = p.participantes.filter(e => e.publicada_em || (pode && e.id === equipe?.id)).map(e => e.time_id);
    res.json(await prisma.escalacaoPartida.findMany({ where: { partida_id: p.id, time_id: { in: times } }, include: { jogador: { select: { nome: true, posicao: true } } }, orderBy: [{ time_id: 'asc' }, { ordem: 'asc' }] }));
  }));
  router.post('/partidas/:id/preparacao', exigirGestorDoClube, tratar(async (req, res) => {
    const ctx = contexto(req), id = inteiro(req.params.id);
    const p = await transacao(async tx => {
      const { p, equipe } = await partida(tx, id, ctx, true);
      exigir(['AGENDADA', 'PREPARADA'].includes(p.status), 'A preparação está encerrada.');
      validarDataHorario(p.data.toISOString().slice(0, 10), p.horario);
      await validarEquipe(tx, p, equipe!);
      await tocar(tx, p, req.body.versao);
      await tx.participantePartida.update({ where: { id: equipe!.id }, data: { pronta: true, publicada_em: new Date() } });
      const pendentes = await tx.participantePartida.count({ where: { partida_id: id, pronta: false } });
      await tx.partida.update({ where: { id }, data: { status: pendentes ? 'AGENDADA' : 'PREPARADA' } });
      await auditar(tx, ctx, id, 'EQUIPE_CONFIRMADA');
      return tx.partida.findUniqueOrThrow({ where: { id }, include: incluirPartida });
    });
    await transmitir(id); res.json(p);
  }));

  router.patch('/partidas/:id', exigirGestorDoClube, tratar(async (req, res) => {
    const ctx = contexto(req), id = inteiro(req.params.id);
    const result = await transacao(async tx => {
      const { p, equipe } = await partida(tx, id, ctx, true);
      exigir(['AGENDADA', 'PREPARADA'].includes(p.status), 'Os dados do confronto não podem mudar após o início.');
      exigir((!req.body.categoria_id || [p.categoria_id, equipe!.categoria_id].includes(Number(req.body.categoria_id))) && (!req.body.mandante_id || Number(req.body.mandante_id) === p.mandante_id) && (!req.body.visitante_id || Number(req.body.visitante_id) === p.visitante_id), 'Para mudar os participantes ou a categoria, cancele e organize outro confronto.');
      const horario = validarDataHorario(req.body.data || p.data.toISOString().slice(0, 10), req.body.horario || p.horario);
      const dados = { data: horario.data.toISOString().slice(0, 10), horario: horario.horario, local: req.body.local === undefined ? p.local : String(req.body.local).trim().slice(0, 300), base: { data: p.data.toISOString().slice(0, 10), horario: p.horario, local: p.local } };
      const outro = p.participantes.find(e => e.clube_id !== ctx.clubeId);
      const chave = await bloquearDuplicidade(tx, ctx.clubeId, outro?.clube_id || null, equipe!.categoria, { ...dados, mandante_id: p.mandante_id, visitante_id: p.visitante_id }, id);
      if (outro) return { solicitacao: await tx.propostaPartida.create({ data: { tipo: 'ALTERACAO', origem_id: ctx.clubeId, destino_id: outro.clube_id, respondente_id: outro.clube_id,
        categoria_origem_id: equipe!.categoria_id, categoria_destino_id: outro.categoria_id, dados: json(dados), partida_id: id, criado_por_id: ctx.usuarioId, chave } }) };
      await tocar(tx, p, req.body.versao);
      await tx.participantePartida.updateMany({ where: { partida_id: id }, data: { pronta: false } });
      await auditar(tx, ctx, id, 'DADOS_ALTERADOS', json(dados));
      return tx.partida.update({ where: { id }, data: { ...horario, local: dados.local, status: 'AGENDADA' }, include: incluirPartida });
    });
    if ('solicitacao' in result) await avisoProposta(result.solicitacao.id).catch(() => console.error('Falha ao notificar proposta.'));
    else { await transmitir(id); await agendamento(id, 'Partida remarcada'); }
    res.json(result);
  }));

  router.post('/partidas/:id/sumula', exigirGestorDoClube, tratar(async (req, res) => {
    const ctx = contexto(req), id = inteiro(req.params.id);
    const proposta = await transacao(async tx => {
      const { p, equipe } = await partida(tx, id, ctx, true);
      exigir(p.sumula_clube_id === ctx.clubeId && ['AGENDADA', 'PREPARADA'].includes(p.status), 'Somente o responsável pode propor a transferência antes do início.', 403);
      const outro = p.participantes.find(e => e.clube_id !== ctx.clubeId);
      exigir(outro, 'Esta partida não tem outro clube participante.');
      exigir(!await tx.propostaPartida.count({ where: { partida_id: id, tipo: 'SUMULA', status: 'PENDENTE' } }), 'Já há uma transferência aguardando resposta.', 409);
      return tx.propostaPartida.create({ data: { tipo: 'SUMULA', origem_id: ctx.clubeId, destino_id: outro.clube_id, respondente_id: outro.clube_id,
        categoria_origem_id: equipe!.categoria_id, categoria_destino_id: outro.categoria_id, criado_por_id: ctx.usuarioId, partida_id: id, dados: { versao_partida: p.versao } } });
    });
    await avisoProposta(proposta.id).catch(() => console.error('Falha ao notificar transferência.')); res.json(proposta);
  }));

  router.patch('/partidas/:id/status', exigirGestorDoClube, tratar(async (req, res) => {
    const ctx = contexto(req), id = inteiro(req.params.id), next = req.body.status;
    const p = await transacao(async tx => {
      const { p } = await partida(tx, id, ctx, true);
      if (next === 'PREPARADA') throw new FluxoInvalido('Confirme a preparação da sua equipe em vez de alterar o status diretamente.');
      exigir(p.sumula_clube_id === ctx.clubeId || (next === 'CANCELADA' && p.organizador_id === ctx.clubeId), 'Esta ação é do responsável pela súmula ou do organizador.', 403);
      const valido = (p.status === 'PREPARADA' && next === 'AO_VIVO') || (p.status === 'AO_VIVO' && next === 'FINALIZADA') || (['AGENDADA', 'PREPARADA'].includes(p.status) && next === 'CANCELADA');
      exigir(valido, 'Transição de situação inválida. Atualize a partida.');
      if (next === 'AO_VIVO') {
        exigir(p.participantes.length > 0 && p.participantes.every(e => e.pronta), 'Aguarde a confirmação das duas equipes.');
        for (const equipe of p.participantes) await validarEquipe(tx, p, equipe);
        exigir(!await tx.propostaPartida.count({ where: { partida_id: id, status: 'PENDENTE' } }), 'Responda às alterações pendentes antes de iniciar.');
        await tx.escalacaoPartida.updateMany({ where: { partida_id: id, titular: true }, data: { titular_inicial: true } });
        await tx.escalacaoPartida.updateMany({ where: { partida_id: id, titular: false }, data: { titular_inicial: false } });
      }
      if (next === 'CANCELADA') exigir(typeof req.body.motivo === 'string' && req.body.motivo.trim(), 'Informe o motivo do cancelamento.');
      if (req.body.status_anterior) exigir(req.body.status_anterior === p.status, 'A partida mudou. Atualize.', 409);
      await tocar(tx, p, req.body.versao);
      await auditar(tx, ctx, id, `STATUS_${next}`, { motivo: String(req.body.motivo || '').slice(0, 500) });
      return tx.partida.update({ where: { id }, data: { status: next } });
    });
    await transmitir(id, next === 'FINALIZADA');
    if (next === 'AO_VIVO') await agendamento(id, 'Partida iniciada');
    if (next === 'CANCELADA') await agendamento(id, 'Partida cancelada');
    if (next === 'FINALIZADA') {
      const equipes = await prisma.participantePartida.findMany({ where: { partida_id: id } });
      for (const e of equipes) void processarMachineLearning(e.clube_id).catch(() => console.error('Falha ao atualizar scout.'));
    }
    res.json(p);
  }));
  router.delete('/partidas/:id', exigirGestorDoClube, tratar(async (_req, res) => {
    res.status(409).json({ error: 'Preserve o histórico: cancele a partida informando um motivo.' });
  }));
  router.post('/partidas/:id/substituicoes', exigirGestorDoClube, tratar(async (req, res) => {
    const ctx = contexto(req), id = inteiro(req.params.id);
    await transacao(async tx => {
      const { p, equipe } = await partida(tx, id, ctx, true);
      exigir(p.status === 'AO_VIVO', 'Substituições só podem ser registradas durante o jogo.');
      const sai = inteiro(req.body.sai), entra = inteiro(req.body.entra);
      exigir(sai !== entra, 'Escolha dois jogadores diferentes.');
      const rows = await tx.escalacaoPartida.findMany({ where: { partida_id: id, time_id: equipe!.time_id, jogador_id: { in: [sai, entra] } } });
      exigir(rows.length === 2 && rows.find(r => r.jogador_id === sai)?.titular && !rows.find(r => r.jogador_id === entra)?.titular, 'Selecione um titular para sair e um reserva para entrar.');
      await tocar(tx, p, req.body.versao);
      await tx.escalacaoPartida.updateMany({ where: { partida_id: id, jogador_id: sai }, data: { titular: false } });
      await tx.escalacaoPartida.updateMany({ where: { partida_id: id, jogador_id: entra }, data: { titular: true } });
      await auditar(tx, ctx, id, 'SUBSTITUICAO', { time_id: equipe!.time_id, sai, entra, periodo: p.periodo_atual });
    });
    await transmitir(id); res.json({ ok: true });
  }));
  router.patch('/partidas/:id/periodo', exigirGestorDoClube, tratar(async (req, res) => {
    const ctx = contexto(req), id = inteiro(req.params.id);
    await transacao(async tx => {
      const { p } = await partida(tx, id, ctx, true);
      exigir(p.status === 'AO_VIVO' && p.sumula_clube_id === ctx.clubeId, 'Somente o responsável pela súmula pode alterar o período durante o jogo.', 403);
      await tocar(tx, p, req.body.versao);
      await tx.partida.update({ where: { id }, data: { periodo_atual: inteiro(req.body.periodo, 1, 10) } });
      await auditar(tx, ctx, id, 'PERIODO_ALTERADO', { periodo: req.body.periodo });
    });
    await transmitir(id); res.json({ ok: true });
  }));
  router.post('/partidas/:id/eventos', exigirGestorDoClube, tratar(async (req, res) => {
    const ctx = contexto(req), id = inteiro(req.params.id);
    const evento = await transacao(async tx => {
      const { p } = await partida(tx, id, ctx, true);
      exigir(p.sumula_clube_id === ctx.clubeId, 'Somente o responsável pela súmula pode registrar eventos.', 403);
      exigir(['AO_VIVO', 'FINALIZADA'].includes(p.status), 'Inicie a partida antes de registrar eventos.');
      if (p.status === 'FINALIZADA') exigir(String(req.body.motivo || '').trim(), 'Informe o motivo da correção após o encerramento.');
      const tipo = req.body.tipo;
      exigir(['GOL', 'ASSISTENCIA', 'DEFESA', 'CARTAO_AMARELO', 'CARTAO_VERMELHO', 'CARTAO_AZUL', 'FALTA'].includes(tipo), 'Escolha um evento válido.');
      let timeId = req.body.time_id ? inteiro(req.body.time_id) : null;
      if (!timeId && req.body.placar) {
        const m = req.body.placar;
        exigir(m.anterior?.gols_mandante === p.gols_mandante && m.anterior?.gols_visitante === p.gols_visitante, 'O placar mudou. Atualize.', 409);
        timeId = m.novo?.gols_mandante === p.gols_mandante + 1 ? p.mandante_id : m.novo?.gols_visitante === p.gols_visitante + 1 ? p.visitante_id : null;
      }
      if (!timeId) timeId = p.participantes.find(e => e.clube_id === ctx.clubeId)!.time_id;
      exigir([p.mandante_id, p.visitante_id].includes(timeId), 'Equipe inválida.');
      const contra = req.body.gol_contra === true;
      exigir(!contra || tipo === 'GOL', 'Gol contra só é válido para gols.');
      const autorTimeId = contra ? timeId === p.mandante_id ? p.visitante_id : p.mandante_id : timeId;
      const equipe = p.participantes.find(e => e.time_id === autorTimeId);
      const jogadorId = req.body.jogador_id ? inteiro(req.body.jogador_id) : null;
      if (jogadorId) {
        exigir(await tx.escalacaoPartida.count({ where: { partida_id: id, time_id: autorTimeId, jogador_id: jogadorId, ...(p.status === 'AO_VIVO' ? { titular: true } : {}) } }), 'O jogador deve estar convocado pela equipe selecionada e em campo durante o jogo.');
      }
      if (equipe && tipo === 'GOL' && !contra) exigir(jogadorId, 'Selecione o autor do gol ou registre um gol contra.');
      if (equipe && tipo !== 'GOL') exigir(jogadorId, 'Selecione o jogador responsável pelo evento.');
      await tocar(tx, p, req.body.versao);
      const e = await tx.evento.create({ data: { partida_id: id, tipo, time_id: timeId, jogador_id: jogadorId, gol_contra: contra,
        criado_por_id: ctx.usuarioId, periodo: req.body.periodo ? inteiro(req.body.periodo, 1, 10) : p.periodo_atual, minuto: req.body.minuto == null || req.body.minuto === '' ? null : inteiro(req.body.minuto, 0, 200) }, include: { jogador: { select: { nome: true } } } });
      if (tipo === 'GOL') await tx.partida.update({ where: { id }, data: timeId === p.mandante_id ? { gols_mandante: { increment: 1 } } : { gols_visitante: { increment: 1 } } });
      await auditar(tx, ctx, id, 'EVENTO_REGISTRADO', { evento_id: e.id, motivo: String(req.body.motivo || '').slice(0, 500) });
      return e;
    });
    await transmitir(id, false, evento.tipo === 'GOL' ? evento.time_id! : undefined);
    if (String(req.body.motivo || '').trim()) {
      await agendamento(id, 'Súmula corrigida');
      const equipes = await prisma.participantePartida.findMany({ where: { partida_id: id } });
      for (const e of equipes) void processarMachineLearning(e.clube_id).catch(() => undefined);
    }
    res.status(201).json(evento);
  }));
  router.delete('/eventos/:id', exigirGestorDoClube, tratar(async (req, res) => {
    const ctx = contexto(req);
    const id = await transacao(async tx => {
      const e = await tx.evento.findUnique({ where: { id: inteiro(req.params.id) } });
      exigir(e, 'Evento não encontrado.', 404);
      const { p } = await partida(tx, e.partida_id, ctx, true);
      exigir(p.sumula_clube_id === ctx.clubeId && ['AO_VIVO', 'FINALIZADA'].includes(p.status), 'Esta ação é do responsável pela súmula.', 403);
      exigir(String(req.body.motivo || '').trim(), 'Informe o motivo da remoção.');
      await tocar(tx, p, req.body.versao);
      if (e.tipo === 'GOL') {
        exigir(e.time_id, 'Este gol é de um registro antigo. Corrija o placar manualmente com justificativa antes de remover seu registro.');
        const mandante = e.time_id === p.mandante_id;
        exigir((mandante ? p.gols_mandante : p.gols_visitante) > 0, 'O placar já está zerado. Confira a súmula.');
        await tx.partida.update({ where: { id: p.id }, data: mandante ? { gols_mandante: { decrement: 1 } } : { gols_visitante: { decrement: 1 } } });
      }
      await tx.evento.delete({ where: { id: e.id } });
      await auditar(tx, ctx, p.id, 'EVENTO_REMOVIDO', { evento: json(e), motivo: String(req.body.motivo).slice(0, 500) });
      return p.id;
    });
    await transmitir(id); await agendamento(id, 'Súmula corrigida');
    const equipes = await prisma.participantePartida.findMany({ where: { partida_id: id } });
    for (const e of equipes) void processarMachineLearning(e.clube_id).catch(() => undefined);
    res.json({ ok: true });
  }));
  router.patch('/partidas/:id/placar', exigirGestorDoClube, tratar(async (req, res) => {
    const ctx = contexto(req), id = inteiro(req.params.id);
    const result = await transacao(async tx => {
      const { p } = await partida(tx, id, ctx, true);
      exigir(p.sumula_clube_id === ctx.clubeId && ['AO_VIVO', 'FINALIZADA'].includes(p.status), 'Esta ação é do responsável pela súmula.', 403);
      exigir(String(req.body.motivo || '').trim(), 'Registre gols pelos eventos. Para uma correção manual, informe a justificativa.');
      await tocar(tx, p, req.body.versao);
      const dados = { gols_mandante: inteiro(req.body.gols_mandante, 0, 99), gols_visitante: inteiro(req.body.gols_visitante, 0, 99) };
      await auditar(tx, ctx, id, 'PLACAR_CORRIGIDO', { anterior: { gols_mandante: p.gols_mandante, gols_visitante: p.gols_visitante }, novo: dados, motivo: String(req.body.motivo).slice(0, 500) });
      return tx.partida.update({ where: { id }, data: dados });
    });
    await transmitir(id); await agendamento(id, 'Placar corrigido'); res.json(result);
  }));
  return router;
}
