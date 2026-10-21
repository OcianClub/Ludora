export interface PartidaResumo {
  somente_leitura?: boolean;
  id: number;
  status: string;
  emCasa: boolean;
  mandante: { nome: string };
  visitante: { nome: string };
  gols_mandante: number;
  gols_visitante: number;
  data: string;
  categoria: { nome: string } | null;
  competicao?: { nome: string } | null;
}

export interface EventoResumo {
  id: number;
  tipo: string;
  jogador_id?: number | null;
  jogador?: { id: number; nome: string } | null;
  doOcian?: boolean;
}

const METRICAS = [
  { tipo: 'GOL', titulo: 'Gols', singular: 'gol' },
  { tipo: 'ASSISTENCIA', titulo: 'Assistências', singular: 'assistência' },
  { tipo: 'DEFESA', titulo: 'Defesas', singular: 'defesa' },
] as const;

export function montarResumoPosPartida(
  partida: PartidaResumo,
  eventos: EventoResumo[]
) {
  if (partida.status !== 'FINALIZADA') return null;
  const clube = partida.emCasa ? partida.mandante.nome : partida.visitante.nome;
  const golsClube = partida.emCasa
    ? partida.gols_mandante
    : partida.gols_visitante;
  const golsAdversario = partida.emCasa
    ? partida.gols_visitante
    : partida.gols_mandante;
  const resultado =
    golsClube === golsAdversario
      ? 'Empate'
      : golsClube > golsAdversario
        ? 'Vitória'
        : 'Derrota';
  const vistos = new Set<number>();
  const registros = (partida.somente_leitura ? [] : eventos).filter(
    (evento) => {
      if (vistos.has(evento.id) || evento.doOcian === false) return false;
      vistos.add(evento.id);
      return true;
    }
  );
  const metricas = METRICAS.map(({ tipo, titulo, singular }) => {
    const doTipo = registros.filter((evento) => evento.tipo === tipo);
    const atletas = new Map<number, { nome: string; quantidade: number }>();
    for (const evento of doTipo) {
      const id = evento.jogador_id ?? evento.jogador?.id;
      const nome = evento.jogador?.nome.trim();
      if (!id || !nome) continue;
      const atleta = atletas.get(id) ?? { nome, quantidade: 0 };
      atleta.quantidade += 1;
      atletas.set(id, atleta);
    }
    const maior = Math.max(
      0,
      ...Array.from(atletas.values(), (atleta) => atleta.quantidade)
    );
    return {
      tipo,
      titulo,
      singular,
      total: doTipo.length,
      maior,
      lideres: Array.from(atletas.entries())
        .filter(([, atleta]) => atleta.quantidade === maior)
        .map(([id, atleta]) => ({ id, ...atleta }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.id - b.id),
    };
  });
  const golsRegistrados = metricas[0].total;
  return {
    clube,
    resultado,
    metricas,
    golsClube,
    golsRegistrados,
    golsConferem: golsClube === golsRegistrados,
    temEventos: registros.length > 0,
    eventosDoClubeDisponiveis: !partida.somente_leitura,
    data: /^\d{4}-\d{2}-\d{2}/.test(partida.data)
      ? partida.data.slice(0, 10).split('-').reverse().join('/')
      : 'Data não informada',
  };
}

export function textoCompartilhamentoPartida(
  partida: PartidaResumo,
  eventos: EventoResumo[],
  incluirAtletas = false
) {
  const resumo = montarResumoPosPartida(partida, eventos);
  if (!resumo) return null;
  const linhas = [
    'LUDORA | Resultado final',
    `${partida.mandante.nome} ${partida.gols_mandante} × ${partida.gols_visitante} ${partida.visitante.nome}`,
    `${resumo.resultado} · ${resumo.clube}`,
    [resumo.data, partida.categoria?.nome, partida.competicao?.nome]
      .filter(Boolean)
      .join(' · '),
  ];
  if (incluirAtletas && resumo.eventosDoClubeDisponiveis) {
    for (const metrica of resumo.metricas) {
      if (
        !metrica.lideres.length ||
        (metrica.tipo === 'GOL' && !resumo.golsConferem)
      )
        continue;
      linhas.push(
        `${metrica.titulo} em destaque: ${metrica.lideres.map((atleta) => `${atleta.nome} (${atleta.quantidade})`).join(', ')}`
      );
    }
    linhas.push(
      'Destaques do clube conforme os eventos registrados; não representam avaliação geral dos atletas.'
    );
  }
  return linhas.join('\n');
}
