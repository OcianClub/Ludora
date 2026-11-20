import axios from 'axios';
import { isDeepStrictEqual } from 'node:util';

import { PYTHON_AI_URL } from '../config/env';
import { prisma } from '../lib/prisma';
import { validarResultadosScout } from './scout-result';

type EscopoScout = Set<number> | 'clube';
const emExecucao = new Map<number, { pendente?: EscopoScout; promessa: Promise<void> }>();

export function processarMachineLearning(clubeId?: number, partidaId?: number): Promise<void> {
  const chave = clubeId ?? 0;
  const atual = emExecucao.get(chave);
  if (atual) {
    if (!partidaId) atual.pendente = 'clube';
    else if (atual.pendente !== 'clube') {
      atual.pendente ??= new Set();
      atual.pendente.add(partidaId);
    }
    return atual.promessa;
  }
  const job: { pendente?: EscopoScout; promessa: Promise<void> } = {
    pendente: partidaId ? new Set([partidaId]) : 'clube',
    promessa: Promise.resolve(),
  };
  job.promessa = (async () => {
    while (job.pendente) {
      const escopo = job.pendente;
      job.pendente = undefined;
      await executarAnalise(clubeId, escopo);
    }
  })().finally(() => emExecucao.delete(chave));
  emExecucao.set(chave, job);
  return job.promessa;
}

async function executarAnalise(clubeId: number | undefined, escopo: EscopoScout) {
  if (!PYTHON_AI_URL) {
    console.warn(
      'Scout IA: PYTHON_AI_URL não definida, pulando processamento.'
    );
    return;
  }

  const categoriaClube = clubeId ? { categoria: { clube_id: clubeId } } : {};
  const categoriasAfetadas = escopo === 'clube' ? null : await prisma.jogador.findMany({
    where: { ativo: true, ...categoriaClube, OR: [
      { escalacoes: { some: { partida_id: { in: [...escopo] } } } },
      { eventos: { some: { partida_id: { in: [...escopo] } } } },
    ] },
    distinct: ['categoria_id'],
    select: { categoria_id: true },
  });
  if (categoriasAfetadas?.length === 0) return;
  const jogadores = await prisma.jogador.findMany({
    where: {
      ativo: true,
      ...categoriaClube,
      ...(categoriasAfetadas ? { categoria_id: { in: categoriasAfetadas.map(c => c.categoria_id) } } : {}),
    },
    select: {
      id: true,
      categoria_id: true,
      posicao: true,
      perfil_ml: true,
      scores_ml: true,
      nota_geral: true,
      _count: {
        select: {
          escalacoes: { where: { partida: { status: 'FINALIZADA' } } },
        },
      },
    },
  });

  const eventos = jogadores.length
    ? await prisma.evento.groupBy({
        by: ['jogador_id', 'tipo'],
        where: {
          jogador_id: { in: jogadores.map((jogador) => jogador.id) },
          gol_contra: false,
          partida: { status: 'FINALIZADA' },
        },
        _count: { _all: true },
      })
    : [];
  const estatisticas = new Map<number, Record<string, number>>();
  for (const evento of eventos) {
    if (evento.jogador_id === null) continue;
    const stats = estatisticas.get(evento.jogador_id) || {};
    stats[evento.tipo] = evento._count._all;
    estatisticas.set(evento.jogador_id, stats);
  }

  const payload = jogadores.map((j) => {
    const stats = estatisticas.get(j.id) || {};
    const jogos = j._count.escalacoes;
    return {
      jogador_id: j.id,
      categoria_id: j.categoria_id,
      posicao: j.posicao,
      GOL: stats['GOL'] || 0,
      ASSISTENCIA: stats['ASSISTENCIA'] || 0,
      DEFESA: stats['DEFESA'] || 0,
      CARTAO_AMARELO: stats['CARTAO_AMARELO'] || 0,
      CARTAO_VERMELHO: stats['CARTAO_VERMELHO'] || 0,
      FALTA: stats['FALTA'] || 0,
      jogos_disputados: jogos,
    };
  });

  if (!payload.length) return;

  try {
    console.log(
      `Scout IA: Enviando ${payload.length} jogadores para o Python...`
    );
    const resposta = await axios.post(
      `${PYTHON_AI_URL}/internal/ml/treinar-perfis`,
      payload,
      {
        timeout: 120000,
        maxRedirects: 0,
        maxContentLength: 4 * 1024 * 1024,
        headers: process.env.ML_API_KEY
          ? { 'X-ML-API-Key': process.env.ML_API_KEY }
          : undefined,
      }
    );
    const resultados = validarResultadosScout(
      resposta.data,
      new Set(payload.map((jogador) => jogador.jogador_id))
    );
    const grupos = new Map(
      jogadores.map((j) => [
        j.id,
        `${j.categoria_id}:${j.posicao
          .trim()
          .toLowerCase()
          .replace(/^alas?$/, 'ala')}`,
      ])
    );
    for (const resultado of resultados) {
      if (
        resultado.semelhantes.some(
          (s) => grupos.get(s.jogador_id) !== grupos.get(resultado.jogador_id)
        )
      ) {
        throw new Error('Grupo inválido no Scout IA');
      }
    }
    const porId = new Map(jogadores.map(jogador => [jogador.id, jogador]));
    const alterados = resultados.flatMap(resultado => {
      const jogador = porId.get(resultado.jogador_id);
      if (!jogador) return [];
      const scores = jogador.scores_ml;
      const salvo = scores && typeof scores === 'object' && !Array.isArray(scores) ? { ...scores } : null;
      if (salvo) delete salvo.calculado_em;
      if (jogador.perfil_ml === resultado.perfil_ml && jogador.nota_geral === resultado.nota_geral
          && isDeepStrictEqual(salvo, resultado)) return [];
      return [prisma.jogador.updateMany({
        where: { id: jogador.id, ativo: true, categoria_id: jogador.categoria_id, posicao: jogador.posicao },
        data: {
          perfil_ml: resultado.perfil_ml,
          scores_ml: { ...resultado, calculado_em: new Date().toISOString() },
          nota_geral: resultado.nota_geral,
        },
      })];
    });
    const atualizacoes = alterados.length ? await prisma.$transaction(alterados) : [];
    console.log(`Scout IA: ${resultados.length} jogadores analisados, ${atualizacoes.reduce((total, item) => total + item.count, 0)} atualizados.`);
  } catch (error: any) {
    console.error(
      'Falha no processamento do Scout IA:',
      axios.isAxiosError(error)
        ? error.response?.status === 401
          ? 'Serviço Python recusou a autenticação. Confira ML_API_KEY nos dois serviços.'
          : error.response?.status === 404
            ? 'Rota de análise não encontrada. Confira PYTHON_AI_URL e a versão publicada do Python.'
            : error.code === 'ECONNABORTED'
              ? 'O Python não respondeu em 120 segundos. Confira o estado e os logs do serviço ML.'
              : `HTTP ${error.response?.status ?? 'sem resposta'} (${error.code || 'falha de rede'})`
        : 'Resposta inválida'
    );
  }
}
