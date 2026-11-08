import type { GestaoPartida } from '../services/sharedMatches';
import { eventAuthorTeam } from './matchEvents';
import { MATCH_METRICS, matchInsights } from './matchInsights';
import { matchWinner } from './matchResult';
import { recordHighlights } from './matchHighlights';

/** Export only public match information. Private lineup drafts never enter the image. */
export function matchShareModel(data: GestaoPartida, includeNames = false, includeHighlights = false) {
  const p = data.partida;
  const teams = matchInsights(data, null);
  const winner = matchWinner(data);
  const records = includeHighlights ? recordHighlights(data, null) : null;
  const publicPlayer = (player: {name: string; shirt: number; teamName: string}, detail: string) => ({
    name: includeNames ? player.name : `Camisa ${String(player.shirt).padStart(2, '0')}`, shirt: player.shirt, team: player.teamName, detail,
  });
  return {
    title: data.paulista ? 'Placar anotado pelo clube' : 'Resultado final',
    outcome: winner ? `Vitória do ${winner.name}!` : 'Empate entre as equipes',
    winnerId: winner?.id,
    date: new Date(`${p.data.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR'),
    time: p.horario || '', category: p.categoria?.nome?.toUpperCase() || '',
    competition: p.competicao?.nome || 'Sem competição informada', location: p.local || '',
    annotation: Boolean(data.paulista),
    highlights: records ? [
      { label: 'Participação em gols', players: records.attack.map(player => publicPlayer(player, `${player.goals} ${player.goals === 1 ? 'gol' : 'gols'} · ${player.assists} assist.`)) },
      { label: 'Defesas registradas', players: records.saves.map(player => publicPlayer(player, `${player.saves} ${player.saves === 1 ? 'defesa' : 'defesas'}`)) },
    ] : [],
    metrics: MATCH_METRICS.map(([key, label]) => ({ label, values: teams.map(team => team.totals[key]) })),
    teams: teams.map(team => {
      const goals = new Map<string, { name: string; count: number; own: boolean }>();
      if (includeNames) for (const event of data.eventos) {
        if (event.tipo !== 'GOL' || event.time_id !== team.id) continue;
        const authorTeam = eventAuthorTeam(data, event);
        const published = data.equipes.find(row => row.time_id === authorTeam && row.publicada_em);
        const player = published?.escalacao.find(row => row.jogador_id === event.jogador_id);
        const registered = data.equipes.some(row => row.time_id === authorTeam);
        const name = player?.jogador?.nome || (registered ? 'Jogador não identificado' : 'Gol da equipe');
        const key = `${player?.jogador_id ?? name}:${Boolean(event.gol_contra)}`;
        const group = goals.get(key) || { name, count: 0, own: Boolean(event.gol_contra) };
        group.count++;
        goals.set(key, group);
      }
      return { id: team.id, name: team.name, badge: team.badge, score: team.totals.GOL,
        goals: [...goals.values()],
      };
    }),
  };
}
