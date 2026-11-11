import type { EquipePartida, GestaoPartida } from '../services/partidasCompartilhadas';

/** Participantes Ludora da partida, na ordem mandante/visitante.
 * Um adversário externo não vira opção por ter gols ou outros eventos.
 * Equipes ainda sem escalação publicada continuam selecionáveis, sem expor rascunhos.
 */
export function equipesEscalacao(data: Pick<GestaoPartida, 'partida' | 'equipes'>): EquipePartida[] {
  return [data.partida.mandante_id, data.partida.visitante_id].flatMap((timeId) => {
    const equipe = data.equipes.find((item) => item.time_id === timeId && item.clube_id > 0);
    return equipe ? [equipe] : [];
  });
}

export function equipeEscalacaoVisivel(equipes: EquipePartida[], timeId: number | null, minhaEquipeId?: number) {
  return equipes.find((item) => item.time_id === timeId)
    ?? equipes.find((item) => item.id === minhaEquipeId)
    ?? equipes[0];
}
