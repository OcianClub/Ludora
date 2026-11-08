import type { GestaoPartida } from '../services/sharedMatches';
import { eventAuthorTeam } from './matchEvents';

export function matchWinner(data: GestaoPartida) {
  const match = data.partida;
  if (match.gols_mandante === match.gols_visitante) return null;
  return match.gols_mandante > match.gols_visitante
    ? { id: match.mandante_id, name: match.mandante?.nome || 'Mandante' }
    : { id: match.visitante_id, name: match.visitante?.nome || 'Visitante' };
}

export function matchResultText(data: GestaoPartida, includePlayerNames = false) {
  const match = data.partida;
  const winner = matchWinner(data);
  const home = match.mandante?.nome || 'Mandante';
  const away = match.visitante?.nome || 'Visitante';
  const lines = [
    'LUDORA · Resultado final',
    `${home} ${match.gols_mandante} × ${match.gols_visitante} ${away}`,
    winner ? `Vitória do ${winner.name}!` : 'Empate',
    [match.categoria?.nome?.toUpperCase(), match.competicao?.nome].filter(Boolean).join(' · '),
    [new Date(`${match.data.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR'), match.horario].filter(Boolean).join(' · '),
    match.local || '',
  ].filter(Boolean);

  if (includePlayerNames && data.eventos.length) {
    const labels: Record<string, string> = {
      GOL: 'Gol', ASSISTENCIA: 'Assistência', FALTA: 'Falta', DEFESA: 'Defesa',
      CARTAO_AMARELO: 'Cartão amarelo', CARTAO_VERMELHO: 'Cartão vermelho', CARTAO_AZUL: 'Cartão azul',
    };
    lines.push('', 'Acontecimentos');
    for (const event of [...data.eventos].sort((a, b) => a.id - b.id)) {
      const playerName = event.jogador?.nome || data.equipes.flatMap(team => team.escalacao)
        .find(player => player.jogador_id === event.jogador_id)?.jogador?.nome;
      const team = event.time_id === match.mandante_id ? home : event.time_id === match.visitante_id ? away : '';
      const label = `${labels[event.tipo] || 'Evento'}${event.gol_contra ? ' contra' : ''}`;
      const external = !data.equipes.some(team => team.time_id === eventAuthorTeam(data, event));
      const author = playerName || (event.tipo === 'GOL' && external ? 'Equipe externa' : event.jogador_id || event.tipo === 'GOL' ? 'Jogador não identificado' : 'Equipe');
      lines.push(`${event.periodo}º tempo${event.minuto != null ? ` · ${event.minuto}′` : ''} — ${label}: ${author}${team ? ` · ${event.gol_contra ? 'ponto para ' : ''}${team}` : ''}`);
    }
  }

  return lines.join('\n');
}
