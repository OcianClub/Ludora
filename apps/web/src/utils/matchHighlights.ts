import type { GestaoPartida } from '../services/sharedMatches';
import { matchInsights } from './matchInsights';

export function recordHighlights(data: GestaoPartida, period: number | null) {
  const teams = matchInsights(data, period);
  const leaders = (key: 'attack' | 'saves') => {
    const players = teams.flatMap(team => team[key].map(player => ({ ...player, teamId: team.id, teamName: team.name })));
    const max = Math.max(0, ...players.map(player => player[key]));
    return max ? players.filter(player => player[key] === max) : [];
  };
  return { attack: leaders('attack'), saves: leaders('saves'), unidentified: teams.some(team => team.unidentified > 0) };
}
