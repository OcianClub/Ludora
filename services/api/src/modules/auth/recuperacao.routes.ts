import { Router } from 'express';
import * as bcrypt from 'bcrypt';
import type { Server } from 'socket.io';

import { JWT_SECRET } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { limitarRecuperacao } from '../../middlewares/rate-limit.middleware';
import {
  emailRecuperacaoConfigurado,
  enviarEmailRecuperacao,
} from '../../services/email-recuperacao';
import {
  codigoRecuperacaoValido,
  gerarCodigoRecuperacao,
  hashCodigoRecuperacao,
  hashesRecuperacaoIguais,
  INTERVALO_REENVIO_MS,
  MAX_TENTATIVAS_RECUPERACAO,
  VALIDADE_RECUPERACAO_MS,
} from './recuperacao.utils';

const MENSAGEM_ENVIO =
  'Se houver uma conta com este e-mail, você receberá um código para redefinir a senha.';
const MENSAGEM_CODIGO =
  'Código inválido, expirado ou já utilizado. Confira o e-mail e o código ou solicite um novo.';

function emailValido(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function criarRecuperacaoRoutes(
  io: Server,
  enviarEmail = enviarEmailRecuperacao,
  banco = prisma
) {
  const router = Router();

  router.post('/auth/recuperar-senha', limitarRecuperacao, async (req, res) => {
    const email =
      typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';
    if (!emailValido(email)) {
      return res.status(400).json({ error: 'Informe um e-mail válido.' });
    }
    if (!emailRecuperacaoConfigurado()) {
      return res.status(503).json({
        error: 'A recuperação de senha está indisponível no momento.',
      });
    }

    const usuario = await banco.usuario.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!usuario) return res.status(202).json({ mensagem: MENSAGEM_ENVIO });

    const codigo = gerarCodigoRecuperacao();
    const agora = new Date();
    const dados = {
      codigo_hash: hashCodigoRecuperacao(usuario.id, codigo, JWT_SECRET),
      criado_em: agora,
      expira_em: new Date(agora.getTime() + VALIDADE_RECUPERACAO_MS),
      tentativas: 0,
      usado_em: null,
    };

    const atualizacao = await banco.recuperacaoSenha.updateMany({
      where: {
        usuario_id: usuario.id,
        criado_em: { lte: new Date(agora.getTime() - INTERVALO_REENVIO_MS) },
      },
      data: dados,
    });
    const criacao = atualizacao.count
      ? null
      : await banco.recuperacaoSenha.createMany({
          data: { usuario_id: usuario.id, ...dados },
          skipDuplicates: true,
        });

    if (atualizacao.count || criacao?.count) {
      try {
        await enviarEmail(email, codigo);
      } catch {
        await banco.recuperacaoSenha.deleteMany({
          where: { usuario_id: usuario.id, codigo_hash: dados.codigo_hash },
        });
        console.error(
          'Não foi possível enviar um e-mail de recuperação de senha.'
        );
      }
    }
    return res.status(202).json({ mensagem: MENSAGEM_ENVIO });
  });

  router.post('/auth/redefinir-senha', limitarRecuperacao, async (req, res) => {
    const email =
      typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';
    const codigo = typeof req.body?.codigo === 'string' ? req.body.codigo : '';
    const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
    if (!emailValido(email) || !codigoRecuperacaoValido(codigo)) {
      return res.status(400).json({ error: MENSAGEM_CODIGO });
    }
    if (senha.length < 8) {
      return res
        .status(400)
        .json({ error: 'Use pelo menos 8 caracteres.', code: 'SENHA_CURTA' });
    }
    if (Buffer.byteLength(senha, 'utf8') > 72) {
      return res.status(400).json({
        error: 'Sua senha é muito longa. Use uma senha menor.',
        code: 'SENHA_LONGA',
      });
    }

    const recuperacao = await banco.recuperacaoSenha.findFirst({
      where: {
        usuario: { email },
        usado_em: null,
        expira_em: { gt: new Date() },
        tentativas: { lt: MAX_TENTATIVAS_RECUPERACAO },
      },
    });
    if (!recuperacao) return res.status(400).json({ error: MENSAGEM_CODIGO });

    const codigoHash = hashCodigoRecuperacao(
      recuperacao.usuario_id,
      codigo,
      JWT_SECRET
    );
    if (!hashesRecuperacaoIguais(codigoHash, recuperacao.codigo_hash)) {
      await banco.recuperacaoSenha.updateMany({
        where: {
          id: recuperacao.id,
          codigo_hash: recuperacao.codigo_hash,
          usado_em: null,
          tentativas: { lt: MAX_TENTATIVAS_RECUPERACAO },
        },
        data: { tentativas: { increment: 1 } },
      });
      return res.status(400).json({ error: MENSAGEM_CODIGO });
    }

    const hashSenha = await bcrypt.hash(senha, 12);
    const alterada = await banco.$transaction(async (tx) => {
      const consumo = await tx.recuperacaoSenha.updateMany({
        where: {
          id: recuperacao.id,
          codigo_hash: codigoHash,
          usado_em: null,
          expira_em: { gt: new Date() },
          tentativas: { lt: MAX_TENTATIVAS_RECUPERACAO },
        },
        data: { usado_em: new Date() },
      });
      if (!consumo.count) return false;
      await tx.usuario.update({
        where: { id: recuperacao.usuario_id },
        data: {
          senha: hashSenha,
          versao_sessao: { increment: 1 },
        },
      });
      return true;
    });
    if (!alterada) return res.status(400).json({ error: MENSAGEM_CODIGO });

    io.in(`usuario:${recuperacao.usuario_id}`).disconnectSockets(true);
    return res.json({
      mensagem: 'Senha alterada. Entre novamente com sua nova senha.',
    });
  });

  return router;
}
