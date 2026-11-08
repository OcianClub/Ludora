import type { GestaoPartida } from '../services/sharedMatches';
import { eventAuthorTeam } from './matchEvents';

export const MATCH_METRICS = [
  ['GOL', 'Gols'], ['ASSISTENCIA', 'Assistências'], ['DEFESA', 'Defesas'], ['FALTA', 'Faltas cometidas'],
  ['CARTAO_AMARELO', 'Amarelos'], ['CARTAO_VERMELHO', 'Vermelhos'], ['CARTAO_AZUL', 'Azuis'],
] as const;
type Metric = typeof MATCH_METRICS[number][0];
const empty = () => Object.fromEntries(MATCH_METRICS.map(([key]) => [key, 0])) as Record<Metric, number>;

export function matchInsights(data: GestaoPartida, period: number | null) {
  const p = data.partida;
  return [p.mandante_id, p.visitante_id].map((id, index) => {
    const team = index === 0 ? p.mandante : p.visitante;
    const published = data.equipes.find(equipe => equipe.time_id === id && equipe.publicada_em);
    const totals = empty();
    const players = (published?.escalacao || []).map(row => ({
      id: row.jogador_id, name: row.jogador?.nome || `Camisa ${String(row.numCamisa).padStart(2, '0')}`,
      shirt: row.numCamisa, goals: 0, assists: 0, saves: 0, attack: 0,
    }));
    const byId = new Map(players.map(player => [player.id, player]));
    let unidentified = 0;
    for (const event of data.eventos) {
      if (period !== null && event.periodo !== period) continue;
      if (event.time_id === id && event.tipo in totals) totals[event.tipo as Metric]++;
      // Em gol contra, time_id indica quem recebeu o gol no placar, não quem o fez.
      if (eventAuthorTeam(data, event) !== id || event.gol_contra) continue;
      const player = event.jogador_id ? byId.get(event.jogador_id) : undefined;
      if (['GOL', 'ASSISTENCIA', 'DEFESA'].includes(event.tipo) && !player) unidentified++;
      if (!player) continue;
      if (event.tipo === 'GOL') player.goals++;
      if (event.tipo === 'ASSISTENCIA') player.assists++;
      if (event.tipo === 'DEFESA') player.saves++;
    }
    // O placar oficial pode conter correções sem eventos de gol correspondentes.
    if (period === null) totals.GOL = index === 0 ? p.gols_mandante : p.gols_visitante;
    for (const player of players) player.attack = player.goals * 5 + player.assists * 3;
    const leaders = (key: 'attack' | 'saves') => {
      const max = Math.max(0, ...players.map(player => player[key]));
      return max > 0 ? players.filter(player => player[key] === max) : [];
    };
    return { id, name: team?.nome || (index === 0 ? 'Mandante' : 'Visitante'), badge: team?.escudo,
      totals, attack: leaders('attack'), saves: leaders('saves'), unidentified,
      registered: data.equipes.some(equipe => equipe.time_id === id), published: Boolean(published) };
  });
}
