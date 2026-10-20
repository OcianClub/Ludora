export interface PartidaScout {
  id: number;
  data: string;
  adversario: string;
  gols: number;
  assistencias: number;
  defesas: number;
}

export interface ContextoScout {
  jogador_id: number;
  total_partidas: number;
  partidas: PartidaScout[];
}

export function contextoScoutValido(
  valor: unknown,
  jogadorId: number
): valor is ContextoScout {
  if (!valor || typeof valor !== 'object') return false;
  const dados = valor as ContextoScout;
  if (
    dados.jogador_id !== jogadorId ||
    !Number.isSafeInteger(dados.total_partidas) ||
    dados.total_partidas < 0 ||
    !Array.isArray(dados.partidas)
  )
    return false;
  if (
    dados.partidas.length > 10 ||
    dados.partidas.length > dados.total_partidas
  )
    return false;
  const ids = new Set<number>();
  return dados.partidas.every((partida) => {
    if (
      !partida ||
      !Number.isSafeInteger(partida.id) ||
      partida.id <= 0 ||
      ids.has(partida.id)
    )
      return false;
    ids.add(partida.id);
    return (
      typeof partida.data === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(partida.data) &&
      typeof partida.adversario === 'string' &&
      [partida.gols, partida.assistencias, partida.defesas].every(
        (quantidade) => Number.isSafeInteger(quantidade) && quantidade >= 0
      )
    );
  });
}

export const METRICAS_SCOUT = [
  { campo: 'gols', titulo: 'Gols' },
  { campo: 'assistencias', titulo: 'Assistências' },
  { campo: 'defesas', titulo: 'Defesas' },
] as const;

export function resumirContextoScout(contexto: ContextoScout) {
  const recentes = contexto.partidas.slice(0, 5);
  const anteriores = contexto.partidas.slice(5, 10);
  const media = (
    partidas: PartidaScout[],
    campo: (typeof METRICAS_SCOUT)[number]['campo']
  ) =>
    partidas.length
      ? partidas.reduce((total, partida) => total + partida[campo], 0) /
        partidas.length
      : null;
  return {
    poucosRegistros: contexto.total_partidas < 5,
    podeComparar: recentes.length === 5 && anteriores.length === 5,
    tamanhoRecente: recentes.length,
    metricas: METRICAS_SCOUT.map(({ campo, titulo }) => ({
      campo,
      titulo,
      recente: media(recentes, campo),
      anterior: anteriores.length === 5 ? media(anteriores, campo) : null,
    })),
  };
}

export function formatarMediaScout(valor: number | null) {
  return valor == null ? '—' : valor.toFixed(2).replace('.', ',');
}
