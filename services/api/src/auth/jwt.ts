import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

import { JWT_AUDIENCE, JWT_ISSUER, JWT_SECRET } from '../config/env';

export async function getUsuarioIdPeloToken(
  token: string,
  banco = prisma
): Promise<number | null> {
  try {
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as jwt.JwtPayload;
    const id = Number(decoded.id);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    const usuario = await banco.usuario.findUnique({
      where: { id },
      select: { versao_sessao: true },
    });
    return usuario && usuario.versao_sessao === (decoded.versao_sessao ?? 0)
      ? id
      : null;
  } catch {
    return null;
  }
}

export async function getUsuarioId(req: Request): Promise<number | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  return getUsuarioIdPeloToken(authHeader.slice(7).trim());
}
