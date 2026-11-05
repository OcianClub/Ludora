import type { Jogador } from "../services/mlService";

export type PerfilScout =
  | "Todos"
  | "Artilheiro"
  | "Armador"
  | "Paredão"
  | "Misto"
  | "Sem dados";
export type OrdenacaoScout =
  | "NOTA"
  | "GOLS"
  | "ASSISTENCIAS"
  | "DEFESAS"
  | "NOME"
  | "CAMISA";
export type DirecaoScout = "asc" | "desc" | "";
export type FiltrosScout = {
  posicao: string;
  participacao: "todos" | "com" | "sem";
  perfil: "todos" | "com" | "sem";
};
export const FILTROS_SCOUT_INICIAIS: FiltrosScout = {
  posicao: "",
  participacao: "todos",
  perfil: "todos",
};
export const normalizarBuscaScout = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
export function proximaOrdenacaoScout(
  atual: OrdenacaoScout,
  proxima: OrdenacaoScout,
  direcao: DirecaoScout,
) {
  const inicial = ["NOME", "CAMISA"].includes(proxima) ? "asc" : "desc";
  if (atual !== proxima || !direcao)
    return { ordenacao: proxima, direcao: inicial as DirecaoScout };
  if (direcao === inicial)
    return {
      ordenacao: proxima,
      direcao: (inicial === "asc" ? "desc" : "asc") as DirecaoScout,
    };
  return { ordenacao: "NOTA" as OrdenacaoScout, direcao: "" as DirecaoScout };
}
export function filtrarJogadoresScout(
  jogadores: Jogador[],
  busca: string,
  perfil: PerfilScout,
  ordenacao: OrdenacaoScout,
  direcao: DirecaoScout = "desc",
  filtros: FiltrosScout = FILTROS_SCOUT_INICIAIS,
) {
  const termo = normalizarBuscaScout(busca);
  const campo = {
    NOTA: "jogos_disputados",
    GOLS: "gols",
    ASSISTENCIAS: "assistencias",
    DEFESAS: "defesas",
  } as const;
  return jogadores
    .filter((j) => {
      const temPerfil = !!j.perfil_ml && j.perfil_ml !== "Sem dados";
      return (
        (perfil === "Todos" || j.perfil_ml === perfil) &&
        (!termo ||
          normalizarBuscaScout(
            `${j.nome} ${j.posicao} ${j.numCamisa ?? ""}`,
          ).includes(termo)) &&
        (!filtros.posicao ||
          normalizarBuscaScout(j.posicao).replace(/alas$/, "ala") ===
            normalizarBuscaScout(filtros.posicao).replace(/alas$/, "ala")) &&
        (filtros.participacao === "todos" ||
          j.jogos_disputados > 0 === (filtros.participacao === "com")) &&
        (filtros.perfil === "todos" || temPerfil === (filtros.perfil === "com"))
      );
    })
    .sort((a, b) => {
      const ordem = direcao ? ordenacao : "NOTA";
      if (ordem === "CAMISA" && (a.numCamisa == null) !== (b.numCamisa == null))
        return a.numCamisa == null ? 1 : -1;
      const diferenca =
        ordem === "NOME"
          ? a.nome.localeCompare(b.nome, "pt-BR")
          : ordem === "CAMISA"
            ? (a.numCamisa ?? 0) - (b.numCamisa ?? 0)
            : (a[campo[ordem]] ?? 0) - (b[campo[ordem]] ?? 0);
      return (
        diferenca * ((direcao || "desc") === "asc" ? 1 : -1) ||
        a.nome.localeCompare(b.nome, "pt-BR") ||
        a.id_jogador - b.id_jogador
      );
    });
}
