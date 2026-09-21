import axios from 'axios';

import { PYTHON_AI_URL } from '../config/env';
import { prisma } from '../lib/prisma';

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
    include: { eventos: true, escalacoes: true }
  });

  const payload = jogadores
    .map(j => {
      const stats = j.eventos.reduce((acc: any, ev) => {
        acc[ev.tipo] = (acc[ev.tipo] || 0) + 1;
        return acc;
      }, {});
      const jogos = j.escalacoes ? j.escalacoes.length : 0;
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
    .filter(Boolean);

  if (payload.length < 3) {
    console.log('Scout IA: Jogadores insuficientes para calcular perfis.');
    return;
  }

  try {
    console.log(`Scout IA: Enviando ${payload.length} jogadores para o Python...`);
    const resposta = await axios.post(
      `${PYTHON_AI_URL}/internal/ml/treinar-perfis`,
      payload,
      { timeout: 120000 }
    );
    await prisma.$transaction(
      resposta.data.map((resultado: any) => prisma.jogador.update({
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
    console.error('Falha ao comunicar com microsserviço de IA Python:', error.message || error);
  }
}

