import type { PerfilJogador } from '../services/api';

export const SCOUT_PROFILES = ['Artilheiro', 'Armador', 'Paredão'] as const;
export const SCOUT_ORDERS = [
  { value: 'rating', label: 'Índice' }, { value: 'goals', label: 'Gols' },
  { value: 'assists', label: 'Assistências' }, { value: 'saves', label: 'Defesas' },
  { value: 'games', label: 'Escalações' }, { value: 'name', label: 'Nome A–Z' }, { value: 'shirt', label: 'Camisa' },
];
export const profileDescription: Record<string, string> = {
  Artilheiro: 'Perfil associado à finalização e à participação ofensiva.',
  Armador: 'Perfil associado à visão de jogo e à criação de jogadas.',
  Paredão: 'Perfil associado às ações defensivas registradas.',
};
export function hasAssessment(player: PerfilJogador) {
  return !!player.perfil_ml && !/^sem\b/i.test(player.perfil_ml) && typeof player.nota_geral === 'number' && Number.isFinite(player.nota_geral);
}
export function profileClass(player: PerfilJogador) {
  return hasAssessment(player) ? player.perfil_ml === 'Armador' ? 'playmaker' : player.perfil_ml === 'Paredão' ? 'keeper' : 'scorer' : 'pending';
}
export function searchScout(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}
export function sortScout(players: PerfilJogador[], order: string, ascending = ['name', 'shirt'].includes(order)) {
  const field = { goals: 'totalGols', assists: 'totalAssistencias', saves: 'totalDefesas', games: 'totalPartidas' } as const;
  return [...players].sort((a, b) => {
    if (order === 'rating' && hasAssessment(a) !== hasAssessment(b)) return hasAssessment(a) ? -1 : 1;
    if (order === 'shirt' && (a.numCamisa == null) !== (b.numCamisa == null)) return a.numCamisa == null ? 1 : -1;
    let difference = 0;
    if (order === 'rating') difference = (hasAssessment(b) ? b.nota_geral! : -1) - (hasAssessment(a) ? a.nota_geral! : -1);
    else if (order === 'shirt') difference = (a.numCamisa ?? Infinity) - (b.numCamisa ?? Infinity);
    else if (order in field) {
      const key = field[order as keyof typeof field];
      difference = b[key] - a[key];
    }
    if ((ascending && !['name', 'shirt'].includes(order)) || (!ascending && ['name', 'shirt'].includes(order))) difference *= -1;
    if (order === 'name') difference = (ascending ? 1 : -1) * a.nome.localeCompare(b.nome, 'pt-BR');
    return difference || a.nome.localeCompare(b.nome, 'pt-BR') || a.id - b.id;
  });
}
