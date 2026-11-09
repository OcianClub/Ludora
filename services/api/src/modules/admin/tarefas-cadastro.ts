import { Router } from 'express';
import { Prisma } from '@prisma/client';
import type { Server } from 'socket.io';
import { prisma } from '../../lib/prisma';
import { exigirSuperAdmin } from './superadmin';
import { idPositivo } from '../../utils/id';
import { sanitizar } from '../suporte/rules';

const motivos = { ESCUDO: 'Escudo do clube', ENDERECO: 'Endereço da sede', CNPJ: 'CNPJ do clube' } as const;
type Motivo = keyof typeof motivos;
function faltas(clube: { escudo: string | null; endereco: Prisma.JsonValue; cnpj: string | null }): Motivo[] {
  const endereco = clube.endereco as Record<string, unknown> | null;
  return [
    ...(!clube.escudo ? ['ESCUDO' as const] : []),
    ...(!endereco?.numero || !endereco.bairro ? ['ENDERECO' as const] : []),
    ...(!clube.cnpj ? ['CNPJ' as const] : []),
  ];
}
function texto(motivo: Motivo, nome: string) {
  return `Complete o cadastro de ${nome}. Falta informar: ${motivos[motivo].toLowerCase()}. Entre em contato com a equipe Ludora para atualizar os dados.`;
}
export async function concluirTarefasCadastro(tx: Prisma.TransactionClient, clube: { id: number; escudo: string | null; endereco: Prisma.JsonValue; cnpj: string | null }) {
  const completas = Object.keys(motivos).filter(k => !faltas(clube).includes(k as Motivo));
  await tx.tarefaCadastroClube.updateMany({ where: { clubeId: clube.id, motivo: { in: completas }, estado: 'PENDENTE' }, data: { estado: 'CONCLUIDA', encerradoEm: new Date() } });
}
export function criarTarefasCadastroRoutes(io: Server) {
  const r = Router();
  const base = '/admin/cadastro-pendente';
  r.use(base, exigirSuperAdmin);
  r.get(base, async (_req, res) => {
    const clubes = await prisma.clube.findMany({ select: { id: true, nome: true, ativo: true, escudo: true, endereco: true, cnpj: true, tarefasCadastro: true }, orderBy: { nome: 'asc' } });
    res.json(clubes.map(c => ({ id: c.id, nome: c.nome, ativo: c.ativo, motivos: faltas(c).map(value => ({ value, label: motivos[value], mensagem: texto(value, c.nome) })), tarefas: c.tarefasCadastro })));
  });
  r.get(`${base}/:id/destinatarios`, async (req, res) => {
    const clubeId = idPositivo(req.params.id);
    if (!clubeId) { res.status(400).json({ error: 'Clube inválido.' }); return; }
    const vinculos = await prisma.usuarioClube.findMany({ where: { clube_id: clubeId, papel: 'ADMIN', usuario: { suspenso: false } }, select: { usuario: { select: { id: true, nome: true } } }, orderBy: { usuario: { nome: 'asc' } } });
    res.json(vinculos.map(v => v.usuario));
  });
  r.post(`${base}/:id`, async (req, res) => {
    const clubeId = idPositivo(req.params.id);
    const { motivo, destinatarios, mensagemEsperada } = req.body || {};
    if (!clubeId || typeof motivo !== 'string' || !Object.hasOwn(motivos, motivo) || !Array.isArray(destinatarios) || destinatarios.length < 1 || destinatarios.length > 50 || destinatarios.some(id => !Number.isSafeInteger(id) || id < 1)) {
      res.status(400).json({ error: 'Escolha clube, dado pendente e administradores destinatários.' }); return;
    }
    const ids = [...new Set<number>(destinatarios)];
    const operadorId = (req as any).usuarioId as number;
    try {
      const resultado = await prisma.$transaction(async tx => {
        const c = await tx.clube.findUnique({ where: { id: clubeId } });
        if (!c || !c.ativo || !faltas(c).includes(motivo as Motivo)) return { status: 409, error: 'O clube ou o dado pendente mudou. Atualize a prévia.' };
        const autorizados = await tx.usuarioClube.count({ where: { clube_id: clubeId, papel: 'ADMIN', usuario_id: { in: ids }, usuario: { suspenso: false } } });
        if (autorizados !== ids.length) return { status: 403, error: 'O destinatário precisa ser administrador ativo do clube.' };
        if (await tx.tarefaCadastroClube.findUnique({ where: { clubeId_motivo: { clubeId, motivo } } })) return { status: 409, error: 'Já existe uma tarefa para este campo. Consulte o histórico.' };
        const mensagem = texto(motivo as Motivo, c.nome);
        if (mensagemEsperada !== mensagem) return { status: 409, error: 'A mensagem mudou. Atualize e revise a prévia.' };
        const tarefa = await tx.tarefaCadastroClube.create({ data: { clubeId, motivo, mensagem, destinatarios: ids, operadorId } });
        const avisos = await Promise.all(ids.map(usuario_id => tx.notificacao.create({ data: { usuario_id, clube_id: clubeId, tipo: 'CADASTRO_CLUBE', titulo: 'Cadastro do clube incompleto', corpo: mensagem, dados: { tarefaId: tarefa.id, clubeId } } })));
        return { status: 201, tarefa, avisos };
      }, { isolationLevel: 'Serializable' });
      if (!resultado.tarefa) { res.status(resultado.status).json({ error: resultado.error }); return; }
      for (const aviso of resultado.avisos) io.to(`usuario:${aviso.usuario_id}`).emit('notificacao_criada', aviso);
      res.status(201).json({ tarefa: resultado.tarefa, caixasAtualizadas: resultado.avisos.length });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(e.code)) { res.status(409).json({ error: 'Tarefa concorrente. Atualize antes de enviar novamente.' }); return; }
      throw e;
    }
  });
  r.patch(`${base}/tarefas/:id/dispensar`, async (req, res) => {
    const motivo = req.body?.motivo;
    if (typeof motivo !== 'string' || motivo.trim().length < 10 || motivo.length > 300) { res.status(400).json({ error: 'Informe o motivo para dispensar.' }); return; }
    const r = await prisma.tarefaCadastroClube.updateMany({ where: { id: String(req.params.id), estado: 'PENDENTE' }, data: { estado: 'DISPENSADA', justificativa: sanitizar(motivo, 300), encerradoEm: new Date(), encerradoPor: (req as any).usuarioId } });
    res.status(r.count ? 200 : 409).json(r.count ? { ok: true } : { error: 'Tarefa já encerrada ou inexistente.' });
  });
  return r;
}
