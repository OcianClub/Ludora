import { prisma } from '../lib/prisma';
import { JWT_SECRET } from '../config/env';
import { emailRecuperacaoConfigurado, enviarEmailRecuperacao } from './email-recuperacao';
import { gerarCodigoRecuperacao, hashCodigoRecuperacao, INTERVALO_REENVIO_MS, VALIDADE_RECUPERACAO_MS } from '../modules/auth/recuperacao.utils';

export async function iniciarRecuperacao(email: string, banco = prisma, enviar = enviarEmailRecuperacao) {
  if (!emailRecuperacaoConfigurado()) return 'DESABILITADO';
  const usuario = await banco.usuario.findUnique({ where: { email }, select: { id: true } });
  if (!usuario) return 'SEM_CONTA';
  const codigo = gerarCodigoRecuperacao();
  const agora = new Date();
  const dados = { codigo_hash: hashCodigoRecuperacao(usuario.id, codigo, JWT_SECRET), criado_em: agora,
    expira_em: new Date(agora.getTime() + VALIDADE_RECUPERACAO_MS), tentativas: 0, usado_em: null };
  const atualizado = await banco.recuperacaoSenha.updateMany({ where: {
    usuario_id: usuario.id, criado_em: { lte: new Date(agora.getTime() - INTERVALO_REENVIO_MS) },
  }, data: dados });
  const criado = atualizado.count ? null : await banco.recuperacaoSenha.createMany({ data: { usuario_id: usuario.id, ...dados }, skipDuplicates: true });
  if (!atualizado.count && !criado?.count) return 'LIMITADO';
  try { await enviar(email, codigo); return 'ENVIADO'; }
  catch {
    await banco.recuperacaoSenha.deleteMany({ where: { usuario_id: usuario.id, codigo_hash: dados.codigo_hash } });
    return 'FALHOU';
  }
}
