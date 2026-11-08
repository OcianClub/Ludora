import type { GestaoPartida } from '../services/sharedMatches';

export type MatchEvent = GestaoPartida['eventos'][number];

export function eventScores(data: GestaoPartida) {
  let home = data.partida.gols_mandante;
  let away = data.partida.gols_visitante;
  const scores = new Map<number, string>();
  for (const event of [...data.eventos].sort((a, b) => b.id - a.id)) {
    if (event.tipo !== 'GOL' || !event.time_id) continue;
    scores.set(event.id, `${home} - ${away}`);
    if (event.time_id === data.partida.mandante_id) home = Math.max(0, home - 1);
    else away = Math.max(0, away - 1);
  }
  return scores;
}

export function eventAuthorTeam(data: GestaoPartida, event: MatchEvent) {
  if (!event.time_id) return undefined;
  return event.gol_contra
    ? event.time_id === data.partida.mandante_id
      ? data.partida.visitante_id
      : data.partida.mandante_id
    : event.time_id;
}

export function pendingGoal(data: GestaoPartida, event: MatchEvent) {
  return event.tipo === 'GOL' && pendingAuthor(data, event);
}

export function pendingAuthor(data: GestaoPartida, event: MatchEvent) {
  return (
    !event.jogador_id &&
    data.equipes.some((team) => team.time_id === eventAuthorTeam(data, event))
  );
}

export function canIdentifyGoal(data: GestaoPartida, event: MatchEvent, clubId?: number) {
  return (
    data.podeSumula ||
    (data.partida.status === 'FINALIZADA' && data.podeCorrigir === true) ||
    (data.partida.status !== 'FINALIZADA' && data.podePreparar &&
      pendingGoal(data, event) &&
      data.equipes.some(
        (team) => team.clube_id === clubId && team.time_id === eventAuthorTeam(data, event),
      ))
  );
}
