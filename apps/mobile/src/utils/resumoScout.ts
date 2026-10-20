import type { Jogador } from '../services/mlService';

export interface ResumoCategoria {
  artilheiro: { nome: string; gols: number } | null;
  assistente: { nome: string; assistencias: number; colocacao: number } | null;
  lider: { nome: string; pontos: number } | null;
}

export function calcularResumo(jogadores: Jogador[]): ResumoCategoria {
  if (!jogadores.length)
    return { artilheiro: null, assistente: null, lider: null };
  let artilheiro = jogadores[0];
  let assistente = jogadores[0];
  let lider = jogadores[0];
  for (let indice = 1; indice < jogadores.length; indice++) {
    const jogador = jogadores[indice];
    if (jogador.gols > artilheiro.gols) artilheiro = jogador;
    if (jogador.assistencias > assistente.assistencias) assistente = jogador;
    if (jogador.nota_geral > lider.nota_geral) lider = jogador;
  }
  return {
    artilheiro: { nome: artilheiro.nome, gols: artilheiro.gols },
    assistente: {
      nome: assistente.nome,
      assistencias: assistente.assistencias,
      colocacao: 1,
    },
    lider: { nome: lider.nome, pontos: Math.round(lider.nota_geral) },
  };
}
