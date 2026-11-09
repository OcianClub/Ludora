import type { Response } from 'express';
import type { Manutencao, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export const OPERACOES = {
  CRIAR_PARTIDAS: 'Criação de partidas',
  CRIAR_COMPETICOES: 'Criação de competições locais',
  ENVIAR_CONVITES: 'Criação e reenvio de convites',
  SINCRONIZAR_PAULISTA: 'Sincronização do Paulista',
  AGENDA_OFICIAL: 'Alterações da agenda oficial',
} as const;
export type Operacao = keyof typeof OPERACOES;
export const oficial = (operacao: Operacao) => operacao === 'SINCRONIZAR_PAULISTA' || operacao === 'AGENDA_OFICIAL';
export function escopoPermitido(cargo: string, operacao: Operacao, escopo: string) {
  const permitido = escopo === 'GLOBAL' || escopo === (oficial(operacao) ? 'EVENTO' : 'CLUBE');
  return permitido && (cargo === 'SUPERADMIN' || cargo === 'SUPORTE' && escopo === 'CLUBE' && ['CRIAR_PARTIDAS', 'ENVIAR_CONVITES'].includes(operacao));
}

export async function buscarPausa(operacoes: Operacao[], alvos: { clubes?: number[]; eventoId?: number } = {}, banco: Pick<Prisma.TransactionClient, 'manutencao'> = prisma) {
  return banco.manutencao.findFirst({ where: { ativa: true, operacao: { in: operacoes }, OR: [
    { escopo: 'GLOBAL' },
    ...(alvos.clubes?.length ? [{ escopo: 'CLUBE', alvoId: { in: alvos.clubes } }] : []),
    ...(alvos.eventoId ? [{ escopo: 'EVENTO', alvoId: alvos.eventoId }] : []),
  ] }, orderBy: { inicio: 'asc' } });
}

export function pausaPublica(p: Manutencao) {
  return { protocolo: p.id, operacao: p.operacao, motivo: p.motivo, inicio: p.inicio, revisarEm: p.revisarEm };
}
export class OperacaoPausada extends Error {
  constructor(readonly pausa: Manutencao) {
    super(`${OPERACOES[pausa.operacao as Operacao]} em manutenção. ${pausa.motivo} Protocolo ${pausa.id}.`);
  }
}
export async function exigirOperacao(operacoes: Operacao[], alvos: Parameters<typeof buscarPausa>[1] = {}, banco?: Parameters<typeof buscarPausa>[2]) {
  const pausa = await buscarPausa(operacoes, alvos, banco);
  if (pausa) throw new OperacaoPausada(pausa);
}
export function responderPausa(erro: unknown, res: Response) {
  if (!(erro instanceof OperacaoPausada)) return false;
  res.status(423).json({ error: erro.message, code: 'EM_MANUTENCAO', manutencao: pausaPublica(erro.pausa) });
  return true;
}
