import type {
  EventoPartida,
  GestaoPartida,
} from "../services/partidasCompartilhadas";

export const TIPOS_EVENTOS = [
  "GOL",
  "CARTAO_AMARELO",
  "CARTAO_VERMELHO",
  "CARTAO_AZUL",
  "FALTA",
  "DEFESA",
  "ASSISTENCIA",
] as const;
export type TipoEvento = (typeof TIPOS_EVENTOS)[number];
export const NOMES_EVENTOS: Record<string, string> = {
  GOL: "Gol",
  CARTAO_AMARELO: "Amarelo",
  CARTAO_VERMELHO: "Vermelho",
  CARTAO_AZUL: "Azul",
  FALTA: "Falta",
  DEFESA: "Defesa",
  ASSISTENCIA: "Assistência",
};
/** Índices reutilizados ao descrever o histórico inteiro (inclusive lances removidos). */
export function criarIndiceAlteracoes(data: GestaoPartida) {
  const eventos = new Map(data.eventos.map((e) => [e.id, e]));
  const removidos = new Map<number, Partial<EventoPartida>>();
  for (const registro of data.auditoria || []) {
    const evento = registro.dados?.evento as Partial<EventoPartida> | undefined;
    if (typeof evento?.id === "number" && !removidos.has(evento.id))
      removidos.set(evento.id, evento);
  }
  const jogadores = new Map<number, string>();
  for (const equipe of data.equipes || [])
    for (const jogador of equipe.escalacao || [])
      if (!jogadores.has(jogador.jogador_id))
        jogadores.set(jogador.jogador_id, jogador.jogador?.nome || "Jogador");
  return { eventos, removidos, jogadores };
}
export function descreverAlteracao(
  registro: NonNullable<GestaoPartida["auditoria"]>[number],
  data: GestaoPartida,
  indice = criarIndiceAlteracoes(data),
) {
  const dados = registro.dados || {};
  const evento =
    (dados.evento as Partial<EventoPartida> | undefined) ||
    indice.eventos.get(dados.evento_id as number) ||
    indice.removidos.get(dados.evento_id as number);
  const tipo = String(dados.tipo || evento?.tipo || "");
  const timeId = Number(dados.time_id || evento?.time_id);
  const time = [data.partida.mandante, data.partida.visitante].find(
    (t) => t.id === timeId,
  );
  const nome =
    evento?.jogador?.nome ||
    (typeof dados.jogador_nome === "string" ? dados.jogador_nome : "");
  const feminino = ["FALTA", "DEFESA", "ASSISTENCIA"].includes(tipo);
  const lance = `${tipo.startsWith("CARTAO_") ? `Cartão ${NOMES_EVENTOS[tipo].toLowerCase()}` : NOMES_EVENTOS[tipo] || "Lance"}${dados.gol_contra || evento?.gol_contra ? " contra" : ""}`;
  const titulos: Record<string, string> = {
    EVENTO_REGISTRADO: `${lance} registrad${feminino ? "a" : "o"}`,
    EVENTO_REMOVIDO: `${lance} removid${feminino ? "a" : "o"}`,
    AUTORIA_IDENTIFICADA: `Autoria ${feminino ? "da" : "do"} ${lance.toLowerCase()} corrigida`,
    STATUS_AO_VIVO: "Partida iniciada",
    STATUS_FINALIZADA: "Partida encerrada",
    STATUS_CANCELADA: "Partida cancelada",
    ESCALACAO_SALVA: "Escalação salva",
    EQUIPE_CONFIRMADA: "Equipe confirmada",
    PARTIDA_CRIADA: "Partida criada",
    SUBSTITUICAO: "Substituição realizada",
    PLACAR_CORRIGIDO: "Placar corrigido",
    PERIODO_ALTERADO: `Tempo alterado para ${dados.periodo}º`,
    SUMULA_TRANSFERIDA: "Responsabilidade pela súmula transferida",
    CORRECAO_SOLICITADA: "Edição da súmula solicitada",
    CORRECAO_AUTORIZADA: "Edição da súmula autorizada",
  };
  const porJogador = (id: unknown) =>
    indice.jogadores.get(id as number) || "Jogador";
  const complemento =
    registro.acao === "SUBSTITUICAO"
      ? `${porJogador(dados.sai)} → ${porJogador(dados.entra)}`
      : nome;
  return {
    titulo:
      titulos[registro.acao] || registro.acao.toLowerCase().replace(/_/g, " "),
    detalhes: [
      time?.nome,
      complemento,
      evento?.periodo ? `${evento.periodo}º tempo` : "",
    ]
      .filter(Boolean)
      .join(" · "),
  };
}
export function timeAutor(
  data: GestaoPartida,
  evento: Pick<EventoPartida, "time_id" | "gol_contra">,
) {
  return evento.gol_contra
    ? evento.time_id === data.partida.mandante_id
      ? data.partida.visitante_id
      : data.partida.mandante_id
    : evento.time_id;
}
export function eventosSemJogador(data: GestaoPartida) {
  return data.eventos.filter(
    (e) =>
      !e.jogador_id &&
      data.equipes.some((t) => t.time_id === timeAutor(data, e)),
  );
}
export function disciplinaTempo(
  eventos: EventoPartida[],
  timeId: number,
  periodo: number,
) {
  const atuais = eventos.filter(
    (e) => e.time_id === timeId && e.periodo === periodo,
  );
  const contar = (tipo: string) => atuais.filter((e) => e.tipo === tipo).length;
  return {
    faltas: contar("FALTA"),
    amarelos: contar("CARTAO_AMARELO"),
    vermelhos: contar("CARTAO_VERMELHO"),
    azuis: contar("CARTAO_AZUL"),
  };
}
type EstatisticasJogador = {
  gols: number;
  assistencias: number;
  faltas: number;
  amarelos: number;
  vermelhos: number;
  azuis: number;
  defesas: number;
};
export const ESTATISTICAS_VAZIAS: Readonly<EstatisticasJogador> = Object.freeze(
  {
    gols: 0,
    assistencias: 0,
    faltas: 0,
    amarelos: 0,
    vermelhos: 0,
    azuis: 0,
    defesas: 0,
  },
);
const CAMPO_EVENTO = {
  GOL: "gols",
  ASSISTENCIA: "assistencias",
  FALTA: "faltas",
  CARTAO_AMARELO: "amarelos",
  CARTAO_VERMELHO: "vermelhos",
  CARTAO_AZUL: "azuis",
  DEFESA: "defesas",
} as const;
/** Uma passagem pelos eventos para todas as linhas da escalação. */
export function indexarEstatisticasJogadores(
  eventos: EventoPartida[],
  periodo?: number,
) {
  const indice = new Map<number, EstatisticasJogador>();
  for (const evento of eventos) {
    if (
      evento.jogador_id == null ||
      (periodo != null && evento.periodo !== periodo)
    )
      continue;
    const campo = CAMPO_EVENTO[evento.tipo as keyof typeof CAMPO_EVENTO];
    if (!campo || (evento.tipo === "GOL" && evento.gol_contra)) continue;
    let stats = indice.get(evento.jogador_id);
    if (!stats) {
      stats = { ...ESTATISTICAS_VAZIAS };
      indice.set(evento.jogador_id, stats);
    }
    // O objeto pertence exclusivamente a este índice; a constante vazia nunca muda.
    stats[campo]++;
  }
  return indice;
}
export function estatisticasJogador(
  eventos: EventoPartida[],
  jogadorId: number,
  periodo?: number,
) {
  return (
    indexarEstatisticasJogadores(eventos, periodo).get(jogadorId) || {
      ...ESTATISTICAS_VAZIAS,
    }
  );
}
export function placaresEventos(data: GestaoPartida) {
  let casa = data.partida.gols_mandante,
    fora = data.partida.gols_visitante;
  const placares = new Map<number, string>();
  for (const e of [...data.eventos].sort((a, b) => b.id - a.id)) {
    if (e.tipo !== "GOL") continue;
    placares.set(e.id, `${casa} - ${fora}`);
    if (e.time_id === data.partida.mandante_id) casa = Math.max(0, casa - 1);
    else if (e.time_id === data.partida.visitante_id)
      fora = Math.max(0, fora - 1);
  }
  return placares;
}
export function mensagemResultado(
  data: GestaoPartida,
  nomes: boolean,
  link: string,
) {
  const p = data.partida;
  const titulo =
    p.gols_mandante === p.gols_visitante
      ? "Empate"
      : `Vitória do ${p.gols_mandante > p.gols_visitante ? p.mandante.nome : p.visitante.nome}`;
  const linhas = [
    "LUDORA · Resultado final",
    `${p.mandante.nome} ${p.gols_mandante} × ${p.gols_visitante} ${p.visitante.nome}`,
    titulo,
    `${p.categoria.nome.toUpperCase()} · ${p.data.slice(0, 10).split("-").reverse().join("/")} · ${p.horario}`,
  ];
  if (nomes)
    for (const e of [...data.eventos].sort((a, b) => a.id - b.id)) {
      if (e.jogador?.nome)
        linhas.push(
          `${NOMES_EVENTOS[e.tipo] || e.tipo}${e.gol_contra ? " contra" : ""}: ${e.jogador.nome} · ${e.periodo}º tempo`,
        );
    }
  linhas.push(link);
  return linhas.join("\n");
}
