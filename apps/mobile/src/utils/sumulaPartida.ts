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
export function descreverAlteracao(
  registro: NonNullable<GestaoPartida["auditoria"]>[number],
  data: GestaoPartida,
) {
  const dados = registro.dados || {};
  const evento =
    (dados.evento as Partial<EventoPartida> | undefined) ||
    data.eventos.find((e) => e.id === dados.evento_id) ||
    (data.auditoria?.find(
      (a) =>
        (a.dados?.evento as EventoPartida | undefined)?.id === dados.evento_id,
    )?.dados?.evento as Partial<EventoPartida> | undefined);
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
    data.equipes.flatMap((e) => e.escalacao).find((j) => j.jogador_id === id)
      ?.jogador?.nome || "Jogador";
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
export function estatisticasJogador(
  eventos: EventoPartida[],
  jogadorId: number,
  periodo?: number,
) {
  const atuais = eventos.filter(
    (e) =>
      e.jogador_id === jogadorId && (periodo == null || e.periodo === periodo),
  );
  const contar = (tipo: string) =>
    atuais.filter((e) => e.tipo === tipo && !(tipo === "GOL" && e.gol_contra))
      .length;
  return {
    gols: contar("GOL"),
    assistencias: contar("ASSISTENCIA"),
    faltas: contar("FALTA"),
    amarelos: contar("CARTAO_AMARELO"),
    vermelhos: contar("CARTAO_VERMELHO"),
    azuis: contar("CARTAO_AZUL"),
    defesas: contar("DEFESA"),
  };
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
