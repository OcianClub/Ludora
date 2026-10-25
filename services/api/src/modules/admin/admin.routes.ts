import axios from 'axios';
import { Router } from 'express';
import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { Server } from 'socket.io';

import { PYTHON_AI_URL } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { idPositivo } from '../../utils/id';
import { validarCargo } from '../clubes/membros.rules';
import {
  SUBS_PADRAO,
  parseSuperAdmins,
  tipoCategoriaPorIdade,
  validarBusca,
  validarClube,
  validarLimite,
  type NivelLog,
} from './admin.rules';
import { exigirSuperAdmin, logs } from './superadmin';

class ErroHttp extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

type Handler = (req: Request, res: Response) => Promise<unknown>;

// Converte ErroHttp/erros de validação em respostas; o resto vira 500 genérico.
const rota = (handler: Handler) => async (req: Request, res: Response) => {
  try {
    await handler(req, res);
  } catch (erro) {
    if (erro instanceof ErroHttp) return res.status(erro.status).json({ error: erro.message });
    if ((erro as any)?.code === 'P2034') {
      return res.status(409).json({ error: 'Outra alteração ocorreu. Atualize e tente novamente.' });
    }
    console.error('Erro no painel admin:', (erro as Error)?.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const validar = <T>(fn: () => T): T => {
  try {
    return fn();
  } catch (erro) {
    throw new ErroHttp(400, (erro as Error).message);
  }
};

const auditar = (req: Request, mensagem: string) =>
  logs.registrar({
    nivel: 'audit',
    tipo: 'audit',
    mensagem,
    usuarioId: (req as any).usuarioId,
  });

const idDe = (valor: unknown, nome: string) => {
  const id = idPositivo(valor);
  if (!id) throw new ErroHttp(400, `${nome} inválido`);
  return id;
};

export function criarAdminRoutes(io: Server) {
  const router = Router();
  router.use('/admin', exigirSuperAdmin);

  // ── Sessão ────────────────────────────────────────────────────────────────
  router.get('/admin/me', rota(async (req, res) => {
    res.json({ superadmin: true, usuario: (req as any).superAdmin });
  }));

  // ── Visão global ──────────────────────────────────────────────────────────
  router.get('/admin/overview', rota(async (_req, res) => {
    const [clubes, usuarios, jogadores, partidas, aoVivo, jogPorCat, partPorCat, categorias] =
      await Promise.all([
        prisma.clube.findMany({
          orderBy: { id: 'asc' },
          include: { _count: { select: { usuarios: true, categorias: true, competicoes: true } } },
        }),
        prisma.usuario.count(),
        prisma.jogador.count(),
        prisma.partida.count(),
        prisma.partida.count({ where: { status: 'AO_VIVO' } }),
        prisma.jogador.groupBy({ by: ['categoria_id'], _count: { _all: true } }),
        prisma.partida.groupBy({ by: ['categoria_id'], _count: { _all: true } }),
        prisma.categoria.findMany({ select: { id: true, clube_id: true } }),
      ]);

    const clubePorCategoria = new Map(categorias.map(c => [c.id, c.clube_id]));
    const somar = (linhas: { categoria_id: number; _count: { _all: number } }[]) => {
      const mapa = new Map<number, number>();
      for (const l of linhas) {
        const clubeId = clubePorCategoria.get(l.categoria_id);
        if (clubeId) mapa.set(clubeId, (mapa.get(clubeId) || 0) + l._count._all);
      }
      return mapa;
    };
    const jogPorClube = somar(jogPorCat);
    const partPorClube = somar(partPorCat);

    res.json({
      totais: { clubes: clubes.length, usuarios, jogadores, partidas, partidasAoVivo: aoVivo },
      conexoes: {
        principal: io.of('/').sockets.size,
        admin: io.of('/admin').sockets.size,
      },
      clubes: clubes.map(c => ({
        id: c.id,
        nome: c.nome,
        escudo: c.escudo,
        cidade: c.cidade,
        estado: c.estado,
        plano: c.plano,
        criado_em: c.criado_em,
        membros: c._count.usuarios,
        categorias: c._count.categorias,
        competicoes: c._count.competicoes,
        jogadores: jogPorClube.get(c.id) || 0,
        partidas: partPorClube.get(c.id) || 0,
      })),
    });
  }));

  // ── Clubes ────────────────────────────────────────────────────────────────
  router.post('/admin/clubes', rota(async (req, res) => {
    const dados = validar(() => validarClube(req.body, { criando: true }));
    const adminEmail = String(req.body?.admin_email || '').trim().toLowerCase();
    const criarCategorias = req.body?.categorias_padrao !== false;

    const clube = await prisma.$transaction(async tx => {
      const dono = adminEmail
        ? await tx.usuario.findUnique({ where: { email: adminEmail }, select: { id: true } })
        : null;
      if (adminEmail && !dono) {
        throw new ErroHttp(400, 'Nenhum usuário com este e-mail. Peça para criar a conta no app primeiro.');
      }

      const novo = await tx.clube.create({
        data: { nome: dados.nome!, cidade: dados.cidade, estado: dados.estado, plano: dados.plano ?? 'TRIAL', escudo: dados.escudo },
      });

      if (criarCategorias) {
        await tx.categoria.createMany({
          data: SUBS_PADRAO.map(idade => ({
            nome: `sub-${idade}`,
            faixaIdade: idade,
            tipo: tipoCategoriaPorIdade(idade),
            clube_id: novo.id,
          })),
        });
      }
      if (dono) {
        await tx.usuarioClube.create({
          data: { usuario_id: dono.id, clube_id: novo.id, papel: 'ADMIN', acesso_todas_categorias: true },
        });
      }
      return novo;
    });

    auditar(req, `Clube criado: #${clube.id} ${clube.nome} (${clube.plano})`);
    res.status(201).json(clube);
  }));

  router.patch('/admin/clubes/:id', rota(async (req, res) => {
    const id = idDe(req.params.id, 'Clube');
    const dados = validar(() => validarClube(req.body, { criando: false }));
    if (Object.keys(dados).length === 0) throw new ErroHttp(400, 'Nada para atualizar');

    const existe = await prisma.clube.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new ErroHttp(404, 'Clube não encontrado');

    const clube = await prisma.clube.update({ where: { id }, data: dados });
    auditar(req, `Clube atualizado: #${id} (${Object.keys(dados).join(', ')})`);
    res.json(clube);
  }));

  // ── Membros e permissões ──────────────────────────────────────────────────
  router.get('/admin/clubes/:id/membros', rota(async (req, res) => {
    const clubeId = idDe(req.params.id, 'Clube');
    const [categorias, membros] = await Promise.all([
      prisma.categoria.findMany({ where: { clube_id: clubeId }, select: { id: true, nome: true }, orderBy: { faixaIdade: 'asc' } }),
      prisma.usuarioClube.findMany({
        where: { clube_id: clubeId },
        orderBy: { id: 'asc' },
        select: {
          papel: true,
          acesso_todas_categorias: true,
          usuario: { select: { id: true, nome: true, email: true } },
          categorias: { select: { categoria_id: true } },
        },
      }),
    ]);
    res.json({ categorias, membros });
  }));

  router.put('/admin/clubes/:id/membros/:usuarioId', rota(async (req, res) => {
    const clubeId = idDe(req.params.id, 'Clube');
    const usuarioId = idDe(req.params.usuarioId, 'Usuário');
    const entrada = validar(() => validarCargo(req.body));

    await prisma.$transaction(async tx => {
      const [clube, usuario, validas, atual] = await Promise.all([
        tx.clube.findUnique({ where: { id: clubeId }, select: { id: true } }),
        tx.usuario.findUnique({ where: { id: usuarioId }, select: { id: true } }),
        tx.categoria.count({ where: { id: { in: entrada.ids }, clube_id: clubeId } }),
        tx.usuarioClube.findUnique({ where: { usuario_id_clube_id: { usuario_id: usuarioId, clube_id: clubeId } } }),
      ]);
      if (!clube) throw new ErroHttp(404, 'Clube não encontrado');
      if (!usuario) throw new ErroHttp(404, 'Usuário não encontrado');
      if (validas !== entrada.ids.length) throw new ErroHttp(400, 'Categoria de outro clube');

      if (atual?.papel === 'ADMIN' && entrada.papel !== 'ADMIN') {
        const outros = await tx.usuarioClube.count({ where: { clube_id: clubeId, papel: 'ADMIN', usuario_id: { not: usuarioId } } });
        if (outros === 0) throw new ErroHttp(409, 'Este é o último administrador do clube. Promova outro antes.');
      }

      if (atual) {
        await tx.usuarioClubeCategoria.deleteMany({ where: { usuario_clube_id: atual.id } });
        await tx.usuarioClube.update({
          where: { id: atual.id },
          data: {
            papel: entrada.papel,
            acesso_todas_categorias: entrada.acessoTotal,
            categorias: { create: entrada.ids.map(categoria_id => ({ categoria_id })) },
          },
        });
      } else {
        await tx.usuarioClube.create({
          data: {
            usuario_id: usuarioId,
            clube_id: clubeId,
            papel: entrada.papel,
            acesso_todas_categorias: entrada.acessoTotal,
            categorias: { create: entrada.ids.map(categoria_id => ({ categoria_id })) },
          },
        });
      }
    }, { isolationLevel: 'Serializable' });

    auditar(req, `Permissão: usuário #${usuarioId} → ${entrada.papel} no clube #${clubeId}`);
    res.json({ ok: true });
  }));

  router.delete('/admin/clubes/:id/membros/:usuarioId', rota(async (req, res) => {
    const clubeId = idDe(req.params.id, 'Clube');
    const usuarioId = idDe(req.params.usuarioId, 'Usuário');

    await prisma.$transaction(async tx => {
      const atual = await tx.usuarioClube.findUnique({ where: { usuario_id_clube_id: { usuario_id: usuarioId, clube_id: clubeId } } });
      if (!atual) throw new ErroHttp(404, 'Vínculo não encontrado');
      if (atual.papel === 'ADMIN') {
        const outros = await tx.usuarioClube.count({ where: { clube_id: clubeId, papel: 'ADMIN', usuario_id: { not: usuarioId } } });
        if (outros === 0) throw new ErroHttp(409, 'Este é o último administrador do clube. Promova outro antes.');
      }
      await tx.usuarioClube.delete({ where: { id: atual.id } });
    }, { isolationLevel: 'Serializable' });

    auditar(req, `Vínculo removido: usuário #${usuarioId} do clube #${clubeId}`);
    res.json({ ok: true });
  }));

  // ── Usuários ──────────────────────────────────────────────────────────────
  router.get('/admin/usuarios', rota(async (req, res) => {
    const busca = validarBusca(req.query.busca);
    const limite = validarLimite(req.query.limite, 50, 200);
    const lista = parseSuperAdmins(process.env.SUPERADMIN_EMAILS);

    const usuarios = await prisma.usuario.findMany({
      where: busca
        ? { OR: [{ nome: { contains: busca, mode: 'insensitive' } }, { email: { contains: busca, mode: 'insensitive' } }] }
        : undefined,
      orderBy: { id: 'desc' },
      take: limite,
      // Seleção explícita: o hash da senha nunca sai do banco.
      select: {
        id: true,
        nome: true,
        email: true,
        criadoEm: true,
        clubes: { select: { papel: true, clube: { select: { id: true, nome: true } } } },
      },
    });

    res.json(usuarios.map(u => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      criadoEm: u.criadoEm,
      superadmin: lista.has(u.email.toLowerCase()),
      clubes: u.clubes.map(v => ({ clube_id: v.clube.id, nome: v.clube.nome, papel: v.papel })),
    })));
  }));

  router.post('/admin/usuarios/:id/revogar-sessoes', rota(async (req, res) => {
    const id = idDe(req.params.id, 'Usuário');
    const existe = await prisma.usuario.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new ErroHttp(404, 'Usuário não encontrado');
    await prisma.usuario.update({ where: { id }, data: { versao_sessao: { increment: 1 } } });
    auditar(req, `Sessões revogadas: usuário #${id}`);
    res.json({ ok: true });
  }));

  // ── Prisma / banco ────────────────────────────────────────────────────────
  router.get('/admin/db/status', rota(async (_req, res) => {
    const t0 = Date.now();
    const [info] = await prisma.$queryRaw<{ agora: Date; versao: string }[]>`select now() as agora, version() as versao`;
    const latenciaMs = Date.now() - t0;

    const aplicadas = await prisma.$queryRaw<{
      migration_name: string;
      finished_at: Date | null;
      rolled_back_at: Date | null;
    }[]>`select migration_name, finished_at, rolled_back_at from "_prisma_migrations" order by started_at asc`;

    // Pastas de migration que acompanham este build da API. O caminho muda entre
    // o código compilado (dist/src/...) e o dev com tsx (src/...), então testamos os dois.
    let locais: string[] | null = null;
    for (const relativo of ['../../../../prisma/migrations', '../../../prisma/migrations']) {
      try {
        const pasta = path.resolve(__dirname, relativo);
        locais = fs.readdirSync(pasta, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();
        break;
      } catch { /* tenta o próximo */ }
    }

    const concluidas = new Set(aplicadas.filter(m => m.finished_at && !m.rolled_back_at).map(m => m.migration_name));
    const pendentes = locais ? locais.filter(nome => !concluidas.has(nome)) : null;
    const falhas = aplicadas.filter(m => !m.finished_at || m.rolled_back_at).map(m => m.migration_name);

    const [clubes, usuarios, vinculos, categorias, times, jogadores, competicoes, partidas, eventos, escalacoes, notificacoes, convites, dispositivos] =
      await Promise.all([
        prisma.clube.count(), prisma.usuario.count(), prisma.usuarioClube.count(), prisma.categoria.count(),
        prisma.time.count(), prisma.jogador.count(), prisma.competicao.count(), prisma.partida.count(),
        prisma.evento.count(), prisma.escalacaoPartida.count(), prisma.notificacao.count(),
        prisma.conviteClube.count(), prisma.dispositivoPush.count(),
      ]);

    res.json({
      conectado: true,
      latenciaMs,
      versaoPostgres: info.versao.split(' ').slice(0, 2).join(' '),
      horaServidor: info.agora,
      migracoes: { aplicadas: aplicadas.length, locais: locais?.length ?? null, pendentes, falhas },
      tabelas: { clubes, usuarios, vinculos, categorias, times, jogadores, competicoes, partidas, eventos, escalacoes, notificacoes, convites, dispositivos },
    });
  }));

  // ── Integrações e sistema ─────────────────────────────────────────────────
  router.get('/admin/sistema', rota(async (_req, res) => {
    let scout: { configurado: boolean; acessivel: boolean | null; ms?: number } = { configurado: !!PYTHON_AI_URL, acessivel: null };
    if (PYTHON_AI_URL) {
      const t0 = Date.now();
      try {
        // Qualquer resposta HTTP (mesmo 404) prova que o serviço está de pé.
        await axios.get(PYTHON_AI_URL, { timeout: 4000, validateStatus: () => true });
        scout = { configurado: true, acessivel: true, ms: Date.now() - t0 };
      } catch {
        scout = { configurado: true, acessivel: false };
      }
    }

    const memoria = process.memoryUsage();
    res.json({
      ambiente: process.env.NODE_ENV || 'development',
      node: process.version,
      uptimeSegundos: Math.round(process.uptime()),
      memoriaMB: Math.round(memoria.rss / 1024 / 1024),
      // Só indicam se está configurado, nunca o valor.
      integracoes: {
        scoutIA: scout,
        email: { configurado: !!process.env.RESEND_API_KEY },
        supabaseStorage: { configurado: !!process.env.SUPABASE_SERVICE_ROLE_KEY },
      },
      superAdmins: parseSuperAdmins(process.env.SUPERADMIN_EMAILS).size,
      conexoes: { principal: io.of('/').sockets.size, admin: io.of('/admin').sockets.size },
    });
  }));

  // ── Logs ──────────────────────────────────────────────────────────────────
  router.get('/admin/logs', rota(async (req, res) => {
    const limite = validarLimite(req.query.limite, 200, 500);
    const nivel = ['warn', 'error'].includes(String(req.query.nivel)) ? (req.query.nivel as NivelLog) : undefined;
    res.json(logs.snapshot(limite, nivel));
  }));

  return router;
}
