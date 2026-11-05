import test from "node:test";
import assert from "node:assert/strict";
import {
  FILTROS_SCOUT_INICIAIS,
  filtrarJogadoresScout,
  proximaOrdenacaoScout,
  type OrdenacaoScout,
  type DirecaoScout,
} from "../src/utils/filtrosScout";
import {
  temporadasScout,
  radarScout,
  jogosGraficoScout,
} from "../src/utils/graficosScout";
import { resumirContextoScout } from "../src/utils/contextoScout";
import type { Jogador } from "../src/services/mlService";
const players = [
  {
    id_jogador: 1,
    nome: "João",
    numCamisa: 7,
    posicao: "Alas",
    perfil_ml: "Armador",
    jogos_disputados: 10,
    gols: 2,
    assistencias: 4,
    defesas: 0,
  },
  {
    id_jogador: 2,
    nome: "Pedro",
    numCamisa: 9,
    posicao: "Goleiro",
    perfil_ml: "Paredão",
    jogos_disputados: 6,
    gols: 1,
    assistencias: 0,
    defesas: 8,
  },
  {
    id_jogador: 3,
    nome: "Ana",
    numCamisa: null,
    posicao: "Ala",
    perfil_ml: "Sem dados",
    jogos_disputados: 0,
    gols: 0,
    assistencias: 0,
    defesas: 0,
  },
] as Jogador[];
test("busca nome sem acento, camisa e posição; filtros de participação e perfil são combinados", () => {
  assert.deepEqual(
    filtrarJogadoresScout(players, "joao", "Todos", "NOTA").map(
      (p) => p.id_jogador,
    ),
    [1],
  );
  assert.equal(
    filtrarJogadoresScout(players, "7", "Todos", "NOTA")[0].nome,
    "João",
  );
  assert.equal(
    filtrarJogadoresScout(players, "", "Todos", "NOTA", "", {
      posicao: "Alas",
      participacao: "sem",
      perfil: "sem",
    })[0].nome,
    "Ana",
  );
  assert.deepEqual(
    filtrarJogadoresScout(players, "", "Todos", "NOTA", "", {
      ...FILTROS_SCOUT_INICIAIS,
      perfil: "com",
    }).map((p) => p.nome),
    ["João", "Pedro"],
  );
});
test("ordenação quantitativa e textual percorrem crescente, decrescente e padrão, sem mutar origem", () => {
  let current: { ordenacao: OrdenacaoScout; direcao: DirecaoScout } = {
    ordenacao: "NOTA",
    direcao: "",
  };
  current = proximaOrdenacaoScout(current.ordenacao, "GOLS", current.direcao);
  assert.equal(current.direcao, "desc");
  current = proximaOrdenacaoScout(current.ordenacao, "GOLS", current.direcao);
  assert.equal(current.direcao, "asc");
  current = proximaOrdenacaoScout(current.ordenacao, "GOLS", current.direcao);
  assert.deepEqual(current, { ordenacao: "NOTA", direcao: "" });
  assert.equal(proximaOrdenacaoScout("NOTA", "CAMISA", "").direcao, "asc");
  assert.deepEqual(
    filtrarJogadoresScout(players, "", "Todos", "GOLS", "asc").map(
      (p) => p.nome,
    ),
    ["Ana", "Pedro", "João"],
  );
  assert.deepEqual(
    filtrarJogadoresScout(players, "", "Todos", "CAMISA", "desc").map(
      (p) => p.numCamisa,
    ),
    [9, 7, null],
  );
  assert.deepEqual(
    players.map((p) => p.id_jogador),
    [1, 2, 3],
  );
});
test("temporadas vêm das opções reais, únicas e em ordem decrescente", () => {
  assert.deepEqual(
    temporadasScout({
      competicoes: [],
      partidas: [],
      temporadas: [2025, 2026, 2025],
    }),
    [2026, 2025],
  );
  assert.deepEqual(
    temporadasScout({
      competicoes: [],
      partidas: [
        { id: 1, data: "2024-01-01", status: "FINALIZADA", nome: "A" },
        { id: 2, data: "2026-01-01", status: "AO_VIVO", nome: "B" },
      ],
    }),
    [2024],
  );
});
test("radar usa eventos reais e não avaliações; barras ordenam cronologicamente e médias usam últimos cinco", () => {
  const t = {
    convocacoes: 10,
    titularidades: 3,
    titularidades_desconhecidas: 0,
    gols: 3,
    assistencias: 4,
    defesas: 0,
    faltas: 1,
    amarelos: 1,
    vermelhos: 2,
    azuis: 0,
    gols_contra: 2,
  };
  assert.deepEqual(
    radarScout(t).eixos.map((e) => e.valor),
    [3, 4, 0, 1, 3],
  );
  assert.equal(radarScout(t).maximo, 4);
  assert.equal(
    radarScout({
      ...t,
      gols: 0,
      assistencias: 0,
      faltas: 0,
      amarelos: 0,
      vermelhos: 0,
    }).maximo,
    1,
  );
  const partidas = Array.from({ length: 10 }, (_, i) => ({
    id: 10 - i,
    data: `2026-10-${String(30 - i).padStart(2, "0")}`,
    adversario: "Santos",
    gols: i < 5 ? 1 : 2,
    assistencias: 0,
    defesas: 0,
  }));
  assert.equal(jogosGraficoScout(partidas)[0].id, 1);
  assert.equal(partidas[0].id, 10);
  const resumo = resumirContextoScout({
    jogador_id: 1,
    total_partidas: 10,
    partidas,
  });
  assert.equal(resumo.metricas[0].recente, 1);
  assert.equal(resumo.metricas[0].anterior, 2);
  assert.equal(resumo.podeComparar, true);
});
