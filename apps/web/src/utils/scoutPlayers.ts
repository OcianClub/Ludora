import type { PerfilJogador } from '../services/api';

export const SCOUT_PROFILES = ['Artilheiro', 'Armador', 'Paredão', 'Misto'] as const;
export const SCOUT_ORDERS = [
  { value: 'rating', label: 'Convocações' }, { value: 'goals', label: 'Gols' },
  { value: 'assists', label: 'Assistências' }, { value: 'saves', label: 'Defesas' },
  { value: 'name', label: 'Nome A–Z' }, { value: 'shirt', label: 'Camisa' },
];
export const SCOUT_TABLE_COLUMNS = [
  { value: 'shirt', label: 'Camisa' }, { value: 'name', label: 'Nome' },
  { value: 'position', label: 'Posição' }, { value: 'age', label: 'Idade' },
  { value: 'rating', label: 'Convocações' }, { value: 'goals', label: 'Gols' },
  { value: 'assists', label: 'Assist' }, { value: 'saves', label: 'Defesas' },
  { value: 'profile', label: 'Perfil' },
];
export const scoutOrderStartsAscending = (order: string) => ['name', 'shirt', 'position', 'profile'].includes(order);
export function nextScoutOrder(current: string | null, next: string, ascending: boolean) {
  const initiallyAscending = scoutOrderStartsAscending(next);
  if (current !== next) return { ordem: next, direcao: initiallyAscending ? 'asc' : 'desc' };
  if (ascending !== initiallyAscending) return { ordem: '', direcao: '' };
  return { ordem: next, direcao: initiallyAscending ? 'desc' : 'asc' };
}
export const profileDescription: Record<string, string> = {
  Artilheiro: 'Gols predominam entre os eventos ofensivos e defesas registrados. Não é uma avaliação da qualidade de finalização.',
  Armador: 'Assistências predominam entre os eventos ofensivos e defesas registrados. Não mede toda a criação de jogadas.',
  Paredão: 'Defesas predominam entre os eventos ofensivos e defesas registrados. Não mede o aproveitamento do goleiro.',
  Misto: 'Há equilíbrio entre os tipos de contribuição registrados. O perfil não determina a posição do atleta.',
};
export function hasAssessment(player: PerfilJogador) {
  if (player.analise_scout?.versao === 2) return !!player.perfil_ml && player.perfil_ml !== 'Sem dados';
  return !!player.perfil_ml && !/^sem\b/i.test(player.perfil_ml) && typeof player.nota_geral === 'number' && Number.isFinite(player.nota_geral);
}
export function profileClass(player: PerfilJogador) {
  if (!hasAssessment(player)) return 'pending';
  switch (player.perfil_ml) {
    case 'Armador': return 'playmaker';
    case 'Paredão': return 'keeper';
    case 'Misto': return 'mixed';
    default: return 'scorer';
  }
}
export function searchScout(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}
export function sortScout(players: PerfilJogador[], order: string, ascending = scoutOrderStartsAscending(order)) {
  const field = { goals: 'totalGols', assists: 'totalAssistencias', saves: 'totalDefesas', games: 'totalPartidas' } as const;
  return [...players].sort((a, b) => {
    if (order === 'shirt' && (a.numCamisa == null) !== (b.numCamisa == null)) return a.numCamisa == null ? 1 : -1;
    if (order === 'age' && (a.idade == null) !== (b.idade == null)) return a.idade == null ? 1 : -1;
    if (order === 'profile' && hasAssessment(a) !== hasAssessment(b)) return hasAssessment(a) ? -1 : 1;
    let difference = 0;
    if (order === 'rating') difference = b.totalPartidas - a.totalPartidas;
    else if (order === 'shirt') difference = (a.numCamisa ?? Infinity) - (b.numCamisa ?? Infinity);
    else if (order === 'age') difference = (b.idade ?? 0) - (a.idade ?? 0);
    else if (order in field) {
      const key = field[order as keyof typeof field];
      difference = b[key] - a[key];
    }
    if ((ascending && !scoutOrderStartsAscending(order)) || (!ascending && scoutOrderStartsAscending(order))) difference *= -1;
    if (order === 'name') difference = (ascending ? 1 : -1) * a.nome.localeCompare(b.nome, 'pt-BR');
    if (order === 'position') difference = (ascending ? 1 : -1) * (a.posicao || '').localeCompare(b.posicao || '', 'pt-BR');
    if (order === 'profile') difference = (ascending ? 1 : -1) * (hasAssessment(a) ? a.perfil_ml! : '').localeCompare(hasAssessment(b) ? b.perfil_ml! : '', 'pt-BR');
    return difference || a.nome.localeCompare(b.nome, 'pt-BR') || a.id - b.id;
  });
}
