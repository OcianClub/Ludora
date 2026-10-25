import type { NextFunction, Request, Response } from 'express';
import type { Server } from 'socket.io';

import { getUsuarioId, getUsuarioIdPeloToken } from '../../auth/jwt';
import { prisma } from '../../lib/prisma';
import {
  BufferLogs,
  ehSuperAdmin,
  limparCaminho,
  nivelPorStatus,
  parseSuperAdmins,
} from './admin.rules';

// Buffer único, compartilhado pelo logger HTTP, pelas rotas e pelo socket.
export const logs = new BufferLogs(500);

export interface SuperAdmin {
  id: number;
  nome: string;
  email: string;
}

// Lido a cada chamada (barato) para respeitar o .env já carregado por config/env.
export async function carregarSuperAdmin(usuarioId: number | null): Promise<SuperAdmin | null> {
  if (!usuarioId) return null;
  const lista = parseSuperAdmins(process.env.SUPERADMIN_EMAILS);
  if (lista.size === 0) return null; // sem allowlist configurada, ninguém é super admin

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, nome: true, email: true },
  });
  return usuario && ehSuperAdmin(usuario.email, lista) ? usuario : null;
}

export async function exigirSuperAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const usuarioId = await getUsuarioId(req);
    if (!usuarioId) return res.status(401).json({ error: 'Não autorizado' });

    const admin = await carregarSuperAdmin(usuarioId);
    if (!admin) {
      logs.registrar({
        nivel: 'warn',
        tipo: 'audit',
        mensagem: 'Acesso negado ao painel Super Admin',
        usuarioId,
        caminho: limparCaminho(req.originalUrl),
      });
      return res.status(403).json({ error: 'Acesso restrito à equipe Ludora' });
    }

    (req as any).usuarioId = admin.id;
    (req as any).superAdmin = admin;
    next();
  } catch {
    res.status(500).json({ error: 'Erro ao verificar permissão' });
  }
}

// Registra método, caminho (sem query), status e duração. Nunca corpo/headers.
export function registrarRequisicoes(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'OPTIONS') return next();
  const inicio = process.hrtime.bigint();

  res.on('finish', () => {
    const ms = Math.round(Number(process.hrtime.bigint() - inicio) / 1e6);
    const caminho = limparCaminho(req.originalUrl);
    logs.registrar({
      nivel: nivelPorStatus(res.statusCode),
      tipo: 'http',
      mensagem: `${req.method} ${caminho} → ${res.statusCode}`,
      metodo: req.method,
      caminho,
      status: res.statusCode,
      ms,
      usuarioId: (req as any).usuarioId ?? null,
    });
  });
  next();
}

// Namespace /admin: o socket principal exige clubeId, então o painel usa o seu.
export function registrarNamespaceAdmin(io: Server) {
  const ns = io.of('/admin');

  ns.use(async (socket, next) => {
    try {
      const cabecalho = String(socket.handshake.headers.authorization || '');
      const token = String(socket.handshake.auth?.token || cabecalho.replace(/^Bearer\s+/i, ''));
      const admin = await carregarSuperAdmin(await getUsuarioIdPeloToken(token));
      if (!admin) return next(new Error('Não autorizado'));
      socket.data.superAdmin = admin;
      next();
    } catch {
      next(new Error('Não autorizado'));
    }
  });

  ns.on('connection', socket => {
    socket.emit('snapshot', logs.snapshot(100));
    logs.registrar({
      nivel: 'audit',
      tipo: 'audit',
      mensagem: `Painel conectado: ${socket.data.superAdmin.email}`,
      usuarioId: socket.data.superAdmin.id,
    });
  });

  logs.assinar(entrada => ns.emit('log', entrada));
}
