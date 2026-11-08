import { Prisma, type PrismaClient, type OpcaoPalpite } from '@prisma/client';

export const OPCOES_PALPITE = ['MANDANTE', 'EMPATE', 'VISITANTE'] as const;
export class ErroPalpite extends Error {
  constructor(public status: number, mensagem: string) { super(mensagem); }
}

export function resumirVotos(contagens: Record<OpcaoPalpite, number>) {
  const total = OPCOES_PALPITE.reduce((soma, opcao) => soma + contagens[opcao], 0);
  const valores = OPCOES_PALPITE.map(opcao => ({ opcao, valor: total ? contagens[opcao] * 100 / total : 0 }));
  const percentuais = Object.fromEntries(valores.map(item => [item.opcao, Math.floor(item.valor)])) as Record<OpcaoPalpite, number>;
  // Distribui os arredondamentos sem inventar votos; os percentuais somam 100.
  const restantes = total ? 100 - Object.values(percentuais).reduce((soma, valor) => soma + valor, 0) : 0;
  valores.sort((a, b) => (b.valor % 1) - (a.valor % 1));
  for (let i = 0; i < restantes; i++) percentuais[valores[i].opcao]++;
  return { total, votos: contagens, percentuais };
}

const selecionarPartida = {
  id: true, status: true, palpites_versao: true,
  categoria: { select: { clube_id: true } },
  participantes: { select: { clube_id: true } },
  mandante: { select: { clube_representado_id: true } },
  visitante: { select: { clube_representado_id: true } },
} satisfies Prisma.PartidaSelect;

async function resumo(tx: Prisma.TransactionClient, partida: Prisma.PartidaGetPayload<{ select: typeof selecionarPartida }>, usuarioId?: number) {
  const grupos = await tx.votoPartida.groupBy({ by: ['escolha'], where: { partida_id: partida.id }, _count: { _all: true } });
  const votos: Record<OpcaoPalpite, number> = { MANDANTE: 0, EMPATE: 0, VISITANTE: 0 };
  for (const grupo of grupos) votos[grupo.escolha] = grupo._count._all;
  const meu = usuarioId ? await tx.votoPartida.findUnique({ where: { partida_id_usuario_id: { partida_id: partida.id, usuario_id: usuarioId } }, select: { escolha: true } }) : null;
  return {
    partida_id: partida.id, revisao: partida.palpites_versao, status: partida.status,
    aberta: ['AGENDADA', 'PREPARADA', 'AO_VIVO'].includes(partida.status),
    ...resumirVotos(votos), meuVoto: meu?.escolha ?? null,
  };
}

export async function consultarPalpite(banco: PrismaClient, partidaId: number, usuarioId?: number) {
  return banco.$transaction(async tx => {
    const partida = await tx.partida.findUnique({ where: { id: partidaId }, select: selecionarPartida });
    if (!partida) throw new ErroPalpite(404, 'Partida não encontrada.');
    return resumo(tx, partida, usuarioId);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function registrarPalpite(banco: PrismaClient, partidaId: number, usuarioId: number, escolha: OpcaoPalpite) {
  return banco.$transaction(async tx => {
    // O mesmo bloqueio usado por uma atualização de status impede votar após o encerramento.
    await tx.$queryRaw`SELECT id FROM "Partida" WHERE id = ${partidaId} FOR UPDATE`;
    let partida = await tx.partida.findUnique({ where: { id: partidaId }, select: selecionarPartida });
    if (!partida) throw new ErroPalpite(404, 'Partida não encontrada.');
    if (!['AGENDADA', 'PREPARADA', 'AO_VIVO'].includes(partida.status)) throw new ErroPalpite(409, 'A votação desta partida está encerrada.');
    const chave = { partida_id: partidaId, usuario_id: usuarioId };
    const anterior = await tx.votoPartida.findUnique({ where: { partida_id_usuario_id: chave }, select: { escolha: true } });
    if (anterior?.escolha !== escolha) {
      await tx.votoPartida.upsert({ where: { partida_id_usuario_id: chave }, create: { ...chave, escolha }, update: { escolha } });
      partida = await tx.partida.update({ where: { id: partidaId }, data: { palpites_versao: { increment: 1 } }, select: selecionarPartida });
    }
    const clubes = [...new Set([partida.categoria.clube_id, partida.mandante.clube_representado_id,
      partida.visitante.clube_representado_id, ...partida.participantes.map(equipe => equipe.clube_id)].filter((id): id is number => Boolean(id)))];
    return { resultado: await resumo(tx, partida, usuarioId), clubes, alterado: anterior?.escolha !== escolha };
  });
}
