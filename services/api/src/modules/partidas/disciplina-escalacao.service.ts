import type { Prisma } from '@prisma/client';
import { auditar, exigir, type Contexto, type PartidaCompleta } from './compartilhadas.service';

type Banco = Prisma.TransactionClient;
export const expulsaoDoJogador = (tx: Banco, partidaId: number, timeId: number, jogadorId: number, ignorarEvento?: number) =>
  tx.evento.findFirst({ where: { partida_id: partidaId, time_id: timeId, jogador_id: jogadorId, tipo: 'CARTAO_VERMELHO', ...(ignorarEvento ? { id: { not: ignorarEvento } } : {}) }, orderBy: { id: 'desc' } });

export async function aplicarExpulsao(tx: Banco, p: PartidaCompleta, ctx: Contexto, evento: { id: number; time_id: number | null; jogador_id: number | null }) {
  if (p.status !== 'AO_VIVO' || !evento.time_id || !evento.jogador_id) return;
  const [row] = await tx.escalacaoPartida.findMany({ where: { partida_id: p.id, time_id: evento.time_id, jogador_id: { in: [evento.jogador_id] } } });
  if (!row) return;
  const estavaEmCampo = row.titular;
  await tx.escalacaoPartida.updateMany({ where: { partida_id: p.id, time_id: evento.time_id, jogador_id: evento.jogador_id }, data: { titular: false } });
  await auditar(tx, ctx, p.id, 'JOGADOR_EXPULSO', { evento_id: evento.id, time_id: evento.time_id, jogador_id: evento.jogador_id, estava_em_campo: estavaEmCampo });
}

// Restores the original slot only if no replacement used it. Otherwise the player
// becomes eligible on the bench; undoing a card never adds a sixth player.
export async function reverterExpulsao(tx: Banco, p: PartidaCompleta, ctx: Contexto, evento: { id: number; time_id: number | null; jogador_id: number | null }) {
  if (p.status !== 'AO_VIVO' || !evento.time_id || !evento.jogador_id) return;
  if (await expulsaoDoJogador(tx, p.id, evento.time_id, evento.jogador_id, evento.id)) return;
  const original = await tx.auditoriaPartida.findFirst({ where: { partida_id: p.id, acao: 'JOGADOR_EXPULSO', dados: { path: ['evento_id'], equals: evento.id } }, orderBy: { id: 'desc' } });
  const dados = original?.dados as { estava_em_campo?: boolean } | null;
  const reposicao = await tx.auditoriaPartida.findFirst({ where: { partida_id: p.id, acao: 'SUBSTITUICAO', dados: { path: ['expulsao_evento_id'], equals: evento.id } } });
  const emCampo = await tx.escalacaoPartida.count({ where: { partida_id: p.id, time_id: evento.time_id, titular: true } });
  const reintegrado = !!dados?.estava_em_campo && !reposicao && emCampo < p.titulares_necessarios;
  if (reintegrado) await tx.escalacaoPartida.updateMany({ where: { partida_id: p.id, time_id: evento.time_id, jogador_id: evento.jogador_id }, data: { titular: true } });
  await auditar(tx, ctx, p.id, 'EXPULSAO_REVERTIDA', { evento_id: evento.id, time_id: evento.time_id, jogador_id: evento.jogador_id, voltou_ao_campo: reintegrado });
}

export async function validarReposicao(tx: Banco, p: PartidaCompleta, timeId: number, jogadorId: number) {
  const expulsao = await expulsaoDoJogador(tx, p.id, timeId, jogadorId);
  exigir(expulsao, 'O jogador selecionado não possui uma expulsão a repor.');
  const origem = await tx.auditoriaPartida.findFirst({ where: { partida_id: p.id, acao: 'JOGADOR_EXPULSO', dados: { path: ['evento_id'], equals: expulsao.id } }, orderBy: { id: 'desc' } });
  exigir((origem?.dados as { estava_em_campo?: boolean } | null)?.estava_em_campo, 'A expulsão de um reserva não abre uma vaga em campo.');
  const reposta = await tx.auditoriaPartida.findFirst({ where: { partida_id: p.id, acao: 'SUBSTITUICAO', dados: { path: ['expulsao_evento_id'], equals: expulsao.id } } });
  exigir(!reposta, 'Esta expulsão já teve reposição. Atualize a escalação.', 409);
  const total = await tx.escalacaoPartida.count({ where: { partida_id: p.id, time_id: timeId, titular: true } });
  exigir(total < p.titulares_necessarios, 'A equipe já tem todos os jogadores em campo.', 409);
  return expulsao;
}
