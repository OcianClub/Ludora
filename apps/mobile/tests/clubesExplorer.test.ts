import assert from "node:assert/strict";
import { test } from "node:test";
import {
  agruparClubes,
  contextoAcessoClube,
} from "../src/utils/clubesExplorer";
import type { ClubeListado } from "../src/services/api";

const clube = (
  id: number,
  nome: string,
  papel: ClubeListado["papel"] = null,
): ClubeListado => ({
  id,
  nome,
  papel,
  isSeguindo: Boolean(papel),
  escudo: null,
  cidade: "São Paulo",
  estado: "SP",
  seguidores: 8,
});
test("cada clube aparece uma única vez, com prioridade para o atual dentro de sua relação", () => {
  const lista = [
    clube(1, "Ocian", "ADMIN"),
    clube(2, "Santos", "TECNICO"),
    clube(3, "Ludora", "TORCEDOR"),
    clube(4, "Aurora"),
    clube(5, "Estrela", "OLHEIRO"),
  ];
  const grupos = agruparClubes(lista, 2);
  assert.deepEqual(
    grupos.comCargo.map((c) => c.id),
    [2, 5, 1],
  );
  assert.deepEqual(
    grupos.seguindo.map((c) => c.id),
    [3],
  );
  assert.deepEqual(
    grupos.descobrir.map((c) => c.id),
    [4],
  );
  assert.equal(
    new Set(
      [...grupos.comCargo, ...grupos.seguindo, ...grupos.descobrir].map(
        (c) => c.id,
      ),
    ).size,
    lista.length,
  );
  assert.deepEqual(
    lista.map((c) => c.id),
    [1, 2, 3, 4, 5],
  );
});
test("busca encontra nome ou cidade sem acentos, inclusive vínculos, sem depender de nova consulta", () => {
  const lista = [
    clube(1, "Ocian", "ADMIN"),
    { ...clube(2, "Santos"), cidade: "Praia Grande" },
  ];
  assert.deepEqual(
    agruparClubes(lista, 1, "sao paulo").descobrir.map((c) => c.id),
    [1],
  );
  assert.deepEqual(
    agruparClubes(lista, 1, "SANTOS").descobrir.map((c) => c.id),
    [2],
  );
  assert.deepEqual(agruparClubes(lista, 1, "inexistente").descobrir, []);
});
test("acesso respeita o papel e as categorias reais", () => {
  assert.equal(
    contextoAcessoClube(clube(1, "Ocian", "ADMIN")),
    "Todas as categorias",
  );
  assert.equal(
    contextoAcessoClube(clube(2, "Santos", "OLHEIRO")),
    "Conteúdo público",
  );
  assert.equal(
    contextoAcessoClube({
      ...clube(3, "Aurora", "TECNICO"),
      categoriasAcesso: [{ id: 8, nome: "sub-8" }],
    }),
    "SUB-8",
  );
});
