import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import * as bcrypt from 'bcrypt';

import { JWT_SECRET } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { limitarCadastro } from '../../middlewares/rate-limit.middleware';
import { enviarEmailCadastro } from '../../services/email-cadastro';
import { emailRecuperacaoConfigurado } from '../../services/email-recuperacao';
import { hashCodigoCadastro } from './cadastro.utils';
import {
  codigoRecuperacaoValido,
  gerarCodigoRecuperacao,
  hashesRecuperacaoIguais,
  INTERVALO_REENVIO_MS,
  MAX_TENTATIVAS_RECUPERACAO,
  VALIDADE_RECUPERACAO_MS,
} from './recuperacao.utils';

const ERRO_CODIGO =
  'Código inválido, expirado ou já utilizado. Solicite um novo código se necessário.';

function normalizarEmail(valor: unknown) {
  return typeof valor === 'string' ? valor.trim().toLowerCase() : '';
}

function emailValido(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function criarCadastroRoutes(
  enviarEmail = enviarEmailCadastro,
  banco = prisma
) {
  const router = Router();

  router.post(
    '/auth/cadastro/solicitar-codigo',
    limitarCadastro,
    async (req, res) => {
      const email = normalizarEmail(req.body?.email);
      if (!emailValido(email))
        return res.status(400).json({ error: 'Informe um e-mail válido.' });
      if (!emailRecuperacaoConfigurado()) {
        return res
          .status(503)
          .json({ error: 'O cadastro está indisponível no momento.' });
      }
      const existente = await banco.usuario.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existente)
        return res
          .status(409)
          .json({ error: 'Este e-mail já possui uma conta.' });

      const codigo = gerarCodigoRecuperacao();
      const agora = new Date();
      const desafio = randomBytes(32).toString('hex');
      const dados = {
        desafio,
        codigo_hash: hashCodigoCadastro(desafio, codigo, JWT_SECRET),
        tentativas: 0,
        criado_em: agora,
        expira_em: new Date(agora.getTime() + VALIDADE_RECUPERACAO_MS),
      };
      const atualizacao = await banco.confirmacaoCadastro.updateMany({
        where: {
          email,
          criado_em: { lte: new Date(agora.getTime() - INTERVALO_REENVIO_MS) },
        },
        data: dados,
      });
      const criacao = atualizacao.count
        ? null
        : await banco.confirmacaoCadastro.createMany({
            data: { email, ...dados },
            skipDuplicates: true,
          });
      if (!atualizacao.count && !criacao?.count) {
        res.setHeader('Retry-After', '60');
        return res
          .status(429)
          .json({
            error: 'Aguarde um minuto antes de solicitar outro código.',
          });
      }
      try {
        await enviarEmail(email, codigo);
      } catch {
        await banco.confirmacaoCadastro.deleteMany({
          where: { email, desafio },
        });
        console.error(
          'Não foi possível enviar um e-mail de confirmação de cadastro.'
        );
        return res
          .status(503)
          .json({
            error:
              'Não foi possível enviar o código. Tente novamente em instantes.',
          });
      }
      return res.status(202).json({
        mensagem: 'Enviamos um código para confirmar seu e-mail.',
        cadastro_id: desafio,
        expira_em: dados.expira_em,
      });
    }
  );

  router.post('/auth/registrar', limitarCadastro, async (req, res) => {
    const email = normalizarEmail(req.body?.email);
    const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
    const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
    const codigo = typeof req.body?.codigo === 'string' ? req.body.codigo : '';
    const desafio =
      typeof req.body?.cadastro_id === 'string' ? req.body.cadastro_id : '';
    if (
      !emailValido(email) ||
      nome.length < 2 ||
      nome.length > 100 ||
      senha.length < 8 ||
      Buffer.byteLength(senha, 'utf8') > 72
    ) {
      return res
        .status(400)
        .json({
          error:
            'Confira o nome, e-mail e senha. Use de 8 caracteres a 72 bytes na senha.',
        });
    }
    if (!/^[a-f0-9]{64}$/.test(desafio) || !codigoRecuperacaoValido(codigo)) {
      return res
        .status(400)
        .json({ error: ERRO_CODIGO, code: 'CONFIRMACAO_EMAIL_NECESSARIA' });
    }
    const registro = await banco.confirmacaoCadastro.findFirst({
      where: {
        email,
        desafio,
        expira_em: { gt: new Date() },
        tentativas: { lt: MAX_TENTATIVAS_RECUPERACAO },
      },
    });
    if (!registro) return res.status(400).json({ error: ERRO_CODIGO });
    const hash = hashCodigoCadastro(desafio, codigo, JWT_SECRET);
    if (!hashesRecuperacaoIguais(hash, registro.codigo_hash)) {
      await banco.confirmacaoCadastro.updateMany({
        where: {
          email,
          desafio,
          tentativas: { lt: MAX_TENTATIVAS_RECUPERACAO },
        },
        data: { tentativas: { increment: 1 } },
      });
      return res.status(400).json({ error: ERRO_CODIGO });
    }
    const senhaHash = await bcrypt.hash(senha, 12);
    try {
      const usuario = await banco.$transaction(async (tx) => {
        const consumo = await tx.confirmacaoCadastro.deleteMany({
          where: {
            email,
            desafio,
            codigo_hash: hash,
            expira_em: { gt: new Date() },
            tentativas: { lt: MAX_TENTATIVAS_RECUPERACAO },
          },
        });
        if (!consumo.count) return null;
        return tx.usuario.create({
          data: { nome, email, senha: senhaHash },
          select: { id: true },
        });
      });
      if (!usuario) return res.status(400).json({ error: ERRO_CODIGO });
      return res
        .status(201)
        .json({
          mensagem: 'E-mail confirmado e conta criada.',
          id: usuario.id,
        });
    } catch (error: any) {
      if (error?.code === 'P2002')
        return res
          .status(409)
          .json({ error: 'Este e-mail já possui uma conta.' });
      throw error;
    }
  });

  return router;
}
