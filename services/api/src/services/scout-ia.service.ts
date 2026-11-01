import axios from 'axios';

import { PYTHON_AI_URL } from '../config/env';
import { prisma } from '../lib/prisma';
import { validarResultadosScout } from './scout-result';

export async function processarMachineLearning(clubeId?: number) {
  if (!PYTHON_AI_URL) {
    console.warn('Scout IA: PYTHON_AI_URL não definida, pulando processamento.');
    return;
  }

  const jogadores = await prisma.jogador.findMany({
    where: {
      ativo: true,
      ...(clubeId ? { categoria: { clube_id: clubeId } } : {}),
    },
    select: {
      id: true,
      _count: { select: { escalacoes: { where: { partida: { status: { in: ['AO_VIVO', 'FINALIZADA'] } } } } } },
    },
  });

  const eventos = jogadores.length ? await prisma.evento.groupBy({
    by: ['jogador_id', 'tipo'],
    where: { jogador_id: { in: jogadores.map(jogador => jogador.id) }, gol_contra: false, partida: { status: { in: ['AO_VIVO', 'FINALIZADA'] } } },
    _count: { _all: true },
  }) : [];
  const estatisticas = new Map<number, Record<string, number>>();
  for (const evento of eventos) {
    if (evento.jogador_id === null) continue;
    const stats = estatisticas.get(evento.jogador_id) || {};
    stats[evento.tipo] = evento._count._all;
    estatisticas.set(evento.jogador_id, stats);
  }

  const payload = jogadores
    .map(j => {
      const stats = estatisticas.get(j.id) || {};
      const jogos = j._count.escalacoes;
      if (jogos === 0) return null;
      return {
        jogador_id:       j.id,
        GOL:              stats['GOL']             || 0,
        ASSISTENCIA:      stats['ASSISTENCIA']     || 0,
        DEFESA:           stats['DEFESA']          || 0,
        CARTAO_AMARELO:   stats['CARTAO_AMARELO']  || 0,
        CARTAO_VERMELHO:  stats['CARTAO_VERMELHO'] || 0,
        FALTA:            stats['FALTA']           || 0,
        jogos_disputados: jogos,
      };
    })
    .filter((jogador): jogador is NonNullable<typeof jogador> => jogador !== null);

  if (payload.length < 3) {
    console.log('Scout IA: Jogadores insuficientes para calcular perfis.');
    return;
  }

  try {
    console.log(`Scout IA: Enviando ${payload.length} jogadores para o Python...`);
    const resposta = await axios.post(
      `${PYTHON_AI_URL}/internal/ml/treinar-perfis`,
      payload,
      {
        timeout: 120000,
        maxRedirects: 0,
        maxContentLength: 4 * 1024 * 1024,
        headers: process.env.ML_API_KEY ? { 'X-ML-API-Key': process.env.ML_API_KEY } : undefined,
      }
    );
    const resultados = validarResultadosScout(resposta.data, new Set(payload.map(jogador => jogador.jogador_id)));
    await prisma.$transaction(
      resultados.map(resultado => prisma.jogador.update({
        where: { id: resultado.jogador_id },
        data: {
          perfil_ml:  resultado.perfil_ml,
          scores_ml:  resultado.scores,
          nota_geral: resultado.nota_geral,
        },
      })),
    );
    console.log(`Scout IA: ${resposta.data.length} jogadores processados e atualizados. ✅`);
  } catch (error: any) {
    console.error('Falha no processamento do Scout IA:', axios.isAxiosError(error) ? error.code || error.response?.status : 'Resposta inválida');
  }
}

