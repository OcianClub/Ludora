import { Router, type Request, type Response } from 'express';
import type { PrismaClient, OpcaoPalpite } from '@prisma/client';
import type { Server } from 'socket.io';
import { prisma } from '../../lib/prisma';
import { getUsuarioIdPeloToken } from '../../auth/jwt';
import { idPositivo } from '../../utils/id';
import { limitarRequisicoes } from '../../middlewares/rate-limit.middleware';
import { consultarPalpite, registrarPalpite, ErroPalpite, OPCOES_PALPITE } from './palpites.service';

export function criarPalpitesRoutes(io: Server, banco: PrismaClient = prisma) {
  const router = Router();
  const leitura = limitarRequisicoes({ janelaMs: 60_000, limite: 240, prefixo: 'palpite-leitura', porEmail: false });
  const escrita = limitarRequisicoes({ janelaMs: 60_000, limite: 60, prefixo: 'palpite-escrita', porEmail: false });
  const usuario = (req: Request) => getUsuarioIdPeloToken(req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : '', banco);
  const responderErro = (res: Response, erro: unknown) => {
    if (!(erro instanceof ErroPalpite)) console.error('[palpites] Consulta ou registro indisponível.');
    return res.status(erro instanceof ErroPalpite ? erro.status : 503).json({ error: erro instanceof ErroPalpite ? erro.message : 'A votação está indisponível. Tente novamente em instantes.' });
  };
  async function consultar(req: Request, res: Response, privado: boolean) {
    res.setHeader('Cache-Control', 'no-store');
    const id = idPositivo(req.params.id);
    if (!id) return res.status(400).json({ error: 'Partida inválida.' });
    const usuarioId = privado ? await usuario(req) : undefined;
    if (privado && !usuarioId) return res.status(401).json({ error: 'Entre na sua conta para votar.' });
    try { return res.json(await consultarPalpite(banco, id, usuarioId || undefined)); }
    catch (erro) { return responderErro(res, erro); }
  }
  router.get('/publico/partidas/:id/palpite', leitura, (req, res) => consultar(req, res, false));
  // Qualquer conta pode votar, sem exigir cargo ou associação ao clube.
  router.get('/partidas/:id/palpite', leitura, (req, res) => consultar(req, res, true));
  router.put('/partidas/:id/palpite', escrita, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const id = idPositivo(req.params.id);
    if (!id || !OPCOES_PALPITE.includes(req.body?.escolha)) return res.status(400).json({ error: 'Escolha mandante, empate ou visitante.' });
    const usuarioId = await usuario(req);
    if (!usuarioId) return res.status(401).json({ error: 'Entre na sua conta para votar.' });
    try {
      const { resultado, clubes, alterado } = await registrarPalpite(banco, id, usuarioId, req.body.escolha as OpcaoPalpite);
      if (alterado) {
        const { meuVoto: _privado, ...publico } = resultado;
        // Um único broadcast por namespace; nomes ou identidades de quem votou nunca são enviados.
        io.to(clubes.map(clube => `clube:${clube}`)).emit('palpite_atualizado', publico);
        io.of('/publico').to(clubes.map(clube => `publico:clube:${clube}`)).emit('palpite_atualizado', publico);
      }
      return res.json(resultado);
    } catch (erro) { return responderErro(res, erro); }
  });
  return router;
}
