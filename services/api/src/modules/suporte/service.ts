import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { classificar, fingerprint, rotaSegura, sanitizar } from './rules';

export function pistasStack(stack: unknown) {
  return String(stack || '').split('\n').slice(1, 12).flatMap(linha => {
    const match = linha.match(/([\w.-]+\.(?:[cm]?js|tsx?)):(\d+):(\d+)/);
    return match ? [{ arquivo: match[1], linha: Number(match[2]), coluna: Number(match[3]), natureza: 'PISTA_NAO_CONFIRMADA' }] : [];
  });
}

export async function registrarFalha(input: { servico: string; rota: string; correlacao: string; clubeId?: number; status: number; stack?: unknown; versao?: unknown }) {
  const rota = rotaSegura(input.rota);
  const chave = fingerprint(input.servico, rota, String(input.status));
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      return await prisma.$transaction(async tx => {
        const anterior = await tx.suporteChamado.findUnique({ where: { fingerprint: chave } });
        const clubes = new Set<number>(Array.isArray(anterior?.clubesAfetados) ? anterior.clubesAfetados as number[] : []);
        if (input.clubeId) clubes.add(input.clubeId);
        const ocorrencias = (anterior?.ocorrencias || 0) + 1;
        const calculada = classificar(/auth|senha|convite.*codigo/i.test(rota) ? 'SEGURANCA' : 'ERRO', ocorrencias, clubes.size, input.status);
        const revisada = anterior && (anterior.restrito || anterior.regra === 'REVISAO_HUMANA');
        const classificacao = revisada && !calculada.restrito
          ? { restrito: anterior.restrito, fila: anterior.fila, prioridade: anterior.prioridade, regra: anterior.regra }
          : { ...calculada, ...(anterior?.status === 'ENCAMINHADO_DEVS' && !calculada.restrito ? { fila: 'DESENVOLVIMENTO' } : {}) };
        const novoPrazo = Date.now() + (classificacao.prioridade === 'ALTA' ? 4 : 24) * 3600000;
        const revisarEm = anterior?.revisarEm && anterior.status !== 'RESOLVIDO'
          ? new Date(Math.min(anterior.revisarEm.getTime(), novoPrazo)) : new Date(novoPrazo);
        const detalhesTecnicos = { correlacao: input.correlacao, statusHttp: input.status, pistas: pistasStack(input.stack) };
        const dados = {
          ocorrencias, clubesAfetados: [...clubes], detalhesTecnicos,
          ...classificacao,
          revisarEm,
        };
        const chamado = anterior
          ? await tx.suporteChamado.update({ where: { id: anterior.id }, data: {
            ...dados, revisao: { increment: 1 }, ...(anterior.status === 'RESOLVIDO' ? { status: 'REABERTO' } : {}),
          } })
          : await tx.suporteChamado.create({ data: {
            ...dados, requestId: input.correlacao, fingerprint: chave, origem: 'AUTOMATICO', assunto: 'Falha detectada pelo sistema',
            descricao: 'Uma operação falhou. Conferir alcance e passos de reprodução.', impacto: 'OPERACAO_BLOQUEADA',
            tipo: 'ERRO', rota, servico: input.servico, versao: sanitizar(input.versao || process.env.APP_VERSION || 'desenvolvimento', 60),
          } });
        await tx.suporteHistorico.create({ data: {
          chamadoId: chamado.id, acao: 'OCORRENCIA', motivo: classificacao.regra,
          dados: { correlacao: input.correlacao, clubeId: input.clubeId || null, status: input.status },
        } });
        return chamado.id;
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (tentativa === 2 || !['P2034', 'P2002'].includes((error as any).code)) throw error;
    }
  }
}

export const correlacionarFalhas: RequestHandler = (req, res, next) => {
  const recebido = req.header('x-request-id');
  const correlacao = recebido && /^[a-f\d-]{36}$/i.test(recebido) ? recebido : randomUUID();
  res.locals.correlacao = correlacao;
  res.setHeader('X-Correlation-Id', correlacao);
  res.appendHeader('Access-Control-Expose-Headers', 'X-Correlation-Id');
  res.once('finish', () => {
    if (res.statusCode < 500 || req.path.startsWith('/suporte') || req.path.startsWith('/admin/equipe')) return;
    void registrarFalha({
      servico: 'api', rota: req.path, correlacao, status: res.statusCode,
      clubeId: (req as any).clubeId, stack: res.locals.stackSuporte,
    }).catch(() => console.error('Falha ao persistir ocorrência técnica.'));
  });
  next();
};

export function dadosPublicos(chamado: any) {
  return {
    id: chamado.id, assunto: chamado.assunto, descricao: chamado.descricao,
    status: chamado.status, criadoEm: chamado.criadoEm, atualizadoEm: chamado.atualizadoEm,
    historico: chamado.historico?.filter((h: any) => h.publico).map((h: any) => ({ acao: h.acao, motivo: h.motivo, criadoEm: h.criadoEm })),
  };
}
