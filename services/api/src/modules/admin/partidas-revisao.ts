import type { Prisma, PrismaClient } from '@prisma/client';

type Banco = Prisma.TransactionClient;
const DIA = 86_400_000;
const ACAO_LEMBRETE = 'LEMBRETE_ENCERRAMENTO_ENVIADO';
export const inicioSelect = {
  where: { acao: { in: ['STATUS_AO_VIVO', 'STATUS_FINALIZADA', 'STATUS_CANCELADA', 'STATUS_AGENDADA', 'STATUS_PREPARADA'] } },
  orderBy: [{ criado_em: 'desc' as const }, { id: 'desc' as const }], take: 1,
  select: { acao: true, criado_em: true },
};
export function inicioAoVivo(auditoria: { acao: string; criado_em: Date }[], agora: Date) {
  const ultimo = auditoria[0];
  return ultimo?.acao === 'STATUS_AO_VIVO' && ultimo.criado_em.getTime() <= agora.getTime() ? ultimo.criado_em : null;
}
export function passou24h(inicio: Date | null, agora: Date) {
  return inicio !== null && agora.getTime() - inicio.getTime() > DIA;
}
export class ErroRevisao extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function consultarLembrete(banco: Banco, partidaId: number, agora = new Date()) {
  const p = await banco.partida.findUnique({ where: { id: partidaId }, select: {
    id: true, status: true, organizador_id: true, sumula_clube_id: true, categoria_id: true, auditoria: inicioSelect,
    mandante: { select: { nome: true } }, visitante: { select: { nome: true } },
  } });
  if (!p) throw new ErroRevisao(404, 'Partida não encontrada.');
  if (p.status !== 'AO_VIVO') throw new ErroRevisao(409, 'A partida já não está ao vivo. Atualize a lista.');
  const inicio = inicioAoVivo(p.auditoria, agora);
  if (inicio && !passou24h(inicio, agora)) throw new ErroRevisao(409, 'A partida ainda não completou mais de 24 horas ao vivo.');
  const organizador = p.organizador_id ? await banco.clube.findUnique({ where: { id: p.organizador_id }, select: { id: true, nome: true, ativo: true } }) : null;
  const [vinculos, ultimo] = await Promise.all([
    organizador?.ativo ? banco.usuarioClube.findMany({ where: {
      clube_id: organizador.id, usuario: { suspenso: false },
      OR: [{ papel: 'ADMIN' }, { papel: 'TECNICO', OR: [{ acesso_todas_categorias: true }, { categorias: { some: { categoria_id: p.categoria_id } } }] }],
    }, select: { papel: true, usuario: { select: { id: true, nome: true, email: true } } }, orderBy: { id: 'asc' } }) : [],
    banco.auditoriaPartida.findFirst({ where: { partida_id: p.id, acao: ACAO_LEMBRETE }, orderBy: [{ criado_em: 'desc' }, { id: 'desc' }], select: { criado_em: true } }),
  ]);
  const disponivelEm = ultimo ? new Date(ultimo.criado_em.getTime() + DIA) : null;
  return { partida: p, inicio, organizador, gestores: vinculos.map(v => ({ ...v.usuario, papel: v.papel })),
    ultimoEnvio: ultimo?.criado_em ?? null, disponivelEm, podeEnviar: !!organizador?.ativo && vinculos.length > 0 && (!disponivelEm || agora >= disponivelEm) };
}

export async function enviarLembrete(banco: PrismaClient, partidaId: number, destinatarioId: number, operadorId: number, agora = new Date()) {
  return banco.$transaction(async tx => {
    // Serializa os cliques de todos os operadores para esta partida.
    await tx.$queryRaw`SELECT id FROM "Partida" WHERE id = ${partidaId} FOR UPDATE`;
    const ctx = await consultarLembrete(tx, partidaId, agora);
    if (!ctx.organizador?.ativo) throw new ErroRevisao(409, 'O organizador não está disponível.');
    if (!ctx.gestores.some(g => g.id === destinatarioId)) throw new ErroRevisao(400, 'Selecione um gestor habilitado do clube organizador.');
    if (!ctx.podeEnviar) throw new ErroRevisao(409, 'Um lembrete já foi enviado nas últimas 24 horas.');
    const titulo = 'Revise a partida ainda ao vivo';
    const encerramento = ctx.partida.sumula_clube_id && ctx.partida.sumula_clube_id !== ctx.organizador.id
      ? 'Confira se já terminou e solicite ao responsável pela súmula o encerramento para atualizar o Scout.'
      : 'Confira se já terminou e finalize a súmula, se necessário, para atualizar o Scout.';
    const corpo = `${ctx.partida.mandante.nome} × ${ctx.partida.visitante.nome}. ${ctx.inicio ? 'A partida está há mais de 24 horas ao vivo.' : 'A partida consta como ao vivo, mas o início não foi registrado.'} ${encerramento}`;
    const dados = { acao: 'REVISAR_ENCERRAMENTO', partidaId, clubeId: ctx.organizador.id };
    const notificacao = await tx.notificacao.create({ data: { usuario_id: destinatarioId, clube_id: ctx.organizador.id,
      partida_id: partidaId, tipo: 'PARTIDA_AGENDADA', titulo, corpo, dados } });
    await tx.auditoriaPartida.create({ data: { partida_id: partidaId, clube_id: ctx.organizador.id, usuario_id: operadorId,
      acao: ACAO_LEMBRETE, dados: { destinatario_id: destinatarioId, notificacao_id: notificacao.id }, criado_em: agora } });
    return { notificacao, dados };
  }, { timeout: 10_000 });
}
