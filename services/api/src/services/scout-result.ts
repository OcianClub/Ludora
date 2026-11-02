const CAMPOS = [
  'gols_por_convocacao',
  'assistencias_por_convocacao',
  'defesas_por_convocacao',
] as const;
const PERFIS = new Set([
  'Armador',
  'Artilheiro',
  'Paredão',
  'Misto',
  'Sem dados',
]);

export type ResultadoScout = {
  jogador_id: number;
  versao: 2;
  perfil_ml: string;
  nota_geral: null;
  scores: Record<(typeof CAMPOS)[number], number>;
  convocacoes: number;
  grupo_tamanho: number;
  semelhantes: { jogador_id: number; distancia: number }[];
  metodo: string;
};

export function validarResultadosScout(
  value: unknown,
  jogadores: ReadonlySet<number>
): ResultadoScout[] {
  const vistos = new Set<number>();
  const inteiro = (v: unknown): v is number =>
    Number.isSafeInteger(v) && Number(v) >= 0;
  const numero = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1_000_000;
  if (!Array.isArray(value) || value.length !== jogadores.size)
    throw new Error('Resposta inválida do Scout IA');
  return value.map((item) => {
    if (
      !item ||
      item.versao !== 2 ||
      item.nota_geral !== null ||
      !Number.isSafeInteger(item.jogador_id) ||
      !jogadores.has(item.jogador_id) ||
      vistos.has(item.jogador_id) ||
      !PERFIS.has(item.perfil_ml) ||
      !inteiro(item.convocacoes) ||
      !inteiro(item.grupo_tamanho) ||
      item.grupo_tamanho > jogadores.size ||
      item.metodo !== 'v2-registros-por-convocacao' ||
      !item.scores ||
      !CAMPOS.every((campo) => numero(item.scores[campo])) ||
      !Array.isArray(item.semelhantes) ||
      item.semelhantes.length > 3 ||
      new Set(item.semelhantes.map((s: any) => s?.jogador_id)).size !==
        item.semelhantes.length ||
      item.semelhantes.some(
        (s: any) =>
          !s ||
          s.jogador_id === item.jogador_id ||
          !jogadores.has(s.jogador_id) ||
          !numero(s.distancia)
      )
    ) {
      throw new Error('Resposta inválida do Scout IA');
    }
    vistos.add(item.jogador_id);
    return {
      jogador_id: item.jogador_id,
      versao: 2,
      perfil_ml: item.perfil_ml,
      nota_geral: null,
      scores: Object.fromEntries(
        CAMPOS.map((campo) => [campo, item.scores[campo]])
      ) as ResultadoScout['scores'],
      convocacoes: item.convocacoes,
      grupo_tamanho: item.grupo_tamanho,
      metodo: item.metodo,
      semelhantes: item.semelhantes.map((s: any) => ({
        jogador_id: s.jogador_id,
        distancia: s.distancia,
      })),
    };
  });
}
