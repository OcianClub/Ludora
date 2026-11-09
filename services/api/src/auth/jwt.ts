import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

import { JWT_AUDIENCE, JWT_ISSUER, JWT_SECRET } from '../config/env';

export async function getUsuarioIdPeloToken(
  token: string,
  banco = prisma,
  propagarFalhaBanco = false,
): Promise<number | null> {
  let decoded: jwt.JwtPayload;
  try {
    if (!token) return null;
    decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as jwt.JwtPayload;
  } catch { return null; }
  try {
    const id = Number(decoded.id);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    const usuario = await banco.usuario.findUnique({
      where: { id },
      select: { versao_sessao: true, suspenso: true },
    });
    return usuario && !usuario.suspenso && usuario.versao_sessao === (decoded.versao_sessao ?? 0)
      ? id
      : null;
  } catch (error) {
    if (propagarFalhaBanco) throw error;
    return null;
  }
}

export async function getUsuarioId(req: Request, propagarFalhaBanco = false): Promise<number | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  return getUsuarioIdPeloToken(authHeader.slice(7).trim(), prisma, propagarFalhaBanco);
}
