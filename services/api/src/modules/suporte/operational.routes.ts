import * as bcrypt from 'bcrypt';
import { exigirOperacao } from '../manutencao/service';
import { Router } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { Resend } from 'resend';
import type { Server } from 'socket.io';
import { prisma } from '../../lib/prisma';
import { papelPlataformaEfetivo, parseSuperAdmins } from '../admin/admin.rules';
import { exigirEquipe } from '../admin/equipe';
import { desconectarSessoes } from '../../realtime/sessoes';
import { limitarRecuperacao } from '../../middlewares/rate-limit.middleware';
import { emailRecuperacaoConfigurado } from '../../services/email-recuperacao';
import { emailMascarado, executarEnvio } from './operations';
import { sanitizar } from './rules';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const vencida = (p: { status: string; expiraEm: Date | null }) => ['ENVIANDO', 'AGUARDANDO_CONFIRMACAO'].includes(p.status) && !!p.expiraEm && p.expiraEm <= new Date();
const emailValido = (s: unknown): s is string => typeof s === 'string' && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
function destinoConfirmacao() {
  const base = process.env.LUDORA_WEB_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : process.env.INVITE_BASE_URL);
  try {
    const url = new URL('/confirmar-email', base);
    if (!url.username && !url.password && (url.protocol === 'https:' ||
      url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) return url.href;
  } catch {}
  return 'a página /confirmar-email do Web Ludora';
}
export async function enviarAviso(email: string, assunto: string, texto: string) {
  if (!emailRecuperacaoConfigurado()) throw new Error('Provedor não configurado.');
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.EMAIL_FROM!, to: email, subject: assunto, text: texto });
  if (error) throw new Error('Envio não confirmado.');
}

export function criarOperacoesSuporte(io: Server, enviar = enviarAviso) {
  const r = Router();
  r.use('/admin/equipe/chamados/:id/operacoes', exigirEquipe, (req, res, next) => {
    if (!['SUPORTE', 'SUPERADMIN'].includes(res.locals.funcionario.papel_plataforma)) { res.status(403).json({ error: 'Somente suporte e administradores podem operar contas.' }); return; }
    next();
  });
  r.post('/admin/equipe/chamados/:id/operacoes/convites/localizar', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!emailValido(email)) { res.status(400).json({ error: 'Informe o e-mail usado no convite.' }); return; }
    const chamado = await prisma.suporteChamado.findUnique({ where: { id: String(req.params.id) } });
    if (!chamado?.clubeId) { res.status(404).json({ error: 'O chamado não tem um clube associado.' }); return; }
    const convites = await prisma.conviteClube.findMany({ where: { clube_id: chamado.clubeId, email }, orderBy: { criado_em: 'desc' }, take: 15,
      select: { id: true, email: true, status: true, expira_em: true, criado_em: true } });
    res.json(convites.map(v => ({ id: v.id, destinatario: emailMascarado(v.email), criadoEm: v.criado_em,
      status: v.status === 'PENDENTE' && v.expira_em < new Date() ? 'EXPIRADO' : v.status, podeReenviar: v.status === 'PENDENTE' })));
  });
  r.get('/admin/equipe/chamados/:id/operacoes', async (req, res) => {
    const c = await prisma.suporteChamado.findUnique({ where: { id: String(req.params.id) } });
    if (!c) { res.sendStatus(404); return; }
    const u = c.usuarioId ? await prisma.usuario.findUnique({ where: { id: c.usuarioId }, include: { recuperacao_senha: true } }) : null;
    const acoes = await prisma.suporteAcao.findMany({ where: { chamadoId: c.id }, orderBy: { criadoEm: 'desc' }, take: 20 });
    const recuperacoes = await prisma.recuperacaoExcepcional.findMany({ where: { chamadoId: c.id }, orderBy: { criadoEm: 'desc' }, select: { id: true, status: true, expiraEm: true, novoEmail: true, justificativa: true, verificacao: true, solicitanteId: true } });
    res.json({ provedorConfigurado: emailRecuperacaoConfigurado(),
      conta: u && papelPlataformaEfetivo(u) === 'USUARIO' ? { id: u.id, destinatario: emailMascarado(u.email), recuperacao: !u.recuperacao_senha ? 'Nenhum pedido' : u.recuperacao_senha.usado_em ? 'Utilizada' : u.recuperacao_senha.expira_em < new Date() ? 'Expirada' : 'Aguardando usuário' } : null,
      acoes, recuperacoes: recuperacoes.map(v => ({ ...v, novoEmail: emailMascarado(v.novoEmail), status: vencida(v) ? 'EXPIRADA' : v.status })) });
  });
  r.post('/admin/equipe/chamados/:id/operacoes/envio', async (req, res) => {
    const { requestId, tipo, alvoId } = req.body || {};
    if (!/^[a-f\d-]{36}$/i.test(requestId || '') || !['CONVITE', 'RECUPERACAO'].includes(tipo) || typeof alvoId !== 'string') { res.status(400).json({ error: 'Operação inválida.' }); return; }
    const c = await prisma.suporteChamado.findUnique({ where: { id: String(req.params.id) } });
    if (!c || tipo === 'RECUPERACAO' && c.usuarioId !== Number(alvoId) || tipo === 'CONVITE' && !await prisma.conviteClube.findFirst({ where: { id: alvoId, clube_id: c.clubeId || -1 } })) { res.status(404).json({ error: 'Destino não pertence ao chamado.' }); return; }
    if (tipo === 'RECUPERACAO') {
      const conta = await prisma.usuario.findUnique({ where: { id: Number(alvoId) } });
      if (!conta || papelPlataformaEfetivo(conta) !== 'USUARIO') { res.status(403).json({ error: 'Conta indisponível para esta operação.' }); return; }
    }
    if (tipo === 'CONVITE' && c.clubeId) await exigirOperacao(['ENVIAR_CONVITES'], { clubes: [c.clubeId] });
    try { res.json({ resultado: await executarEnvio({ requestId, tipo, alvoId, chamadoId: c.id, operadorId: res.locals.funcionario.id }) }); }
    catch { res.status(409).json({ error: 'Envio limitado ou operação concorrente. Aguarde um minuto; máximo de três solicitações por destino a cada 24 horas.' }); }
  });
  r.post('/admin/equipe/chamados/:id/operacoes/recuperacao-excepcional', async (req, res) => {
    const { novoEmail, justificativa } = req.body || {};
    if (!emailValido(novoEmail) || typeof justificativa !== 'string' || justificativa.trim().length < 20 || justificativa.length > 2000) { res.status(400).json({ error: 'Informe novo e-mail válido e justificativa com pelo menos 20 caracteres. Não inclua documentos ou senhas.' }); return; }
    const c = await prisma.suporteChamado.findUnique({ where: { id: String(req.params.id) } });
    const u = c?.usuarioId && await prisma.usuario.findUnique({ where: { id: c.usuarioId } });
    if (!c || !u) { res.status(400).json({ error: 'O chamado precisa pertencer a uma conta identificada.' }); return; }
    if (papelPlataformaEfetivo(u) !== 'USUARIO') { res.status(403).json({ error: 'Recuperação de funcionário exige procedimento externo de segurança.' }); return; }
    const email = novoEmail.trim().toLowerCase();
    if (parseSuperAdmins(process.env.SUPERADMIN_EMAILS).has(email) || await prisma.usuario.findUnique({ where: { email } })) { res.status(409).json({ error: 'Endereço indisponível.' }); return; }
    const pedido = await prisma.$transaction(async tx => {
      const existente = await tx.recuperacaoExcepcional.findFirst({ where: { usuarioId: u.id, OR: [{ status: 'AGUARDANDO_APROVACAO' }, { status: { in: ['AGUARDANDO_CONFIRMACAO', 'ENVIANDO'] }, expiraEm: { gt: new Date() } }] } });
      if (existente) return null;
      await tx.suporteChamado.update({ where: { id: c.id }, data: {
        restrito: true, fila: 'SUPORTE', tipo: 'RECUPERACAO', revisao: { increment: 1 },
        ...(c.status === 'ENCAMINHADO_DEVS' ? { status: 'EM_TRIAGEM', responsavelId: null } : {}),
      } });
      const p = await tx.recuperacaoExcepcional.create({ data: { chamadoId: c.id, usuarioId: u.id, solicitanteId: res.locals.funcionario.id, emailAnterior: u.email, novoEmail: email, justificativa: sanitizar(justificativa) } });
      await tx.suporteHistorico.create({ data: { chamadoId: c.id, operadorId: res.locals.funcionario.id, acao: 'RECUPERACAO_EXCEPCIONAL_SOLICITADA', motivo: 'Aguardando verificação independente e aprovação do administrador.' } });
      return p.id;
    }, { isolationLevel: 'Serializable' });
    res.status(pedido ? 201 : 409).json(pedido ? { id: pedido } : { error: 'Já existe solicitação em andamento para esta conta.' });
  });
  r.post('/admin/equipe/chamados/:id/operacoes/recuperacao-excepcional/:pedido/decidir', async (req, res) => {
    const operador = res.locals.funcionario;
    if (operador.papel_plataforma !== 'SUPERADMIN') { res.sendStatus(403); return; }
    const p = await prisma.recuperacaoExcepcional.findFirst({ where: { id: String(req.params.pedido), chamadoId: String(req.params.id), OR: [{ status: { in: ['AGUARDANDO_APROVACAO', 'FALHA_ENVIO'] } }, { status: { in: ['ENVIANDO', 'AGUARDANDO_CONFIRMACAO'] }, expiraEm: { lte: new Date() } }] } });
    if (!p || p.solicitanteId === operador.id) { res.status(409).json({ error: 'Outro administrador deve revisar uma solicitação pendente.' }); return; }
    const { verificacao, aprovar } = req.body || {};
    if (typeof aprovar !== 'boolean' || typeof verificacao !== 'string' || verificacao.trim().length < 20 || verificacao.length > 2000) { res.status(400).json({ error: 'Registre como verificou a identidade por canal independente, sem documentos completos ou segredos.' }); return; }
    if (aprovar && !emailRecuperacaoConfigurado()) { res.status(503).json({ error: 'Configure o provedor antes de aprovar.' }); return; }
    const token = randomBytes(32).toString('base64url');
    const alterado = await prisma.recuperacaoExcepcional.updateMany({ where: { id: p.id, status: p.status, atualizadoEm: p.atualizadoEm }, data: { aprovadorId: operador.id, verificacao: sanitizar(verificacao), status: aprovar ? 'ENVIANDO' : 'REJEITADA', tokenHash: aprovar ? hash(token) : null, expiraEm: new Date(Date.now() + 3600000) } });
    if (!alterado.count) { res.status(409).json({ error: 'Pedido já alterado.' }); return; }
    let status = 'REJEITADA';
    if (aprovar) {
      try { await enviar(p.novoEmail, 'Confirme a recuperação de acesso Ludora', `Uma alteração de e-mail foi aprovada após verificação de identidade. Abra ${destinoConfirmacao()} e informe seu novo endereço e este código: ${token}\nExpira em uma hora. Nunca compartilhe o código.`); status = 'AGUARDANDO_CONFIRMACAO'; }
      catch { status = 'FALHA_ENVIO'; }
    }
    await prisma.$transaction([
      prisma.recuperacaoExcepcional.update({ where: { id: p.id }, data: { status, ...(status === 'FALHA_ENVIO' ? { tokenHash: null } : {}) } }),
      prisma.suporteHistorico.create({ data: { chamadoId: p.chamadoId, operadorId: operador.id, acao: 'DECISAO_RECUPERACAO', motivo: `${status}: ${sanitizar(verificacao)}` } }),
    ]);
    res.json({ resultado: status });
  });
  r.post('/auth/confirmar-troca-email', limitarRecuperacao, async (req, res) => {
    const { email, codigo } = req.body || {};
    if (!emailValido(email) || typeof codigo !== 'string' || !/^[a-zA-Z0-9_-]{43}$/.test(codigo)) { res.status(400).json({ error: 'Código inválido ou expirado.' }); return; }
    const p = await prisma.recuperacaoExcepcional.findFirst({ where: { novoEmail: email.trim().toLowerCase(), tokenHash: hash(codigo), status: 'AGUARDANDO_CONFIRMACAO', expiraEm: { gt: new Date() } } });
    if (!p || parseSuperAdmins(process.env.SUPERADMIN_EMAILS).has(p.novoEmail) || parseSuperAdmins(process.env.SUPERADMIN_EMAILS).has(p.emailAnterior)) { res.status(400).json({ error: 'Código inválido ou expirado.' }); return; }
    const senha = await bcrypt.hash(randomBytes(32).toString('base64url'), 12);
    try {
      await prisma.$transaction(async tx => {
        const atualizado = await tx.usuario.updateMany({ where: { id: p.usuarioId, email: p.emailAnterior, papel_plataforma: 'USUARIO' }, data: { email: p.novoEmail, senha, versao_sessao: { increment: 1 } } });
        const consumido = await tx.recuperacaoExcepcional.updateMany({ where: { id: p.id, status: 'AGUARDANDO_CONFIRMACAO', tokenHash: hash(codigo), expiraEm: { gt: new Date() } }, data: { status: 'CONCLUIDA', tokenHash: null } });
        if (!atualizado.count || !consumido.count) throw new Error('Conflito');
        await tx.recuperacaoSenha.deleteMany({ where: { usuario_id: p.usuarioId } });
        await tx.suporteHistorico.create({ data: { chamadoId: p.chamadoId, acao: 'EMAIL_CONFIRMADO', motivo: 'Cliente confirmou o endereço. Sessões revogadas.', publico: true } });
      }, { isolationLevel: 'Serializable' });
    } catch { res.status(409).json({ error: 'Conta alterada ou endereço indisponível. Solicite revisão do suporte.' }); return; }
    desconectarSessoes(io, p.usuarioId);
    let aviso = 'AVISO_ANTIGO_ENVIADO';
    try { await enviar(p.emailAnterior, 'Endereço de acesso Ludora alterado', 'Seu endereço de acesso foi alterado após recuperação assistida. Se não reconhece a ação, procure o suporte. As sessões anteriores foram encerradas.'); } catch { aviso = 'FALHA_AVISO_ANTIGO'; }
    await prisma.suporteHistorico.create({ data: { chamadoId: p.chamadoId, acao: aviso, motivo: 'Resultado da notificação ao endereço anterior.' } });
    res.json({ mensagem: 'Endereço confirmado. Use Recuperar senha com seu novo e-mail para definir sua senha.' });
  });
  return r;
}
