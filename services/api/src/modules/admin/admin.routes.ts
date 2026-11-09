import type { Prisma } from '@prisma/client';
import { concluirTarefasCadastro } from './tarefas-cadastro';
import { dependenciasCategoria, lerCnpj, lerEnderecoCadastro, lerEscudo, lerSubs } from './cadastro-clube';
import { sanitizar } from '../suporte/rules';
import { responderPausa } from '../manutencao/service';
import axios from 'axios';
import { Router } from 'express';
import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { Server } from 'socket.io';

import { PYTHON_AI_URL } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { idPositivo } from '../../utils/id';
import { desconectarSessoes } from '../../realtime/sessoes';
import { validarCargo } from '../clubes/membros.rules';
import {
  SUBS_PADRAO,
  parseSuperAdmins,
  papelPlataformaEfetivo,
  tipoCategoriaPorIdade,
  validarBusca,
  validarClube,
  validarLimite,
  type NivelLog,
} from './admin.rules';
import { criarConvite, listarConvites, revogarConvite } from '../convites/convite-admin.routes';
import { limitarOperacaoPesada } from '../../middlewares/rate-limit.middleware';
import { exigirSuperAdmin, logs } from './superadmin';
import { categoriaCalculada, ErroElenco, removerAluno, salvarAluno } from '../jogadores/elenco.service';
import { notificarCamisas } from '../jogadores/elenco.realtime';
import { previaEsportivaAtleta } from '../jogadores/perfil.routes';

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
    if (responderPausa(erro, res)) return;
    if (erro instanceof ErroElenco) return res.status(erro.status).json({ error: erro.message, ...erro.detalhes });
    if (erro instanceof ErroHttp) return res.status(erro.status).json({ error: erro.message });
    if ((erro as any)?.code === 'P2002' && String((erro as any).meta?.target).includes('cnpj')) return res.status(409).json({ error: 'Já existe um clube com este CNPJ.' });
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

const auditar = (req: Request, mensagem: string, clubeId?: number) =>
  logs.registrar({
    nivel: 'audit',
    tipo: 'audit',
    mensagem,
    clubeId,
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
        ativo: c.ativo,
        cnpj: c.cnpj,
        endereco: c.endereco,
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
  router.get('/admin/cep/:cep', limitarOperacaoPesada, rota(async (req, res) => {
    const cep = String(req.params.cep);
    if (!/^\d{8}$/.test(cep)) throw new ErroHttp(400, 'Informe oito dígitos do CEP.');
    let naoEncontrado = false;
    const consulta = (url: string) => fetch(url, { signal: AbortSignal.timeout(3500), redirect: 'error' });
    try {
      const resposta = await consulta(`https://viacep.com.br/ws/${cep}/json/`);
      if (resposta.ok) {
        const dados = await resposta.json() as { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
        naoEncontrado = dados.erro === true || dados.erro === 'true';
        if (!naoEncontrado && dados.localidade && dados.uf) {
          return res.json({ cep, logradouro: dados.logradouro || '', bairro: dados.bairro || '', cidade: dados.localidade, estado: dados.uf });
        }
      }
    } catch { /* Consulta alternativa abaixo. */ }
    if (naoEncontrado) throw new ErroHttp(404, 'CEP não localizado. Confira os dígitos ou preencha o endereço manualmente.');
    try {
      const resposta = await consulta(`https://brasilapi.com.br/api/cep/v1/${cep}`);
      if (resposta.ok) {
        const dados = await resposta.json() as { street?: string; neighborhood?: string; city?: string; state?: string };
        if (dados.city && dados.state) return res.json({ cep, logradouro: dados.street || '', bairro: dados.neighborhood || '', cidade: dados.city, estado: dados.state });
      }
    } catch { /* Mantém a opção de preencher manualmente. */ }
    throw new ErroHttp(503, 'Consulta de CEP indisponível. Preencha o endereço manualmente.');
  }));
  const cascaDisponivel = { clube_representado_id: null, arquivado: false, fpfsTime: { none: {} } } satisfies Prisma.TimeWhereInput;
  const cascaSelect = { id: true, nome: true, escudo: true, categoria: { select: { nome: true, clube_id: true, clube: { select: { nome: true } } } } } satisfies Prisma.TimeSelect;
  router.get('/admin/clubes/cascas', rota(async (req, res) => {
    const nome = String(req.query.nome || '').trim().slice(0, 80);
    res.json(await prisma.time.findMany({
      where: { ...cascaDisponivel, ...(nome ? { nome: { contains: nome, mode: 'insensitive' } } : {}) },
      orderBy: [{ nome: 'asc' }, { id: 'asc' }], take: 60,
      select: cascaSelect,
    }));
  }));
  router.get('/admin/clubes/cascas/:id/previa', rota(async (req, res) => {
    const id = idDe(req.params.id, 'Time');
    const principal = await prisma.time.findFirst({ where: { ...cascaDisponivel, id }, select: cascaSelect });
    if (!principal) throw new ErroHttp(404, 'Esse time não está mais disponível.');
    const times = principal.categoria ? await prisma.time.findMany({
      where: { ...cascaDisponivel, nome: { equals: principal.nome, mode: 'insensitive' }, categoria: { clube_id: principal.categoria.clube_id } },
      select: cascaSelect, orderBy: { id: 'asc' },
    }) : [principal];
    const ids = times.map(t => t.id);
    const jogos = await prisma.partida.findMany({
      where: { OR: [{ mandante_id: { in: ids } }, { visitante_id: { in: ids } }] },
      orderBy: [{ data: 'desc' }, { horario: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }], take: 5,
      select: { id: true, data: true, horario: true, status: true, mandante: { select: { id: true, nome: true, escudo: true } }, visitante: { select: { id: true, nome: true, escudo: true } }, categoria: { select: { nome: true } } },
    });
    res.json({ time: principal, times, jogos });
  }));
  router.post('/admin/clubes', rota(async (req, res) => {
    const { nome, plano } = validar(() => validarClube({ nome: req.body?.nome, plano: req.body?.plano }, { criando: true }));
    const cnpj = validar(() => lerCnpj(req.body?.cnpj));
    const endereco = validar(() => lerEnderecoCadastro(req.body?.endereco));
    const escudo = validar(() => lerEscudo(req.body?.escudo_arquivo));
    const adminEmail = String(req.body?.admin_email || '').trim().toLowerCase();
    const cascaId = req.body?.casca_id == null ? null : idDe(req.body.casca_id, 'Time existente');
    const idsEntrada = req.body?.casca_ids;
    if (idsEntrada !== undefined && (!cascaId || !Array.isArray(idsEntrada) || !idsEntrada.length || idsEntrada.length > 100)) throw new ErroHttp(400, 'Selecione o grupo de times na prévia.');
    const cascaIds: number[] = idsEntrada === undefined ? (cascaId ? [cascaId] : []) : [...new Set<number>(idsEntrada.map((id: unknown) => idDe(id, 'Time existente')))];
    if (cascaId && !cascaIds.includes(cascaId)) throw new ErroHttp(400, 'O time principal precisa fazer parte do grupo.');
    const subs = validar(() => lerSubs(req.body?.subs ?? (req.body?.categorias_padrao === false ? [] : [...SUBS_PADRAO])));

    const clube = await prisma.$transaction(async tx => {
      const dono = adminEmail
        ? await tx.usuario.findUnique({ where: { email: adminEmail }, select: { id: true } })
        : null;
      if (adminEmail && !dono) {
        throw new ErroHttp(400, 'Nenhum usuário com este e-mail. Peça para criar a conta no app primeiro.');
      }

      const novo = await tx.clube.create({
        data: { nome: nome!, cnpj, cidade: endereco.cidade, estado: endereco.estado, endereco, plano: plano ?? 'TRIAL', escudo },
      });
      if (cascaId) {
        const principal = await tx.time.findFirst({ where: { ...cascaDisponivel, id: cascaId }, select: cascaSelect });
        if (!principal) throw new ErroHttp(409, 'Esse time já foi vinculado ou passou a ter um vínculo oficial.');
        const grupo = principal.categoria ? { nome: { equals: principal.nome, mode: 'insensitive' as const }, categoria: { clube_id: principal.categoria.clube_id } } : { id: cascaId };
        if (!principal.categoria && cascaIds.length > 1) throw new ErroHttp(400, 'Um time sem categoria só pode ser vinculado sozinho.');
        const alterada = await tx.time.updateMany({ where: { ...cascaDisponivel, AND: [grupo, { id: { in: cascaIds } }] }, data: { clube_representado_id: novo.id } });
        if (alterada.count !== cascaIds.length) throw new ErroHttp(409, 'Os times mudaram desde a prévia. Confira a lista novamente.');
        await tx.auditoriaVinculoTime.createMany({ data: cascaIds.map(id => ({ time_id: id, clube_novo_id: novo.id, usuario_id: (req as any).usuarioId, motivo: 'Time reaproveitado no cadastro do clube.' })) });
      }

      if (subs.length) {
        await tx.categoria.createMany({
          data: subs.map(idade => ({
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
    }, { isolationLevel: 'Serializable' });

    auditar(req, `Clube criado: #${clube.id} ${clube.nome} (${clube.plano})`, clube.id);
    res.status(201).json(clube);
  }));

  router.patch('/admin/clubes/:id', rota(async (req, res) => {
    const id = idDe(req.params.id, 'Clube');
    const dados = { ...validar(() => validarClube(req.body, { criando: false })),
      ...(req.body?.cnpj !== undefined ? { cnpj: validar(() => lerCnpj(req.body.cnpj)) } : {}),
      ...(req.body?.endereco !== undefined ? { endereco: validar(() => lerEnderecoCadastro(req.body.endereco)) } : {}),
      ...(req.body?.escudo_arquivo !== undefined ? { escudo: validar(() => lerEscudo(req.body.escudo_arquivo)) } : {}),
    };
    if (dados.endereco) { dados.cidade = dados.endereco.cidade; dados.estado = dados.endereco.estado; }
    if (Object.keys(dados).length === 0) throw new ErroHttp(400, 'Nada para atualizar');

    const existe = await prisma.clube.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new ErroHttp(404, 'Clube não encontrado');

    const clube = await prisma.$transaction(async tx => {
      const atualizado = await tx.clube.update({ where: { id }, data: dados });
      await concluirTarefasCadastro(tx, atualizado);
      return atualizado;
    });
    auditar(req, `Clube atualizado: #${id} (${Object.keys(dados).join(', ')})`, id);
    res.json(clube);
  }));

  router.post('/admin/clubes/:id/categorias-padrao', rota(async (req, res) => {
    const clubeId = idDe(req.params.id, 'Clube');
    const clube = await prisma.clube.findUnique({ where: { id: clubeId }, select: { id: true } });
    if (!clube) throw new ErroHttp(404, 'Clube não encontrado');
    const { count } = await prisma.categoria.createMany({
      data: SUBS_PADRAO.map(idade => ({
        nome: `sub-${idade}`,
        faixaIdade: idade,
        tipo: tipoCategoriaPorIdade(idade),
        clube_id: clubeId,
      })),
      skipDuplicates: true,
    });
    if (count) auditar(req, `Categorias padrão adicionadas: clube #${clubeId} (${count})`, clubeId);
    res.json({ adicionadas: count });
  }));

  router.patch('/admin/clubes/:id/estado', rota(async (req, res) => {
    const id = idDe(req.params.id, 'Clube');
    const { ativo, motivo } = req.body || {};
    if (typeof ativo !== 'boolean' || typeof motivo !== 'string' || motivo.trim().length < 10 || motivo.length > 300) throw new ErroHttp(400, 'Informe o estado e o motivo da alteração.');
    const anterior = await prisma.clube.findUnique({ where: { id }, select: { ativo: true } });
    if (!anterior) throw new ErroHttp(404, 'Clube não encontrado.');
    if (anterior.ativo !== ativo) {
      if (!ativo && await prisma.partida.count({ where: { status: 'AO_VIVO', OR: [{ categoria: { clube_id: id } }, { participantes: { some: { clube_id: id } } }] } })) throw new ErroHttp(409, 'Encerre as partidas ao vivo antes de desativar o clube.');
      await prisma.clube.update({ where: { id }, data: { ativo } });
      auditar(req, `Clube ${ativo ? 'reativado' : 'desativado'}: ${sanitizar(motivo, 300)}`, id);
    }
    res.json({ ativo });
  }));
  router.delete('/admin/clubes/:id', rota(async (req, res) => {
    const id = idDe(req.params.id, 'Clube');
    await prisma.$transaction(async tx => {
      const clube = await tx.clube.findUnique({ where: { id }, select: { _count: { select: { usuarios: true, competicoes: true, equipesPartida: true, fpfsVinculo: true, tarefasCadastro: true } } } });
      if (!clube) throw new ErroHttp(404, 'Clube não encontrado.');
      if (clube._count.usuarios || await tx.jogador.count({ where: { categoria: { clube_id: id } } })) {
        throw new ErroHttp(409, 'Este clube tem pessoas ou jogadores vinculados. Desative o clube para manter os registros.');
      }
      if (Object.values(clube._count).some(Boolean) || await tx.partida.count({ where: { OR: [{ categoria: { clube_id: id } }, { sumula_clube_id: id }] } })) {
        throw new ErroHttp(409, 'Este clube tem histórico esportivo, tarefas ou vínculos oficiais. Desative o clube para preservar os registros.');
      }
      const times = await tx.time.findMany({ where: { clube_representado_id: id }, select: { id: true } });
      if (times.length) await tx.auditoriaVinculoTime.createMany({ data: times.map(time => ({ time_id: time.id, clube_anterior_id: id, usuario_id: (req as any).usuarioId, motivo: 'Cadastro de clube excluído. O time e seus jogos foram preservados.' })) });
      await tx.clube.delete({ where: { id } });
    }, { isolationLevel: 'Serializable' });
    auditar(req, `Clube sem dependências removido: #${id}`, id);
    res.json({ ok: true });
  }));
  const jogadorResumo = { id: true, nome: true, posicao: true, numCamisa: true, ativo: true, foto: true, dtNasc: true } satisfies Prisma.JogadorSelect;
  router.get('/admin/clubes/:id/jogadores/categoria', rota(async (req, res) => {
    const clubeId = idDe(req.params.id, 'Clube');
    res.json({ categoria: await categoriaCalculada(prisma, clubeId, String(req.query.nascimento ?? '')) });
  }));
  router.get('/admin/clubes/:id/categorias/:categoriaId/jogadores', rota(async (req, res) => {
    const clubeId = idDe(req.params.id, 'Clube'), categoriaId = idDe(req.params.categoriaId, 'Categoria');
    const busca = String(req.query.busca || '').trim().slice(0, 80);
    const offset = Number(req.query.offset ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw new ErroHttp(400, 'Página de jogadores inválida.');
    const categoria = await prisma.categoria.findFirst({ where: { id: categoriaId, clube_id: clubeId }, select: {
      jogadores: { where: busca ? { nome: { contains: busca, mode: 'insensitive' } } : undefined,
        orderBy: [{ nome: 'asc' }, { id: 'asc' }], skip: offset, take: 26, select: jogadorResumo },
    } });
    if (!categoria) throw new ErroHttp(404, 'Categoria não encontrada no clube.');
    res.json(categoria.jogadores);
  }));
  router.get('/admin/clubes/:id/categorias/:categoriaId/jogadores/:jogadorId', rota(async (req, res) => {
    const clubeId = idDe(req.params.id, 'Clube'), categoriaId = idDe(req.params.categoriaId, 'Categoria'), jogadorId = idDe(req.params.jogadorId, 'Jogador');
    const jogador = await prisma.jogador.findFirst({ where: { id: jogadorId, categoria_id: categoriaId, categoria: { clube_id: clubeId } },
      select: { ...jogadorResumo, cpf: true, categoria: { select: { id: true, nome: true, tipo: true } } },
    });
    if (!jogador) throw new ErroHttp(404, 'Jogador não encontrado neste clube e categoria.');
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ ...jogador, ...await previaEsportivaAtleta(jogadorId, clubeId) });
  }));
  router.patch('/admin/clubes/:id/categorias/:categoriaId/jogadores/:jogadorId', rota(async (req, res) => {
    const clubeId = idDe(req.params.id, 'Clube'), categoriaId = idDe(req.params.categoriaId, 'Categoria'), jogadorId = idDe(req.params.jogadorId, 'Jogador');
    if (req.body?.cpf !== undefined) throw new ErroHttp(400, 'O CPF não pode ser alterado.');
    const { nome, posicao, numCamisa, confirmar_camisa, foto, dtNasc } = req.body || {};
    const dados = Object.fromEntries(Object.entries({ nome, posicao, numCamisa, confirmar_camisa, foto, dtNasc }).filter(([, valor]) => valor !== undefined));
    if (!Object.keys(dados).length) throw new ErroHttp(400, 'Informe ao menos uma alteração no cadastro esportivo.');
    const usuarioId = (req as any).usuarioId;
    const salvo = await salvarAluno(clubeId, usuarioId, dados, jogadorId, { categoriaId });
    void notificarCamisas(io, clubeId, salvo).catch(() => console.error('Falha ao sincronizar camisas após salvar.'));
    auditar(req, `Cadastro esportivo do jogador #${jogadorId} atualizado`, clubeId);
    res.json({ id: salvo.id, categoria_id: salvo.categoria_id, nome: salvo.nome, posicao: salvo.posicao, numCamisa: salvo.numCamisa, ativo: salvo.ativo });
  }));
  router.delete('/admin/clubes/:id/categorias/:categoriaId/jogadores/:jogadorId', rota(async (req, res) => {
    const clubeId = idDe(req.params.id, 'Clube'), categoriaId = idDe(req.params.categoriaId, 'Categoria'), jogadorId = idDe(req.params.jogadorId, 'Jogador');
    const resultado = await removerAluno(clubeId, (req as any).usuarioId, jogadorId, { categoriaId });
    auditar(req, `Jogador #${jogadorId} ${resultado.desativado ? 'desativado' : 'excluído'}`, clubeId);
    res.json(resultado);
  }));
  router.post('/admin/clubes/:id/categorias', rota(async (req, res) => {
    const clubeId = idDe(req.params.id, 'Clube');
    const subs = validar(() => lerSubs([req.body?.idade]));
    if (!await prisma.clube.findUnique({ where: { id: clubeId } })) throw new ErroHttp(404, 'Clube não encontrado.');
    const idade = subs[0];
    const existente = await prisma.categoria.findFirst({ where: { clube_id: clubeId, OR: [{ faixaIdade: idade }, { nome: { equals: `sub-${idade}`, mode: 'insensitive' } }] } });
    if (existente) throw new ErroHttp(409, 'Este SUB já está cadastrado. Reative se necessário.');
    const cat = await prisma.categoria.create({ data: { clube_id: clubeId, nome: `sub-${idade}`, faixaIdade: idade, tipo: tipoCategoriaPorIdade(idade) } });
    auditar(req, `Categoria ${cat.nome} adicionada`, clubeId);
    res.status(201).json(cat);
  }));
  router.patch('/admin/clubes/:id/categorias/:categoriaId', rota(async (req, res) => {
    const clubeId = idDe(req.params.id, 'Clube'), id = idDe(req.params.categoriaId, 'Categoria');
    if (typeof req.body?.ativa !== 'boolean') throw new ErroHttp(400, 'Informe o estado da categoria.');
    const atualizada = await prisma.categoria.updateMany({ where: { id, clube_id: clubeId }, data: { ativa: req.body.ativa } });
    if (!atualizada.count) throw new ErroHttp(404, 'Categoria não encontrada no clube.');
    auditar(req, `Categoria ${id} ${req.body.ativa ? 'reativada' : 'desativada'}`, clubeId);
    res.json({ ok: true });
  }));
  router.delete('/admin/clubes/:id/categorias/:categoriaId', rota(async (req, res) => {
    const clubeId = idDe(req.params.id, 'Clube'), id = idDe(req.params.categoriaId, 'Categoria');
    await prisma.$transaction(async tx => {
      const dependencias = await dependenciasCategoria(tx, clubeId, id);
      if (!dependencias) throw new ErroHttp(404, 'Categoria não encontrada no clube.');
      const bloqueios = Object.entries(dependencias).filter(([, total]) => total > 0).map(([tipo, total]) => `${total} ${tipo}`);
      if (bloqueios.length) throw new ErroHttp(409, `Há ${bloqueios.join(', ')}. Desative a categoria para preservar o histórico.`);
      await tx.categoria.delete({ where: { id } });
    }, { isolationLevel: 'Serializable' });
    auditar(req, `Categoria sem vínculos removida: ${id}`, clubeId);
    res.json({ ok: true });
  }));

  // ── Membros e permissões ──────────────────────────────────────────────────
  const noClube = (handler: Handler, acao?: string) => rota(async (req, res) => {
    const clubeId = idDe(req.params.clubeId, 'Clube');
    const clube = await prisma.clube.findUnique({ where: { id: clubeId }, select: { id: true } });
    if (!clube) throw new ErroHttp(404, 'Clube não encontrado');
    Object.assign(req, { clubeId });
    if (acao) res.once('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) auditar(req, acao, clubeId);
    });
    await handler(req, res);
  });

  router.get('/admin/clubes/:clubeId/convites', noClube(listarConvites));
  router.post('/admin/clubes/:clubeId/convites', limitarOperacaoPesada, noClube(criarConvite, 'Convite criado'));
  router.post('/admin/clubes/:clubeId/convites/:id/revogar', noClube(revogarConvite, 'Convite revogado'));
  router.get('/admin/clubes/:clubeId/atividade', noClube(async (req, res) => {
    const clubeId = idDe(req.params.clubeId, 'Clube');
    res.json(logs.snapshot(500).filter(item => item.tipo === 'audit' && item.clubeId === clubeId).slice(-50).reverse());
  }));

  router.get('/admin/clubes/:id/membros', rota(async (req, res) => {
    const clubeId = idDe(req.params.id, 'Clube');
    const [categorias, membros] = await Promise.all([
      prisma.categoria.findMany({ where: { clube_id: clubeId }, select: { id: true, nome: true, ativa: true, faixaIdade: true, tipo: true }, orderBy: { faixaIdade: 'asc' } }),
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

    auditar(req, `Permissão: usuário #${usuarioId} → ${entrada.papel} no clube #${clubeId}`, clubeId);
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

    auditar(req, `Vínculo removido: usuário #${usuarioId} do clube #${clubeId}`, clubeId);
    res.json({ ok: true });
  }));

  // ── Usuários ──────────────────────────────────────────────────────────────
  router.get('/admin/usuarios', rota(async (req, res) => {
    const busca = validarBusca(req.query.busca);
    const limite = validarLimite(req.query.limite, 50, 200);
    const lista = parseSuperAdmins(process.env.SUPERADMIN_EMAILS);

    const filtros: Prisma.UsuarioWhereInput[] = [];
    const clubeId = idPositivo(req.query.clube);
    const papel = ['ADMIN', 'TECNICO', 'MESARIO', 'OLHEIRO', 'TORCEDOR'].find(v => v === req.query.papel) as Prisma.UsuarioClubeWhereInput['papel'];
    if (clubeId || papel) filtros.push({ clubes: { some: { ...(clubeId ? { clube_id: clubeId } : {}), ...(papel ? { papel } : {}) } } });
    if (req.query.estado === 'ATIVA' || req.query.estado === 'SUSPENSA') filtros.push({ suspenso: req.query.estado === 'SUSPENSA' });
    const interno = (['SUPERADMIN', 'SUPORTE', 'DESENVOLVEDOR', 'USUARIO'] as const).find(v => v === req.query.interno);
    if (interno === 'SUPERADMIN') filtros.push({ OR: [{ papel_plataforma: interno }, { email: { in: [...lista] } }] });
    else if (interno) filtros.push({ papel_plataforma: interno, email: { notIn: [...lista] } });
    if (busca) filtros.push({ OR: [{ nome: { contains: busca, mode: 'insensitive' } }, { email: { contains: busca, mode: 'insensitive' } }] });
    const usuarios = await prisma.usuario.findMany({
      where: { AND: filtros },
      orderBy: { id: 'desc' },
      take: limite,
      // Seleção explícita: o hash da senha nunca sai do banco.
      select: {
        id: true,
        nome: true,
        email: true,
        criadoEm: true,
        papel_plataforma: true,
        suspenso: true,
        clubes: { select: { papel: true, clube: { select: { id: true, nome: true } } } },
      },
    });

    res.json(usuarios.map(u => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      criadoEm: u.criadoEm,
      papel_plataforma: papelPlataformaEfetivo(u, lista),
      suspenso: u.suspenso,
      cargoLegado: lista.has(u.email.toLowerCase()),
      superadmin: papelPlataformaEfetivo(u, lista) === 'SUPERADMIN',
      clubes: u.clubes.map(v => ({ clube_id: v.clube.id, nome: v.clube.nome, papel: v.papel })),
    })));
  }));

  router.patch('/admin/usuarios/:id/controle', rota(async (req, res) => {
    const usuarioId = idDe(req.params.id, 'Usuário');
    const operadorId = (req as any).usuarioId as number;
    const { cargo, suspenso, motivo } = req.body || {};
    const novoCargo = (['USUARIO', 'SUPORTE', 'DESENVOLVEDOR', 'SUPERADMIN'] as const).find(v => v === cargo);
    if (!novoCargo || typeof suspenso !== 'boolean' || typeof motivo !== 'string' || motivo.trim().length < 10 || motivo.length > 300) throw new ErroHttp(400, 'Escolha cargo e situação e explique a alteração.');
    if (operadorId === usuarioId) throw new ErroHttp(403, 'Outro administrador precisa revisar o seu próprio acesso.');
    const alterou = await prisma.$transaction(async tx => {
      const [u, operador] = await Promise.all([tx.usuario.findUnique({ where: { id: usuarioId } }), tx.usuario.findUnique({ where: { id: operadorId } })]);
      if (!operador || operador.suspenso || papelPlataformaEfetivo(operador) !== 'SUPERADMIN') throw new ErroHttp(403, 'Sua permissão mudou. Entre novamente.');
      if (!u) throw new ErroHttp(404, 'Usuário não encontrado.');
      if (parseSuperAdmins(process.env.SUPERADMIN_EMAILS).has(u.email.toLowerCase())) throw new ErroHttp(409, 'Conta de administração legada. Revise a lista SUPERADMIN_EMAILS antes de alterar por aqui.');
      if (u.papel_plataforma === novoCargo && u.suspenso === suspenso) return false;
      await tx.usuario.update({ where: { id: usuarioId }, data: { papel_plataforma: novoCargo, suspenso, versao_sessao: { increment: 1 } } });
      await tx.auditoriaContaInterna.create({ data: { usuarioId, operadorId, motivo: sanitizar(motivo, 300), antes: { cargo: u.papel_plataforma, suspenso: u.suspenso }, depois: { cargo: novoCargo, suspenso } } });
      return true;
    }, { isolationLevel: 'Serializable' });
    if (alterou) desconectarSessoes(io, usuarioId);
    res.json({ ok: true, alterou });
  }));

  router.post('/admin/usuarios/:id/revogar-sessoes', rota(async (req, res) => {
    const id = idDe(req.params.id, 'Usuário');
    const existe = await prisma.usuario.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new ErroHttp(404, 'Usuário não encontrado');
    await prisma.usuario.update({ where: { id }, data: { versao_sessao: { increment: 1 } } });
    desconectarSessoes(io, id);
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
        const resposta = await axios.get(new URL('/health', PYTHON_AI_URL).href, {
          timeout: 4000,
          maxRedirects: 0,
        });
        scout = { configurado: true, acessivel: resposta.data?.status === 'ok', ms: Date.now() - t0 };
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
      superAdmins: await prisma.usuario.count({ where: {
        OR: [
          { papel_plataforma: 'SUPERADMIN' },
          ...[...parseSuperAdmins(process.env.SUPERADMIN_EMAILS)].map(email => ({ email: { equals: email, mode: 'insensitive' as const } })),
        ],
      } }),
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
