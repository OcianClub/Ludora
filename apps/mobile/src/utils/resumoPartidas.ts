type PartidaResumo = {
  data: string; horario: string | null; status: string;
  emCasa: boolean; gols_mandante: number; gols_visitante: number;
};

const instante = (partida: PartidaResumo) => `${partida.data.split('T')[0]}T${partida.horario || '00:00'}`;

/** Resultado sempre pela perspectiva do clube selecionado, inclusive fora de casa. */
export function resultadoDoClube(partida: PartidaResumo): 'V' | 'E' | 'D' {
  const gols = partida.emCasa ? partida.gols_mandante : partida.gols_visitante;
  const adversario = partida.emCasa ? partida.gols_visitante : partida.gols_mandante;
  return gols > adversario ? 'V' : gols < adversario ? 'D' : 'E';
}

export function acoesDaPartidaNaHome(partida: PartidaResumo | null, podeGerenciar: boolean, agora = new Date()) {
  const preparar = podeGerenciar && !!partida && ['AGENDADA', 'PREPARADA'].includes(partida.status);
  const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
  return { preparar, iniciar: preparar && partida?.data.split('T')[0] === hoje };
}

/** Agenda curta sem repetir a partida que já está no destaque. */
export function agendaDaCategoria<T extends PartidaResumo & { id: number }>(partidas: T[], agora = new Date()): T[] {
  const destaque = resumirPartidas(partidas, agora).proximoJogo;
  const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
  return partidas.filter(p => p.id !== destaque?.id
    && ['AGENDADA', 'PREPARADA'].includes(p.status)
    && p.data.split('T')[0] >= hoje)
    .sort((a, b) => instante(a).localeCompare(instante(b)))
    .slice(0, 2);
}

export function resumirPartidas<T extends PartidaResumo>(partidas: T[], agora = new Date()) {
  const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
  const proximas = partidas.filter(p =>
    ['AGENDADA', 'PREPARADA'].includes(p.status) && p.data.split('T')[0] >= hoje,
  ).sort((a, b) => instante(a).localeCompare(instante(b)));
  const finalizadas = partidas.filter(p => p.status === 'FINALIZADA')
    .sort((a, b) => instante(b).localeCompare(instante(a)));
  const estatisticas = finalizadas.reduce((total, p) => {
    const gols = p.emCasa ? p.gols_mandante : p.gols_visitante;
    const adversario = p.emCasa ? p.gols_visitante : p.gols_mandante;
    if (gols > adversario) { total.pontos += 3; total.vitorias += 1; }
    else if (gols === adversario) total.pontos += 1;
    return total;
  }, { pontos: 0, vitorias: 0 });
  return {
    proximoJogo: partidas.find(p => p.status === 'AO_VIVO') ?? proximas[0] ?? null,
    historico: finalizadas.slice(0, 5),
    estatisticas,
  };
}
