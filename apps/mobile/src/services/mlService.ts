import { apiFetch } from './api';
import { ErroConsulta } from '../utils/request';
import {
  contextoScoutValido,
  type ContextoScout,
} from '../utils/contextoScout';

export async function obterContextoScout(
  jogadorId: number,
  clubeId: number,
  signal?: AbortSignal
): Promise<ContextoScout> {
  const resposta = await apiFetch(`/jogadores/${jogadorId}/scout-contexto`, {
    headers: { 'x-clube-id': String(clubeId) },
    signal,
  });
  if (!resposta.ok)
    throw new ErroConsulta(
      resposta.status,
      resposta.status === 404
        ? 'Este atleta não está disponível neste clube ou na sua categoria de acesso.'
        : 'Não foi possível carregar o histórico do atleta. Tente novamente.'
    );
  const dados: unknown = await resposta.json().catch(() => null);
  if (!contextoScoutValido(dados, jogadorId))
    throw new ErroConsulta(
      502,
      'Não foi possível confirmar o histórico do atleta. Tente novamente.'
    );
  return dados;
}

export interface ScoresMl {
  finalizacao: number;
  visao_de_jogo: number;
  defesa: number;
  disciplina: number;
  intensidade: number;
  tecnica: number;
}

export interface Jogador {
  id_jogador: number;
  nome: string;
  posicao: string;
  numCamisa: number | null;
  idade: number;
  perfil_ml: string;
  scores_ml: ScoresMl | null;
  nota_geral: number;
  categoria: string;
  categoria_tipo: 'INICIACAO' | 'BASE';
  categoria_id: number;
  time: string;
  jogos_disputados: number;
  gols: number;
  assistencias: number;
  defesas: number;
  cartoes_amarelos: number;
  cartoes_vermelhos: number;
  faltas_cometidas: number;
}

export { calcularResumo } from '../utils/resumoScout';
export type { ResumoCategoria } from '../utils/resumoScout';

export const obterPerfisJogadores = async (
  categoria_id?: number,
  clubeId?: number
): Promise<Jogador[]> => {
  const query = categoria_id ? `?categoria_id=${categoria_id}` : '';
  const resposta = await apiFetch(
    `/jogadores/perfis${query}`,
    clubeId ? { headers: { 'x-clube-id': String(clubeId) } } : undefined
  );
  if (!resposta.ok)
    throw new ErroConsulta(
      resposta.status,
      'Não foi possível carregar as estatísticas.'
    );
  const dados: Jogador[] = await resposta.json().catch(() => null);
  if (!Array.isArray(dados))
    throw new ErroConsulta(
      502,
      'Não foi possível confirmar os dados das estatísticas.'
    );

  return dados.map((j) => ({
    ...j,
    scores_ml: j.scores_ml
      ? {
          finalizacao: j.scores_ml.finalizacao ?? 0,
          visao_de_jogo: j.scores_ml.visao_de_jogo ?? 0,
          defesa: j.scores_ml.defesa ?? 0,
          disciplina: j.scores_ml.disciplina ?? 0,
          intensidade: j.scores_ml.intensidade ?? 0,
          tecnica: j.scores_ml.tecnica ?? 0,
        }
      : null,
  }));
};

export const reprocessarScout = async (): Promise<void> => {
  const resposta = await apiFetch('/admin/reprocessar-scout', {
    method: 'POST',
  });
  if (!resposta.ok) throw new Error('Erro ao reprocessar Scout IA');
};
