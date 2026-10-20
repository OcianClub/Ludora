import { Router } from 'express';
import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

import { JWT_OPTIONS, JWT_SECRET } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { exigirAutenticacao } from '../../middlewares/auth.middleware';
import { limitarAuth } from '../../middlewares/rate-limit.middleware';

const router = Router();

router.post('/auth/login', limitarAuth, async (req, res) => {
  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase();
  const senha = String(req.body?.senha || '');
  if (!email || !senha || email.length > 254 || senha.length > 128) {
    return res.status(400).json({ error: 'Credenciais inválidas' });
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: {
      clubes: {
        include: { clube: true },
      },
    },
  });

  if (!usuario)
    return res.status(401).json({ error: 'E-mail ou senha inválidos' });

  const senhaValida = await bcrypt.compare(senha, usuario.senha);
  if (!senhaValida)
    return res.status(401).json({ error: 'E-mail ou senha inválidos' });

  const token = jwt.sign(
    { id: usuario.id, versao_sessao: usuario.versao_sessao },
    JWT_SECRET,
    JWT_OPTIONS
  );

  const clubesDoUsuario = usuario.clubes.map((vinculo) => ({
    clube_id: vinculo.clube.id,
    nome: vinculo.clube.nome,
    escudo: vinculo.clube.escudo,
    papel: vinculo.papel,
  }));

  res.json({
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      criadoEm: usuario.criadoEm,
    },
    nome: usuario.nome,
    criadoEm: usuario.criadoEm,
    email: usuario.email,
    clubes: clubesDoUsuario,
  });
});

router.get('/usuarios/me', exigirAutenticacao, async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: (req as any).usuarioId },
      select: {
        id: true,
        nome: true,
        email: true,
        criadoEm: true,
        notificacoes_ativas: true,
        clubes: {
          orderBy: { clube: { nome: 'asc' } },
          select: {
            papel: true,
            clube: {
              select: {
                id: true,
                nome: true,
                escudo: true,
                cidade: true,
                estado: true,
                plano: true,
              },
            },
          },
        },
      },
    });

    if (!usuario)
      return res.status(404).json({ error: 'Usuário não encontrado' });

    res.json({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      criadoEm: usuario.criadoEm,
      notificacoes_ativas: usuario.notificacoes_ativas,
      clubes: usuario.clubes.map((vinculo) => ({
        ...vinculo.clube,
        meuPapel: vinculo.papel,
      })),
    });
  } catch {
    res.status(500).json({ error: 'Não foi possível carregar o perfil' });
  }
});

router.patch(
  '/usuarios/me/notificacoes',
  exigirAutenticacao,
  async (req, res) => {
    const ativa = req.body?.ativa;
    if (typeof ativa !== 'boolean') {
      return res
        .status(400)
        .json({ error: 'A preferência de notificações deve ser booleana' });
    }

    try {
      const usuario = await prisma.usuario.update({
        where: { id: (req as any).usuarioId },
        data: { notificacoes_ativas: ativa },
        select: { notificacoes_ativas: true },
      });
      res.json({ ativa: usuario.notificacoes_ativas });
    } catch {
      res.status(500).json({
        error: 'Não foi possível atualizar a preferência de notificações',
      });
    }
  }
);

router.patch('/usuarios/me', exigirAutenticacao, async (req, res) => {
  const nome = String(req.body?.nome || '').trim();
  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase();
  const senha = req.body?.senha == null ? '' : String(req.body.senha);
  if (
    nome.length < 2 ||
    nome.length > 100 ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    (senha && (senha.length < 8 || senha.length > 128))
  ) {
    return res.status(400).json({ error: 'Dados de usuário inválidos' });
  }
  try {
    const data: any = { nome, email };
    if (senha) data.senha = await bcrypt.hash(senha, 12);
    const usuario = await prisma.usuario.update({
      where: { id: (req as any).usuarioId },
      data,
    });
    res.json({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      criadoEm: usuario.criadoEm,
    });
  } catch {
    res.status(400).json({ error: 'Não foi possível atualizar os dados' });
  }
});

router.delete('/usuarios/me', exigirAutenticacao, async (req, res) => {
  try {
    await prisma.usuario.delete({ where: { id: (req as any).usuarioId } });
    res.json({ mensagem: 'Conta excluída com sucesso' });
  } catch {
    res.status(400).json({ error: 'Não foi possível excluir a conta' });
  }
});

export default router;
