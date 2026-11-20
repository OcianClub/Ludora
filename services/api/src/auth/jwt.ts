import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

import { JWT_AUDIENCE, JWT_ISSUER, JWT_SECRET } from '../config/env';

async function verificarUsuario<T extends { versao_sessao: number; suspenso: boolean }>(
  token: string,
  consultar: (id: number) => Promise<T | null>,
  propagarFalhaBanco: boolean,
): Promise<{ id: number; usuario: T } | null> {
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
    const usuario = await consultar(id);
    return usuario && !usuario.suspenso && usuario.versao_sessao === (decoded.versao_sessao ?? 0)
      ? { id, usuario }
      : null;
  } catch (error) {
    if (propagarFalhaBanco) throw error;
    return null;
  }
}

export async function getUsuarioIdPeloToken(token: string, banco = prisma, propagarFalhaBanco = false): Promise<number | null> {
  const resultado = await verificarUsuario(token, id => banco.usuario.findUnique({
    where: { id }, select: { versao_sessao: true, suspenso: true },
  }), propagarFalhaBanco);
  return resultado?.id ?? null;
}

export async function getIdentidadeInterna(token: string, propagarFalhaBanco = false) {
  const resultado = await verificarUsuario(token, id => prisma.usuario.findUnique({
    where: { id }, select: { id: true, nome: true, email: true, papel_plataforma: true, versao_sessao: true, suspenso: true },
  }), propagarFalhaBanco);
  if (!resultado) return null;
  const { id, nome, email, papel_plataforma } = resultado.usuario;
  return { id, nome, email, papel_plataforma };
}

export function tokenDaRequisicao(req: Request) {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

export async function getUsuarioId(req: Request, propagarFalhaBanco = false): Promise<number | null> {
  return getUsuarioIdPeloToken(tokenDaRequisicao(req), prisma, propagarFalhaBanco);
}
