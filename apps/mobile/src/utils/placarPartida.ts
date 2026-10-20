export type Placar = { gols_mandante: number; gols_visitante: number };
export type MudancaPlacar = { anterior: Placar; novo: Placar };

export function alterarGol(
  placar: Placar,
  lado: 'mandante' | 'visitante',
  delta: 1 | -1
): MudancaPlacar {
  const campo = lado === 'mandante' ? 'gols_mandante' : 'gols_visitante';
  const gols = placar[campo] + delta;
  if (!Number.isSafeInteger(gols) || gols < 0 || gols > 99)
    throw new Error('O placar deve ficar entre 0 e 99 gols.');
  return { anterior: { ...placar }, novo: { ...placar, [campo]: gols } };
}
