const CAMPOS = ['finalizacao', 'visao_de_jogo', 'defesa', 'disciplina', 'intensidade', 'tecnica'] as const;
const PERFIS = new Set(['Armador', 'Artilheiro', 'Paredão']);

export type ResultadoScout = {
  jogador_id: number;
  perfil_ml: string;
  nota_geral: number;
  scores: Record<typeof CAMPOS[number], number>;
};

export function validarResultadosScout(value: unknown, jogadores: ReadonlySet<number>): ResultadoScout[] {
  const vistos = new Set<number>();
  const notaValida = (nota: unknown): nota is number => typeof nota === 'number' && Number.isFinite(nota) && nota >= 0 && nota <= 100;
  if (!Array.isArray(value) || value.length !== jogadores.size) throw new Error('Resposta inválida do Scout IA');
  return value.map(item => {
    if (!item || !Number.isSafeInteger(item.jogador_id) || !jogadores.has(item.jogador_id)
      || vistos.has(item.jogador_id) || !PERFIS.has(item.perfil_ml) || !notaValida(item.nota_geral)
      || !item.scores || !CAMPOS.every(campo => notaValida(item.scores[campo]))) {
      throw new Error('Resposta inválida do Scout IA');
    }
    vistos.add(item.jogador_id);
    return {
      jogador_id: item.jogador_id,
      perfil_ml: item.perfil_ml,
      nota_geral: item.nota_geral,
      scores: Object.fromEntries(CAMPOS.map(campo => [campo, item.scores[campo]])) as ResultadoScout['scores'],
    };
  });
}
