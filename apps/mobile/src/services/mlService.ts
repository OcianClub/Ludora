import * as SecureStore from "expo-secure-store";
import { apiFetch, revisaoConsultasRecentes } from "./api";
import { criarCacheDadosScout } from "../utils/cacheDadosScout";
import { ErroConsulta } from "../utils/request";
import {
  contextoScoutValido,
  type ContextoScout,
} from "../utils/contextoScout";

const cacheContextos = criarCacheDadosScout<ContextoScout>();
const cachePerfis = criarCacheDadosScout<Jogador[]>();
async function escopoScout(clubeId?: number) {
  const [token, clube] = await Promise.all([
    SecureStore.getItemAsync("userToken"),
    clubeId
      ? Promise.resolve(String(clubeId))
      : SecureStore.getItemAsync("clubeAtivoId"),
  ]);
  return {
    chave: JSON.stringify([token, clube, revisaoConsultasRecentes()]),
    identidade: JSON.stringify([token, clube]),
  };
}
export async function obterContextoScout(
  jogadorId: number,
  clubeId: number,
  signal?: AbortSignal,
  filtro: import("../utils/contextoScout").FiltroContextoScout = {},
  revalidar = false,
  onCache?: (dados: ContextoScout) => void,
): Promise<ContextoScout> {
  const escopo = await escopoScout(clubeId);
  const query = Object.entries(filtro)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const chave = `${escopo.chave}:${jogadorId}:${query}`;
  const salvo = cacheContextos.ler(chave);
  if (salvo && !signal?.aborted) onCache?.(salvo);
  return cacheContextos.consultar(
    chave,
    async () => {
      // O cancelamento pertence ao consumidor. Uma consulta compartilhada pode
      // terminar e atender quem reabrir a mesma ficha sem repetir a chamada.
      const resposta = await apiFetch(
        `/jogadores/${jogadorId}/scout-contexto${query ? `?${query}` : ""}`,
        {
          headers: { "x-clube-id": String(clubeId) },
          revalidar,
        },
      );
      if (!resposta.ok)
        throw new ErroConsulta(
          resposta.status,
          resposta.status === 404
            ? "Este atleta não está disponível neste clube ou na sua categoria de acesso."
            : "Não foi possível carregar o histórico do atleta. Tente novamente.",
        );
      const dados: unknown = await resposta.json().catch(() => null);
      if (!contextoScoutValido(dados, jogadorId))
        throw new ErroConsulta(
          502,
          "Não foi possível confirmar o histórico do atleta. Tente novamente.",
        );
      if (escopo.identidade !== (await escopoScout(clubeId)).identidade)
        throw Object.assign(new Error("O contexto da consulta mudou."), {
          name: "AbortError",
        });
      return dados;
    },
    signal,
    revalidar,
  );
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
  analise_scout?: {
    versao: 2;
    calculado_em: string;
    convocacoes: number;
    grupo_tamanho: number;
  } | null;
  id_jogador: number;
  nome: string;
  posicao: string;
  numCamisa: number | null;
  idade: number;
  perfil_ml: string;
  scores_ml: ScoresMl | null;
  nota_geral: number;
  categoria: string;
  categoria_tipo: "INICIACAO" | "BASE";
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

export { calcularResumo } from "../utils/resumoScout";
export type { ResumoCategoria } from "../utils/resumoScout";

export const obterPerfisJogadores = async (
  categoria_id?: number,
  clubeId?: number,
  revalidar = false,
): Promise<Jogador[]> => {
  const escopo = await escopoScout(clubeId);
  return cachePerfis.consultar(
    `${escopo.chave}:perfis:${categoria_id ?? ""}`,
    async () => {
      const query = categoria_id ? `?categoria_id=${categoria_id}` : "";
      const resposta = await apiFetch(`/jogadores/perfis${query}`, {
        revalidar,
        ...(clubeId ? { headers: { "x-clube-id": String(clubeId) } } : {}),
      });
      if (!resposta.ok)
        throw new ErroConsulta(
          resposta.status,
          "Não foi possível carregar as estatísticas.",
        );
      const dados: Jogador[] = await resposta.json().catch(() => null);
      if (!Array.isArray(dados))
        throw new ErroConsulta(
          502,
          "Não foi possível confirmar os dados das estatísticas.",
        );

      if (escopo.identidade !== (await escopoScout(clubeId)).identidade)
        throw Object.assign(new Error("A sessão da consulta mudou."), {
          name: "AbortError",
        });
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
    },
    undefined,
    revalidar,
  );
};

export const reprocessarScout = async (): Promise<void> => {
  const resposta = await apiFetch("/admin/reprocessar-scout", {
    method: "POST",
  });
  if (!resposta.ok) throw new Error("Erro ao reprocessar Scout IA");
};
