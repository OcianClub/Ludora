export const camposPreferenciaPush = [
  'push_gols',
  'push_agendamentos',
  'push_resultados',
] as const;

export type PreferenciasPush = Record<
  (typeof camposPreferenciaPush)[number],
  boolean
>;

export function validarPreferenciasPush(
  body: unknown
): Partial<PreferenciasPush> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const entradas = Object.entries(body);
  if (
    !entradas.length ||
    entradas.some(
      ([chave, valor]) =>
        !camposPreferenciaPush.includes(chave as keyof PreferenciasPush) ||
        typeof valor !== 'boolean'
    )
  )
    return null;
  return Object.fromEntries(entradas) as Partial<PreferenciasPush>;
}

export function filtroPushPorTipo(
  tipo: 'GOL_PARTIDA' | 'PARTIDA_AGENDADA' | 'RESULTADO_PARTIDA'
) {
  const campo = {
    GOL_PARTIDA: 'push_gols',
    PARTIDA_AGENDADA: 'push_agendamentos',
    RESULTADO_PARTIDA: 'push_resultados',
  }[tipo];
  return { [campo]: true };
}
