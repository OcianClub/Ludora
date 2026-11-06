/** Benchmark local de processamento; não mede FPS, rede ou latência no aparelho. */
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { indexarEstatisticasJogadores, ESTATISTICAS_VAZIAS } from "../src/utils/sumulaPartida";
import type { EventoPartida } from "../src/services/partidasCompartilhadas";

// Algoritmo anterior: varredura de todos os eventos para cada atleta e para cada tipo.
function anterior(eventos: EventoPartida[], jogadorId: number, periodo?: number) {
  const atuais = eventos.filter(e => e.jogador_id === jogadorId && (periodo == null || e.periodo === periodo));
  const contar = (tipo: string) => atuais.filter(e => e.tipo === tipo && !(tipo === "GOL" && e.gol_contra)).length;
  return { gols: contar("GOL"), assistencias: contar("ASSISTENCIA"), faltas: contar("FALTA"), amarelos: contar("CARTAO_AMARELO"), vermelhos: contar("CARTAO_VERMELHO"), azuis: contar("CARTAO_AZUL"), defesas: contar("DEFESA") };
}
function mediana(tarefa: () => unknown) {
  for (let i = 0; i < 100; i++) tarefa();
  const amostras: number[] = [];
  for (let rodada = 0; rodada < 9; rodada++) {
    const inicio = performance.now();
    for (let i = 0; i < 500; i++) tarefa();
    amostras.push((performance.now() - inicio) / 500);
  }
  return amostras.sort((a, b) => a - b)[4];
}
for (const quantidade of [80, 400, 1600]) {
  const tipos = ["GOL", "ASSISTENCIA", "FALTA", "CARTAO_AMARELO", "CARTAO_VERMELHO", "CARTAO_AZUL", "DEFESA"];
  const eventos: EventoPartida[] = Array.from({ length: quantidade }, (_, i) => ({ id: i + 1, jogador_id: i % 20 + 1, tipo: tipos[i % tipos.length], periodo: i % 4 + 1, gol_contra: i % 13 === 0 }));
  const ids = Array.from({ length: 20 }, (_, i) => i + 1);
  for (const periodo of [undefined, 1, 2, 3, 4]) {
    const indice = indexarEstatisticasJogadores(eventos, periodo);
    assert.deepEqual(ids.map(id => indice.get(id) || ESTATISTICAS_VAZIAS), ids.map(id => anterior(eventos, id, periodo)));
  }
  const antesMs = mediana(() => ids.map(id => anterior(eventos, id)));
  const depoisMs = mediana(() => {
    const indice = indexarEstatisticasJogadores(eventos);
    return ids.map(id => indice.get(id) || ESTATISTICAS_VAZIAS);
  });
  console.log(JSON.stringify({ eventos: quantidade, jogadores: 20, antesMs, depoisMs, reducaoPercentual: (1 - depoisMs / antesMs) * 100 }));
}
