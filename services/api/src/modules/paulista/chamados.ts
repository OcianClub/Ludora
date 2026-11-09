import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { sanitizar } from '../suporte/rules';
import { FalhaPaulista, json } from './service';

export const chaveChamadoPaulista = (id: number) => `paulista-pendencia:${id}`;
export const chaveChamadoVinculo = (eventoId: number, equipeId: number) => `paulista-vinculo:${eventoId}:${equipeId}`;

export async function solicitarAnaliseVinculo(eventoId: number, equipeId: number, operadorId: number, motivo: string) {
  return prisma.$transaction(async tx => {
    const alias = await tx.fpfsTime.findUnique({ where: { eventoId_equipeId: { eventoId, equipeId } }, include: { equipe: { include: { vinculo: true } } } });
    const clubeId = alias?.equipe.vinculo?.clubeId;
    if (!clubeId) throw new FalhaPaulista(404, 'Equipe sem vínculo neste evento.');
    const fingerprint = chaveChamadoVinculo(eventoId, equipeId);
    const anterior = await tx.suporteChamado.findUnique({ where: { fingerprint } });
    if (anterior && anterior.status !== 'RESOLVIDO') return { chamadoId: anterior.id };
    const texto = sanitizar(motivo);
    const historico = { create: { operadorId, acao: 'REVISAO_VINCULO_SOLICITADA', motivo: texto } };
    const c = anterior
      ? await tx.suporteChamado.update({ where: { id: anterior.id }, data: { status: 'REABERTO', fila: 'SUPORTE', clubeId, revisao: { increment: 1 }, historico } })
      : await tx.suporteChamado.create({ data: {
        fingerprint, requestId: randomUUID(), origem: 'OPERACAO', tipo: 'CONFIGURACAO', impacto: 'DIFICULDADE',
        prioridade: 'NORMAL', fila: 'SUPORTE', regra: 'REVISAO_VINCULO_PAULISTA', clubeId, servico: 'paulista', versao: '1',
        rota: `/admin/paulista/eventos/${eventoId}`, assunto: sanitizar(`Análise de vínculo · ${alias.equipe.nome}`, 120),
        descricao: 'Conferir identidade, participações e histórico da equipe oficial.', revisarEm: new Date(Date.now() + 24 * 3600000), historico,
      } });
    await tx.fpfsAuditoria.create({ data: { eventoId, usuarioId: operadorId, acao: 'REVISAO_VINCULO_SOLICITADA', dados: json({ equipeId, clubeId, motivo: texto, chamadoId: c.id }) } });
    return { chamadoId: c.id };
  }, { isolationLevel: 'Serializable' });
}
export async function encaminharPendencia(eventoId: number, pendenciaId: number, operadorId: number, passos: string) {
  try {
    return await prisma.$transaction(async tx => {
      const pendencia = await tx.fpfsPendencia.findFirst({ where: { id: pendenciaId, jogo: { eventoId } }, include: { jogo: { include: { evento: true } } } });
      if (!pendencia) throw new FalhaPaulista(404, 'Pendência não encontrada neste campeonato.');
      const fingerprint = chaveChamadoPaulista(pendenciaId);
      const anterior = await tx.suporteChamado.findUnique({ where: { fingerprint } });
      if (anterior && anterior.status !== 'RESOLVIDO') return { chamadoId: anterior.id, criado: false };
      if (!['ABERTA', 'EM_REVISAO', 'AGUARDANDO_CLUBE'].includes(pendencia.estado)) throw new FalhaPaulista(409, 'A pendência já foi conferida. Atualize antes de encaminhar.');
      const { evento } = pendencia.jogo;
      const participantes = pendencia.jogo.partidaId ? await tx.participantePartida.findMany({ where: { partida_id: pendencia.jogo.partidaId }, select: { clube_id: true } }) : [];
      const dados = {
        fila: 'DESENVOLVIMENTO', status: anterior ? 'REABERTO' : 'ENCAMINHADO_DEVS', prioridade: 'ALTA',
        regra: 'REVISAO_HUMANA_PAULISTA', revisarEm: new Date(Date.now() + 4 * 3600000),
        clubesAfetados: participantes.map(p => p.clube_id),
        detalhesTecnicos: json({ reproducao: sanitizar(passos), eventoId, pendenciaId, jogoId: pendencia.jogoId, tipo: pendencia.tipo, comparacao: pendencia.dados }),
      };
      const chamado = anterior ? await tx.suporteChamado.update({ where: { id: anterior.id }, data: { ...dados, revisao: { increment: 1 }, responsavelId: null } })
        : await tx.suporteChamado.create({ data: { ...dados, fingerprint, requestId: randomUUID(), origem: 'OPERACAO', tipo: 'ERRO', impacto: 'DIFICULDADE', servico: 'paulista', versao: String(evento.versao), rota: `/admin/paulista/eventos/${eventoId}`, assunto: sanitizar(`Paulista ${evento.ano} · ${evento.divisao} · ${evento.categoria}`, 120), descricao: 'A equipe de operação solicitou análise técnica de uma divergência na integração.', usuarioId: null } });
      await tx.fpfsPendencia.update({ where: { id: pendenciaId }, data: { estado: 'EM_REVISAO' } });
      await tx.suporteHistorico.create({ data: { chamadoId: chamado.id, operadorId, acao: 'ENCAMINHADO_PAULISTA', motivo: sanitizar(passos) } });
      await tx.fpfsAuditoria.create({ data: { eventoId, usuarioId: operadorId, acao: 'CHAMADO_TECNICO', dados: json({ pendenciaId, chamadoId: chamado.id, motivo: sanitizar(passos) }) } });
      return { chamadoId: chamado.id, criado: !anterior };
    }, { isolationLevel: 'Serializable' });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(e.code)) {
      const anterior = await prisma.suporteChamado.findUnique({ where: { fingerprint: chaveChamadoPaulista(pendenciaId) } });
      if (anterior && anterior.status !== 'RESOLVIDO') return { chamadoId: anterior.id, criado: false };
    }
    throw e;
  }
}
