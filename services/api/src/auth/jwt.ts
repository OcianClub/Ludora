import type { Request } from 'express';
import jwt from 'jsonwebtoken';

import {
  JWT_AUDIENCE,
  JWT_ISSUER,
  JWT_SECRET,
} from '../config/env';

export function getUsuarioIdPeloToken(token: string): number | null {
  try {
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as jwt.JwtPayload;
    const id = Number(decoded.id);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function getUsuarioId(req: Request): number | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  return getUsuarioIdPeloToken(authHeader.slice(7).trim());
}
