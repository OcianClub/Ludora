export interface PartidaScout {
  id: number;
  data: string;
  adversario: string;
  gols: number;
  assistencias: number;
  defesas: number;
  horario?: string | null;
  status?: string;
  convocado?: boolean;
  titular_inicial?: boolean | null;
  mandante?: string;
  visitante?: string;
  gols_mandante?: number;
  gols_visitante?: number;
  competicao?: { id: number; nome: string; ano: number } | null;
  eventos?: {
    id: number;
    tipo: string;
    periodo: number;
    minuto: number | null;
    gol_contra: boolean;
  }[];
}

export type FiltroContextoScout = {
  competicao_id?: number;
  partida_id?: number;
  ano?: number;
};
export type TotaisContextoScout = {
  convocacoes: number;
  titularidades: number;
  titularidades_desconhecidas: number;
  gols: number;
  assistencias: number;
  defesas: number;
  faltas: number;
  amarelos: number;
  vermelhos: number;
  azuis: number;
  gols_contra: number;
};

export interface ContextoScout {
  jogador_id: number;
  total_partidas: number;
  partidas: PartidaScout[];
  versao?: 2;
  recorte?: {
    tipo: 'geral' | 'competicao' | 'partida';
    competicao_id: number | null;
    partida_id: number | null;
    ano: number | null;
    provisorio: boolean;
  };
  totais?: TotaisContextoScout;
  por_tempo?: {
    periodo: number;
    gols: number;
    assistencias: number;
    defesas: number;
  }[];
  opcoes?: {
    competicoes: { id: number; nome: string; ano: number }[];
    partidas: { id: number; data: string; nome: string; status: string }[];
  };
  semelhantes?: { id: number; nome: string; numCamisa: number | null }[];
  modelo?: {
    versao: number;
    calculado_em: string;
    grupo_tamanho: number;
  } | null;
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
  const quantidadeValida = (n: unknown): n is number =>
    Number.isSafeInteger(n) && Number(n) >= 0;
  const idValido = (n: unknown): n is number => quantidadeValida(n) && n > 0;
  const dataValida = (s: unknown): s is string =>
    typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (dados.versao != null && dados.versao !== 2) return false;
  if (dados.versao === 2) {
    if (
      !dados.recorte ||
      !['geral', 'competicao', 'partida'].includes(dados.recorte.tipo) ||
      typeof dados.recorte.provisorio !== 'boolean' ||
      !dados.totais ||
      !(Object.keys(dados.totais) as (keyof TotaisContextoScout)[]).every(
        (key) => quantidadeValida(dados.totais![key])
      ) ||
      ![
        'convocacoes',
        'titularidades',
        'titularidades_desconhecidas',
        'gols',
        'assistencias',
        'defesas',
        'faltas',
        'amarelos',
        'vermelhos',
        'azuis',
        'gols_contra',
      ].every((key) =>
        quantidadeValida(dados.totais![key as keyof TotaisContextoScout])
      ) ||
      !dados.opcoes ||
      !Array.isArray(dados.opcoes.competicoes) ||
      !Array.isArray(dados.opcoes.partidas) ||
      !Array.isArray(dados.por_tempo) ||
      !Array.isArray(dados.semelhantes)
    )
      return false;
    if (
      !dados.opcoes.competicoes.every(
        (c) =>
          c &&
          idValido(c.id) &&
          typeof c.nome === 'string' &&
          quantidadeValida(c.ano)
      ) ||
      !dados.opcoes.partidas.every(
        (p) =>
          p &&
          idValido(p.id) &&
          dataValida(p.data) &&
          typeof p.nome === 'string' &&
          ['AO_VIVO', 'FINALIZADA'].includes(p.status)
      ) ||
      !dados.por_tempo.every(
        (p) =>
          p &&
          idValido(p.periodo) &&
          [p.gols, p.assistencias, p.defesas].every(quantidadeValida)
      ) ||
      !dados.semelhantes.every(
        (p) =>
          p &&
          idValido(p.id) &&
          p.id !== jogadorId &&
          typeof p.nome === 'string' &&
          (p.numCamisa == null || quantidadeValida(p.numCamisa))
      ) ||
      dados.semelhantes.length > 3
    )
      return false;
    if (
      dados.modelo &&
      (dados.modelo.versao !== 2 ||
        !quantidadeValida(dados.modelo.grupo_tamanho) ||
        typeof dados.modelo.calculado_em !== 'string' ||
        !Number.isFinite(Date.parse(dados.modelo.calculado_em)))
    )
      return false;
  }
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
    if (
      dados.versao === 2 &&
      (!['AO_VIVO', 'FINALIZADA'].includes(partida.status || '') ||
        !Array.isArray(partida.eventos) ||
        !partida.eventos.every(
          (e) =>
            e &&
            idValido(e.id) &&
            typeof e.tipo === 'string' &&
            idValido(e.periodo) &&
            typeof e.gol_contra === 'boolean' &&
            (e.minuto == null || quantidadeValida(e.minuto))
        ))
    )
      return false;
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

export function observacoesContextoScout(contexto: ContextoScout) {
  const resumo = resumirContextoScout(contexto);
  const observacoes: { titulo: string; texto: string }[] = [];
  if (!contexto.total_partidas)
    return [
      {
        titulo: 'Ainda sem registros neste recorte',
        texto:
          'Os dados aparecem após uma convocação ou um evento atribuído ao atleta em uma partida finalizada.',
      },
    ];
  const recentes = contexto.partidas.slice(0, 5);
  const participacoes = recentes.filter(
    (p) => p.gols + p.assistencias > 0
  ).length;
  observacoes.push({
    titulo: 'Participação ofensiva registrada',
    texto: `Há gols ou assistências em ${participacoes} de ${recentes.length} ${recentes.length === 1 ? 'partida consultada' : 'partidas consultadas'}. Isso não mede toda a contribuição do atleta.`,
  });
  if (resumo.podeComparar && !contexto.recorte?.provisorio) {
    const comparaveis = resumo.metricas.filter((m) => m.recente !== m.anterior);
    for (const metrica of comparaveis)
      observacoes.push({
        titulo: `${metrica.titulo}: mudança nos registros`,
        texto: `A média passou de ${formatarMediaScout(metrica.anterior)} para ${formatarMediaScout(metrica.recente)} por partida com registro. São dois grupos de 5, dentro do mesmo recorte; minutos em campo e dificuldade dos adversários não foram medidos.`,
      });
  } else if (
    !contexto.recorte?.provisorio &&
    contexto.recorte?.tipo !== 'partida'
  ) {
    observacoes.push({
      titulo: 'Evolução ainda sem base para comparação',
      texto: `Há ${contexto.partidas.length} de 10 registros necessários para comparar dois grupos de 5. Poucos eventos não significam baixo desempenho.`,
    });
  }
  return observacoes;
}
