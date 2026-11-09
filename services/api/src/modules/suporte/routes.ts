import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { exigirAutenticacao } from '../../middlewares/auth.middleware';
import { exigirEquipe } from '../admin/equipe';
import { limitarRequisicoes } from '../../middlewares/rate-limit.middleware';
import { classificar, rotaSegura, sanitizar, STATUS_CHAMADO, TIPOS_CHAMADO } from './rules';
import { dadosPublicos, registrarFalha } from './service';

const limite = limitarRequisicoes({ janelaMs: 60000, limite: 10, prefixo: 'suporte' });
const permitido = (cargo: string, c: { restrito: boolean; fila: string; origem: string; tipo: string }) =>
  cargo === 'SUPERADMIN' || cargo === 'SUPORTE' || (!c.restrito && (c.fila === 'DESENVOLVIMENTO' || c.origem === 'AUTOMATICO' && c.tipo === 'ERRO'));

function dataFiltro(valor: unknown) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const data = new Date(`${valor}T00:00:00-03:00`);
  return Number.isFinite(data.getTime()) && data.toISOString().startsWith(valor) ? data : null;
}
const idsAfetados = (valor: Prisma.JsonValue) => Array.isArray(valor) ? valor.filter((id): id is number => typeof id === 'number') : [];

export function criarSuporteRoutes() {
  const router = Router();
  router.use('/suporte', exigirAutenticacao, limite);
  router.get('/suporte', async (req, res) => {
    const lista = await prisma.suporteChamado.findMany({ where: { usuarioId: (req as any).usuarioId }, orderBy: { criadoEm: 'desc' }, take: 100 });
    res.json(lista.map(dadosPublicos));
  });
  router.post('/suporte', async (req, res) => {
    const usuarioId = (req as any).usuarioId as number;
    const { requestId, tipo, assunto, descricao, impacto } = req.body || {};
    if (!/^[a-f\d-]{36}$/i.test(requestId || '') || !TIPOS_CHAMADO.includes(tipo) || typeof assunto !== 'string' || assunto.trim().length < 3 || assunto.length > 120 || typeof descricao !== 'string' || descricao.trim().length < 10 || descricao.length > 4000 || !['DUVIDA', 'DIFICULDADE', 'OPERACAO_BLOQUEADA'].includes(impacto)) {
      res.status(400).json({ error: 'Preencha assunto, descrição e impacto válidos.' }); return;
    }
    const clubeId = Number(req.header('x-clube-id')) || null;
    if (clubeId && !await prisma.usuarioClube.findUnique({ where: { usuario_id_clube_id: { usuario_id: usuarioId, clube_id: clubeId } } })) {
      res.status(403).json({ error: 'Você não participa deste clube.' }); return;
    }
    const anterior = await prisma.suporteChamado.findUnique({ where: { requestId } });
    if (anterior) {
      if (anterior.usuarioId !== usuarioId) { res.status(409).json({ error: 'Identificador já utilizado.' }); return; }
      res.json(dadosPublicos(anterior)); return;
    }
    const sensivel = /senha|password|recupera|seguran[cç]a|invad/i.test(`${assunto} ${descricao}`);
    const classificacao = classificar(sensivel ? 'SEGURANCA' : tipo, 1, clubeId ? 1 : 0);
    const chamado = await prisma.suporteChamado.create({ data: {
      requestId, origem: 'CLIENTE', assunto: sanitizar(assunto, 120), descricao: sanitizar(descricao), impacto, tipo, ...classificacao,
      usuarioId, clubeId, rota: rotaSegura(req.body.rota), servico: 'web', versao: sanitizar(req.body.versao || 'web', 60),
      revisarEm: new Date(Date.now() + (classificacao.prioridade === 'ALTA' ? 4 : 24) * 3600000),
      historico: { create: { operadorId: usuarioId, acao: 'CRIADO', motivo: classificacao.regra } },
    } }).catch(async error => {
      if (error.code !== 'P2002') throw error;
      return prisma.suporteChamado.findUniqueOrThrow({ where: { requestId } });
    });
    if (chamado.usuarioId !== usuarioId) { res.status(409).json({ error: 'Identificador já utilizado.' }); return; }
    res.status(201).json(dadosPublicos(chamado));
  });
  router.get('/suporte/:id', async (req, res) => {
    const c = await prisma.suporteChamado.findFirst({ where: { id: String(req.params.id), usuarioId: (req as any).usuarioId }, include: { historico: { orderBy: { criadoEm: 'asc' } } } });
    if (!c) { res.status(404).json({ error: 'Chamado não encontrado.' }); return; }
    res.json(dadosPublicos(c));
  });
  router.post('/suporte/ocorrencias', async (req, res) => {
    const clubeId = Number(req.header('x-clube-id')) || undefined;
    if (clubeId && !await prisma.usuarioClube.findUnique({ where: { usuario_id_clube_id: { usuario_id: (req as any).usuarioId, clube_id: clubeId } } })) {
      res.status(403).json({ error: 'Clube inválido.' }); return;
    }
    const id = await registrarFalha({ servico: 'web', rota: req.body?.rota, correlacao: res.locals.correlacao, status: 0, versao: req.body?.versao, stack: req.body?.stack, clubeId });
    res.status(201).json({ protocolo: id });
  });
  router.post('/suporte/:id/responder', async (req, res) => {
    const usuarioId = (req as any).usuarioId as number;
    if (typeof req.body?.mensagem !== 'string' || req.body.mensagem.trim().length < 5 || req.body.mensagem.length > 4000) {
      res.status(400).json({ error: 'Descreva sua resposta em até 4.000 caracteres.' }); return;
    }
    const c = await prisma.suporteChamado.findFirst({ where: { id: String(req.params.id), usuarioId } });
    if (!c) { res.status(404).json({ error: 'Chamado não encontrado.' }); return; }
    await prisma.suporteChamado.update({ where: { id: c.id }, data: {
      status: c.status === 'RESOLVIDO' ? 'REABERTO' : 'EM_TRIAGEM', revisao: { increment: 1 },
      historico: { create: { operadorId: usuarioId, acao: 'RESPOSTA_CLIENTE', motivo: sanitizar(req.body.mensagem), publico: true } },
    } });
    res.json({ ok: true });
  });
  router.use('/admin/equipe/chamados', exigirEquipe);
  const visibilidade = (cargo: string): Prisma.SuporteChamadoWhereInput => cargo === 'DESENVOLVEDOR'
    ? { restrito: false, OR: [{ fila: 'DESENVOLVIMENTO' }, { origem: 'AUTOMATICO', tipo: 'ERRO' }] } : {};
  const meusChamados = (id: number): Prisma.SuporteChamadoWhereInput => ({ OR: [
    { responsavelId: id }, { historico: { some: { acao: 'CRIADO_MANUAL', operadorId: id } } },
  ] });
  router.get('/admin/equipe/chamados/clubes', async (_req, res) => {
    if (res.locals.funcionario.papel_plataforma === 'DESENVOLVEDOR') { res.sendStatus(403); return; }
    const clubes = await prisma.clube.findMany({ select: { id: true, nome: true, escudo: true }, orderBy: { nome: 'asc' } });
    res.json(clubes.map(c => ({ value: c.id, label: c.nome, escudo: c.escudo })));
  });
  router.post('/admin/equipe/chamados', async (req, res) => {
    const operador = res.locals.funcionario;
    if (operador.papel_plataforma === 'DESENVOLVEDOR') { res.sendStatus(403); return; }
    const { requestId, assunto, descricao, impacto, tipo, clubeId, servico, rota } = req.body || {};
    if (typeof requestId !== 'string' || !/^[a-f\d-]{36}$/i.test(requestId) || !TIPOS_CHAMADO.includes(tipo) ||
      typeof assunto !== 'string' || assunto.trim().length < 3 || assunto.length > 120 ||
      typeof descricao !== 'string' || descricao.trim().length < 10 || descricao.length > 4000 ||
      !['DUVIDA', 'DIFICULDADE', 'OPERACAO_BLOQUEADA'].includes(impacto) || !['web', 'mobile', 'desktop'].includes(servico) ||
      typeof rota !== 'string' || !rota.startsWith('/') || rota.length > 250 ||
      (clubeId != null && (!Number.isSafeInteger(clubeId) || clubeId < 1))) {
      res.status(400).json({ error: 'Informe assunto, descrição, plataforma, tela e impacto válidos.' }); return;
    }
    if (clubeId && !await prisma.clube.findUnique({ where: { id: clubeId }, select: { id: true } })) {
      res.status(404).json({ error: 'Clube não encontrado.' }); return;
    }
    const sensivel = /senha|password|recupera|seguran[cç]a|invad/i.test(`${assunto} ${descricao}`);
    const classificacao = classificar(sensivel ? 'SEGURANCA' : tipo, 1, clubeId ? 1 : 0);
    const dados = {
      requestId, origem: 'OPERACAO', assunto: sanitizar(assunto, 120).trim(), descricao: sanitizar(descricao).trim(), impacto, tipo,
      ...classificacao, clubeId: clubeId ?? null, responsavelId: operador.id, servico, rota: rotaSegura(rota), versao: 'relato manual',
      revisarEm: new Date(Date.now() + (classificacao.prioridade === 'ALTA' ? 4 : 24) * 3600000),
      historico: { create: { operadorId: operador.id, acao: 'CRIADO_MANUAL', motivo: 'Relato aberto pela equipe.' } },
    };
    try {
      const novo = await prisma.suporteChamado.create({ data: dados, select: { id: true } });
      res.status(201).json(novo);
    } catch (e) {
      if (!e || typeof e !== 'object' || !('code' in e) || e.code !== 'P2002') throw e;
      const existente = await prisma.suporteChamado.findFirst({ where: { requestId, origem: 'OPERACAO', historico: { some: { acao: 'CRIADO_MANUAL', operadorId: operador.id } } }, select: { id: true } });
      res.status(existente ? 200 : 409).json(existente || { error: 'Identificador já utilizado.' });
    }
  });
  router.get('/admin/equipe/chamados/filtros', async (_req, res) => {
    const operador = res.locals.funcionario;
    const where = visibilidade(operador.papel_plataforma);
    const [itens, total, novos, atrasados, recorrentes, meus, encaminhados] = await Promise.all([
      prisma.suporteChamado.findMany({ where, select: { clubeId: true, clubesAfetados: true, responsavelId: true }, distinct: ['clubeId', 'responsavelId', 'clubesAfetados'] }),
      prisma.suporteChamado.count({ where }),
      prisma.suporteChamado.count({ where: { ...where, status: 'NOVO' } }),
      prisma.suporteChamado.count({ where: { ...where, status: { not: 'RESOLVIDO' }, revisarEm: { lt: new Date() } } }),
      prisma.suporteChamado.count({ where: { ...where, ocorrencias: { gt: 1 } } }),
      prisma.suporteChamado.count({ where: { AND: [where, meusChamados(operador.id)] } }),
      prisma.suporteChamado.count({ where: { ...where, status: 'ENCAMINHADO_DEVS' } }),
    ]);
    const clubesIds = itens.flatMap(c => [...(c.clubeId ? [c.clubeId] : []), ...idsAfetados(c.clubesAfetados)]);
    const [clubes, responsaveis] = await Promise.all([
      prisma.clube.findMany({ where: { id: { in: [...new Set(clubesIds)] } }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
      prisma.usuario.findMany({ where: { id: { in: itens.flatMap(c => c.responsavelId ? [c.responsavelId] : []) } }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    ]);
    const opcoes = (linhas: { id: number; nome: string }[]) => linhas.map(l => ({ value: l.id, label: l.nome }));
    res.json({ clubes: opcoes(clubes), responsaveis: opcoes(responsaveis), contagens: { '': total, NOVO: novos, ATRASADO: atrasados, RECORRENTE: recorrentes, MEUS: meus, ENCAMINHADOS: encaminhados } });
  });
  router.get('/admin/equipe/chamados', async (req, res) => {
    const filtros: Prisma.SuporteChamadoWhereInput[] = [visibilidade(res.locals.funcionario.papel_plataforma)];
    for (const campo of ['status', 'origem', 'prioridade', 'tipo'] as const) {
      if (typeof req.query[campo] === 'string' && req.query[campo]) filtros.push({ [campo]: req.query[campo] });
    }
    const clubeId = Number(req.query.clube);
    if (Number.isSafeInteger(clubeId) && clubeId > 0) filtros.push({ OR: [{ clubeId }, { clubesAfetados: { array_contains: [clubeId] } }] });
    const responsavelId = Number(req.query.responsavel);
    if (Number.isSafeInteger(responsavelId) && responsavelId > 0) filtros.push({ responsavelId });
    if (req.query.visao === 'NOVO') filtros.push({ status: 'NOVO' });
    if (req.query.visao === 'ATRASADO') filtros.push({ status: { not: 'RESOLVIDO' }, revisarEm: { lt: new Date() } });
    if (req.query.visao === 'RECORRENTE') filtros.push({ ocorrencias: { gt: 1 } });
    if (req.query.visao === 'MEUS') filtros.push(meusChamados(res.locals.funcionario.id));
    if (req.query.visao === 'ENCAMINHADOS') filtros.push({ status: 'ENCAMINHADO_DEVS' });
    const inicio = dataFiltro(req.query.desde);
    const fim = dataFiltro(req.query.ate);
    if (inicio) filtros.push({ criadoEm: { gte: inicio } });
    if (fim) filtros.push({ criadoEm: { lt: new Date(fim.getTime() + 86400000) } });
    const dias = req.query.periodo === 'hoje' ? 0 : req.query.periodo === 'semana' ? 6 : req.query.periodo === 'mes' ? 29 : null;
    if (dias !== null) {
      const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
      filtros.push({ criadoEm: { gte: new Date(dataFiltro(hoje)!.getTime() - dias * 86400000) } });
    }
    const busca = typeof req.query.busca === 'string' ? req.query.busca.trim().slice(0, 60) : '';
    if (busca) {
      const contains = { contains: busca, mode: 'insensitive' as const };
      const clubes = await prisma.clube.findMany({ where: { nome: contains }, select: { id: true } });
      filtros.push({ OR: [{ assunto: contains }, { id: contains }, { clube: { nome: contains } }, ...clubes.map(c => ({ clubesAfetados: { array_contains: [c.id] } }))] });
    }
    const lista = await prisma.suporteChamado.findMany({ where: { AND: filtros },
      include: { clube: { select: { nome: true } } }, orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }], take: 200,
    });
    const clubesIds = [...new Set(lista.flatMap(c => idsAfetados(c.clubesAfetados)))];
    const clubes = await prisma.clube.findMany({ where: { id: { in: clubesIds } }, select: { id: true, nome: true } });
    const nomes = new Map(clubes.map(c => [c.id, c.nome]));
    res.json(lista.map(c => ({ ...c, detalhesTecnicos: undefined, usuarioId: undefined, fingerprint: undefined, requestId: undefined,
      clubesAfetadosNomes: idsAfetados(c.clubesAfetados).flatMap(id => nomes.get(id) || []) })));
  });
  router.get('/admin/equipe/chamados/:id', async (req, res) => {
    const c = await prisma.suporteChamado.findUnique({ where: { id: String(req.params.id) }, include: {
      historico: { orderBy: { criadoEm: 'asc' } }, clube: { select: { nome: true } },
      manutencoes: { select: { id: true, operacao: true, ativa: true, revisarEm: true }, orderBy: { inicio: 'desc' } },
    } });
    if (!c || !permitido(res.locals.funcionario.papel_plataforma, c)) { res.status(403).json({ error: 'Chamado indisponível para seu cargo.' }); return; }
    const tecnico = res.locals.funcionario.papel_plataforma !== 'SUPORTE';
    const clubesAfetados = await prisma.clube.findMany({ where: { id: { in: idsAfetados(c.clubesAfetados) } }, select: { nome: true } });
    res.json({ ...c, clubesAfetadosNomes: clubesAfetados.map(v => v.nome), detalhesTecnicos: tecnico ? c.detalhesTecnicos : undefined,
      historico: c.historico.map(h => ({ ...h, dados: tecnico || ['MANUTENCAO_PAUSADA', 'MANUTENCAO_REATIVADA'].includes(h.acao) ? h.dados : undefined })) });
  });
  router.patch('/admin/equipe/chamados/:id', async (req, res) => {
    const operador = res.locals.funcionario;
    const { motivo, acao, revisao } = req.body || {};
    if (typeof motivo !== 'string' || motivo.trim().length < 5 || motivo.length > 4000 || !Number.isInteger(revisao)) {
      res.status(400).json({ error: 'Informe o motivo e atualize o chamado.' }); return;
    }
    const c = await prisma.suporteChamado.findUnique({ where: { id: String(req.params.id) } });
    if (!c || !permitido(operador.papel_plataforma, c)) { res.status(403).json({ error: 'Ação não permitida.' }); return; }
    const data: any = { revisao: { increment: 1 } };
    if (acao === 'ATRIBUIR') data.responsavelId = operador.id;
    else if (acao === 'ENCAMINHAR') {
      if (c.restrito || operador.papel_plataforma === 'DESENVOLVEDOR') { res.status(403).json({ error: 'Este caso exige análise do suporte ou administrador.' }); return; }
      if (c.status === 'RESOLVIDO') { res.status(409).json({ error: 'Reabra o chamado antes de encaminhá-lo.' }); return; }
      Object.assign(data, { fila: 'DESENVOLVIMENTO', status: 'ENCAMINHADO_DEVS', detalhesTecnicos: {
        ...((c.detalhesTecnicos as object) || {}), reproducao: sanitizar(motivo), rota: c.rota, versao: c.versao, servico: c.servico,
      } });
    } else if (acao === 'DEVOLVER') {
      if (c.status === 'RESOLVIDO') { res.status(409).json({ error: 'O chamado já foi finalizado.' }); return; }
      if (operador.papel_plataforma === 'SUPORTE') { res.status(403).json({ error: 'A devolução cabe à equipe de desenvolvimento.' }); return; }
      if (c.fila !== 'DESENVOLVIMENTO') { res.status(409).json({ error: 'Este chamado já está no atendimento.' }); return; }
      Object.assign(data, { fila: 'SUPORTE', status: 'EM_TRIAGEM', responsavelId: null });
    } else if (acao === 'FINALIZAR') {
      if (operador.papel_plataforma === 'DESENVOLVEDOR') { res.status(403).json({ error: 'Devolva o chamado ao atendimento para finalizar.' }); return; }
      if (c.status === 'RESOLVIDO') { res.status(409).json({ error: 'O chamado já foi finalizado.' }); return; }
      data.status = 'RESOLVIDO';
    } else if (acao === 'STATUS') {
      if (operador.papel_plataforma === 'DESENVOLVEDOR' || !STATUS_CHAMADO.includes(req.body.status) || req.body.status === 'ENCAMINHADO_DEVS') { res.status(403).json({ error: 'Use o encaminhamento ou a devolução conforme seu cargo.' }); return; }
      data.status = req.body.status;
    } else if (acao === 'CLASSIFICAR') {
      if (operador.papel_plataforma === 'DESENVOLVEDOR' || !TIPOS_CHAMADO.includes(req.body.tipo)) { res.status(403).json({ error: 'Classificação exige suporte ou administrador.' }); return; }
      Object.assign(data, { tipo: req.body.tipo, ...classificar(req.body.tipo, c.ocorrencias, 1), regra: 'REVISAO_HUMANA' });
          if (c.restrito && operador.papel_plataforma !== 'SUPERADMIN') { data.restrito = true; data.fila = 'SUPORTE'; }
    } else if (acao !== 'COMENTAR') { res.status(400).json({ error: 'Ação desconhecida.' }); return; }
    const resultado = await prisma.$transaction(async tx => {
      const atualizado = await tx.suporteChamado.updateMany({ where: { id: c.id, revisao }, data });
      if (!atualizado.count) return false;
      await tx.suporteHistorico.create({ data: { chamadoId: c.id, operadorId: operador.id, acao, motivo: sanitizar(motivo),
        publico: req.body.publico === true && !!c.usuarioId && operador.papel_plataforma !== 'DESENVOLVEDOR' && ['COMENTAR', 'FINALIZAR', 'STATUS'].includes(acao),
        dados: { antes: { status: c.status, fila: c.fila }, depois: { status: data.status || c.status, fila: data.fila || c.fila } },
      } });
      return true;
    });
    res.status(resultado ? 200 : 409).json(resultado ? { ok: true } : { error: 'O chamado mudou. Atualize antes de registrar.' });
  });
  return router;
}
