import { Router } from 'express';
import { Prisma, type Manutencao } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { exigirEquipe } from '../admin/equipe';
import { sanitizar } from '../suporte/rules';
import { escopoPermitido, OPERACOES, type Operacao } from './service';

function snapshot(pausa: object) { return JSON.parse(JSON.stringify(pausa)) as Prisma.InputJsonValue; }

async function registrarNoChamado(tx: Prisma.TransactionClient, pausa: Manutencao, operadorId: number, motivo: string) {
  if (!pausa.chamadoId) return;
  await tx.suporteChamado.update({ where: { id: pausa.chamadoId }, data: {
    revisao: { increment: 1 },
    historico: { create: {
      operadorId,
      acao: pausa.ativa ? 'MANUTENCAO_PAUSADA' : 'MANUTENCAO_REATIVADA',
      motivo,
      dados: { protocolo: pausa.id, funcao: OPERACOES[pausa.operacao as Operacao] },
    } },
  } });
}
export function criarManutencaoRoutes() {
  const r = Router();
  const base = '/admin/equipe/manutencao';
  r.use(base, exigirEquipe, (_req, res, next) => {
    if (res.locals.funcionario.papel_plataforma === 'DESENVOLVEDOR') { res.status(403).json({ error: 'Controles de manutenção exigem suporte ou administração.' }); return; }
    next();
  });
  r.get(base, async (req, res) => {
    const admin = res.locals.funcionario.papel_plataforma === 'SUPERADMIN';
    const idChamado = typeof req.query.chamado === 'string' ? req.query.chamado : '';
    const [pausas, clubes, eventos, chamado] = await Promise.all([
      prisma.manutencao.findMany({ where: idChamado ? { chamadoId: idChamado } : undefined, orderBy: [{ ativa: 'desc' }, { inicio: 'desc' }], include: { historico: { orderBy: { criadoEm: 'desc' }, take: 20 } } }),
      prisma.clube.findMany({ select: { id: true, nome: true, escudo: true }, orderBy: { nome: 'asc' } }),
      admin ? prisma.fpfsCatalogo.findMany({ select: { id: true, ano: true, divisao: true, categoria: true }, orderBy: [{ ano: 'desc' }, { divisao: 'asc' }] }) : [],
      idChamado ? prisma.suporteChamado.findFirst({ where: { id: idChamado, clubeId: { not: null } }, select: { id: true, assunto: true, clubeId: true, status: true } }) : null,
    ]);
    if (idChamado && !chamado) { res.status(404).json({ error: 'Chamado sem clube vinculado ou indisponível.' }); return; }
    const cargo = res.locals.funcionario.papel_plataforma;
    const operacoes = Object.entries(OPERACOES).map(([value, label]) => ({ value, label, escopos: ['GLOBAL', 'CLUBE', 'EVENTO'].filter(escopo => escopoPermitido(cargo, value as Operacao, escopo)) }));
    res.json({ pausas, clubes, eventos: eventos.map(e => ({ id: e.id, categoria: e.categoria, titulo: `Paulista ${e.ano} · ${e.divisao}` })), operacoes, chamado });
  });
  r.post(base, async (req, res) => {
    const { operacao, escopo, alvoId, motivo, revisarEm, chamadoId } = req.body || {};
    const operador = res.locals.funcionario;
    const data = new Date(revisarEm);
    if (!Object.hasOwn(OPERACOES, operacao) || !Number.isSafeInteger(alvoId) || (escopo === 'GLOBAL' ? alvoId !== 0 : alvoId < 1) ||
      typeof motivo !== 'string' || motivo.trim().length < 10 || motivo.length > 300 || !Number.isFinite(data.getTime()) || data <= new Date()) {
      res.status(400).json({ error: 'Escolha função, alcance, motivo público e revisão futura.' }); return;
    }
    if (!escopoPermitido(operador.papel_plataforma, operacao, escopo)) { res.status(403).json({ error: 'Seu cargo não pode pausar esta função neste alcance.' }); return; }
    if (chamadoId != null && (typeof chamadoId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(chamadoId) || escopo !== 'CLUBE')) {
      res.status(400).json({ error: 'A pausa vinculada precisa ser para o clube do chamado.' }); return;
    }
    if (escopo === 'CLUBE' && !await prisma.clube.findUnique({ where: { id: alvoId } }) || escopo === 'EVENTO' && !await prisma.fpfsCatalogo.findUnique({ where: { id: alvoId } }) && !await prisma.fpfsEvento.findUnique({ where: { id: alvoId } })) {
      res.status(404).json({ error: 'Clube ou evento não encontrado.' }); return;
    }
    const chave = { operacao, escopo, alvoId };
    try {
      const p = await prisma.$transaction(async tx => {
        if (chamadoId) {
          const chamado = await tx.suporteChamado.findFirst({ where: { id: chamadoId, clubeId: alvoId, status: { not: 'RESOLVIDO' } }, select: { id: true } });
          if (!chamado) return 'CHAMADO_INDISPONIVEL' as const;
        }
        const where = { operacao_escopo_alvoId: chave };
        const antes = await tx.manutencao.findUnique({ where });
        if (antes?.ativa) return null;
        const dados = { ativa: true, inicio: new Date(), motivo: sanitizar(motivo, 300), revisarEm: data, operadorId: operador.id, chamadoId: chamadoId ?? null };
        const depois = await tx.manutencao.upsert({ where, create: { ...chave, ...dados }, update: { ...dados, revisao: { increment: 1 } } });
        await tx.manutencaoHistorico.create({ data: { manutencaoId: depois.id, operadorId: operador.id, motivo: dados.motivo, antes: antes ? snapshot(antes) : Prisma.DbNull, depois: snapshot(depois) } });
        await registrarNoChamado(tx, depois, operador.id, dados.motivo);
        return depois;
      }, { isolationLevel: 'Serializable' });
      if (p === 'CHAMADO_INDISPONIVEL') { res.status(409).json({ error: 'Use um chamado aberto que pertença ao clube selecionado.' }); return; }
      res.status(p ? 201 : 409).json(p || { error: 'Já existe pausa ativa para esta função e alcance.' });
    } catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(e.code)) res.status(409).json({ error: 'A pausa mudou. Atualize a tela.' }); else throw e; }
  });
  r.post(`${base}/:id/reativar`, async (req, res) => {
    const { motivo, revisao } = req.body || {};
    if (typeof motivo !== 'string' || motivo.trim().length < 10 || motivo.length > 300 || !Number.isInteger(revisao)) { res.status(400).json({ error: 'Informe o motivo para reativar.' }); return; }
    const p = await prisma.manutencao.findUnique({ where: { id: String(req.params.id) } });
    const operador = res.locals.funcionario;
    if (!p || !escopoPermitido(operador.papel_plataforma, p.operacao as Operacao, p.escopo)) { res.status(403).json({ error: 'Seu cargo não pode reativar esta pausa.' }); return; }
    const ok = await prisma.$transaction(async tx => {
      const alterada = await tx.manutencao.updateMany({ where: { id: p.id, revisao, ativa: true }, data: { ativa: false, revisao: { increment: 1 } } });
      if (!alterada.count) return false;
      const depois = await tx.manutencao.findUniqueOrThrow({ where: { id: p.id } });
      const razao = sanitizar(motivo, 300);
      await tx.manutencaoHistorico.create({ data: { manutencaoId: p.id, operadorId: operador.id, motivo: razao, antes: snapshot(p), depois: snapshot(depois) } });
      await registrarNoChamado(tx, depois, operador.id, razao);
      return true;
    });
    res.status(ok ? 200 : 409).json(ok ? { ok: true } : { error: 'Esta pausa já mudou. Atualize a tela.' });
  });
  return r;
}
