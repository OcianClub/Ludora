import type { RequestHandler } from 'express';

// O desktop usa os endpoints /admin, protegidos pelo papel SUPERADMIN.
export const somenteAdministracaoPlataforma: RequestHandler = (_req, res) =>
  res.status(403).json({ error: 'A edição de times e clubes é exclusiva dos superadministradores pelo desktop Ludora.' });
