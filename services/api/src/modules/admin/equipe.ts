import { Router, type RequestHandler } from 'express';
import { getUsuarioId } from '../../auth/jwt';
import { prisma } from '../../lib/prisma';
import { papelPlataformaEfetivo } from './admin.rules';

// Reconsulta o banco em cada requisição para respeitar mudanças de cargo.
export const exigirEquipe: RequestHandler = async (req, res, next) => {
  try {
    const id = await getUsuarioId(req, true);
    if (!id) { res.status(401).json({ error: 'Entre para continuar.' }); return; }
    const usuario = await prisma.usuario.findUnique({
      where: { id }, select: { id: true, nome: true, email: true, papel_plataforma: true },
    });
    if (!usuario || papelPlataformaEfetivo(usuario) === 'USUARIO') {
      res.status(403).json({ error: 'Acesso restrito aos funcionários Ludora.' }); return;
    }
    res.locals.funcionario = { ...usuario, papel_plataforma: papelPlataformaEfetivo(usuario) };
    (req as any).usuarioId = usuario.id;
    next();
  } catch {
    res.status(503).json({ error: 'A verificação de acesso está indisponível. Tente novamente em instantes.' });
  }
};

export const exigirAcessoTecnico: RequestHandler = (req, res, next) => {
  void exigirEquipe(req, res, () => {
    if (!['SUPERADMIN', 'DESENVOLVEDOR'].includes(res.locals.funcionario.papel_plataforma)) {
      res.status(403).json({ error: 'Acesso restrito à administração e ao desenvolvimento.' });
      return;
    }
    next();
  });
};

export function criarEquipeRoutes() {
  const router = Router();
  router.get('/admin/equipe/me', exigirEquipe, (_req, res) => {
    res.json({ usuario: res.locals.funcionario });
  });
  router.get('/admin/equipe/diagnostico', exigirEquipe, async (_req, res, next) => {
    try {
      const inicio = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        banco: 'disponivel', latenciaMs: Date.now() - inicio, consultadoEm: new Date().toISOString(),
        emailConfigurado: Boolean(process.env.RESEND_API_KEY),
        paulistaHabilitado: process.env.PAULISTA_ENABLED === 'true',
      });
    } catch (error) { next(error); }
  });
  return router;
}
