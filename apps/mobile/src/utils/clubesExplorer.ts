import type { ClubeListado } from "../services/api";

const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
export function agruparClubes(
  clubes: ClubeListado[],
  atualId?: number,
  busca = "",
) {
  const termo = normalizar(busca.trim());
  const cargo = (c: ClubeListado) => Boolean(c.papel && c.papel !== "TORCEDOR");
  const segue = (c: ClubeListado) => Boolean(c.isSeguindo || c.papel);
  const ordenar = (a: ClubeListado, b: ClubeListado) =>
    Number(b.id === atualId) - Number(a.id === atualId) ||
    a.nome.localeCompare(b.nome, "pt-BR");
  return {
    buscaAtiva: Boolean(termo),
    comCargo: clubes.filter(cargo).sort(ordenar),
    seguindo: clubes.filter((c) => !cargo(c) && segue(c)).sort(ordenar),
    descobrir: clubes
      .filter((c) =>
        termo
          ? normalizar(
              `${c.nome} ${c.cidade || ""} ${c.estado || ""}`,
            ).includes(termo)
          : !cargo(c) && !segue(c),
      )
      .sort(ordenar),
  };
}
export function contextoAcessoClube(clube: ClubeListado) {
  if (clube.papel === "OLHEIRO") return "Conteúdo público";
  if (clube.papel === "ADMIN" || clube.acessoTodasCategorias)
    return "Todas as categorias";
  return (
    clube.categoriasAcesso?.map((c) => c.nome.toUpperCase()).join(", ") ||
    "Categorias atribuídas pelo clube"
  );
}
