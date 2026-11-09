import { randomBytes } from 'node:crypto';
import { prisma } from '../../lib/prisma';
import { enviarEmailConvite } from '../../services/email';
import { gerarCodigoConvite, gerarHashCodigoConvite, gerarHashConvite } from '../convites/convite.utils';
import { iniciarRecuperacao } from '../../services/iniciar-recuperacao';

export function emailMascarado(email: string) {
  const [nome, dominio] = email.split('@');
  return `${nome[0]}***@${dominio}`;
}

export async function executarEnvio(input: { requestId: string; chamadoId: string; operadorId: number; tipo: string; alvoId: string }, enviarConvite = enviarEmailConvite, recuperar = iniciarRecuperacao) {
  const c = await prisma.suporteChamado.findUniqueOrThrow({ where: { id: input.chamadoId } });
  const alvo = `${input.tipo}:${input.alvoId}`;
  const reserva = await prisma.$transaction(async tx => {
    const anterior = await tx.suporteAcao.findUnique({ where: { requestId: input.requestId } });
    if (anterior) {
      if (anterior.chamadoId !== c.id || anterior.alvo !== alvo) throw new Error('IDEMPOTENCIA');
      return anterior;
    }
    const historico = await tx.suporteAcao.findMany({ where: { alvo, criadoEm: { gte: new Date(Date.now() - 86400000) } }, orderBy: { criadoEm: 'desc' } });
    if (historico.length >= 3 || historico[0] && Date.now() - historico[0].criadoEm.getTime() < 60000) throw new Error('LIMITE_ENVIO');
    await tx.suporteAcao.create({ data: { requestId: input.requestId, chamadoId: input.chamadoId, operadorId: input.operadorId, tipo: input.tipo, alvo } });
    return null;
  }, { isolationLevel: 'Serializable' });
  if (reserva) return reserva.resultado;
  let resultado = 'FALHOU';
  try {
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) resultado = 'PROVEDOR_NAO_CONFIGURADO';
    else if (input.tipo === 'CONVITE') {
      const convite = await prisma.conviteClube.findFirst({ where: { id: input.alvoId, clube_id: c.clubeId || -1 }, include: { clube: true, criadoPor: true } });
      if (!convite?.email || convite.status !== 'PENDENTE' || !convite.clube.ativo) resultado = 'CONVITE_INDISPONIVEL';
      else {
        const token = randomBytes(32).toString('base64url');
        const codigo = gerarCodigoConvite();
        const atualizado = await prisma.conviteClube.updateMany({ where: { id: convite.id, status: 'PENDENTE', token_hash: convite.token_hash }, data: {
          token_hash: gerarHashConvite(token), codigo_hash: gerarHashCodigoConvite(codigo), expira_em: new Date(Date.now() + 72 * 3600000),
        } });
        if (!atualizado.count) resultado = 'ALTERADO_POR_OUTRA_OPERACAO';
        else {
          await enviarConvite({ email: convite.email, nomeClube: convite.clube.nome, nomeConvidante: convite.criadoPor?.nome || 'Equipe Ludora', token, codigo });
          resultado = 'ACEITO_PELO_PROVEDOR';
        }
      }
    } else if (input.tipo === 'RECUPERACAO' && c.usuarioId === Number(input.alvoId)) {
      const u = await prisma.usuario.findUniqueOrThrow({ where: { id: c.usuarioId } });
      resultado = await recuperar(u.email);
    }
  } catch { resultado = 'FALHA_NO_ENVIO'; }
  await prisma.$transaction([
    prisma.suporteAcao.update({ where: { requestId: input.requestId }, data: { resultado } }),
    prisma.suporteHistorico.create({ data: { chamadoId: c.id, operadorId: input.operadorId, acao: input.tipo, motivo: resultado } }),
  ]);
  return resultado;
}
