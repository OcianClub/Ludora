import assert from "node:assert/strict";
import { test } from "node:test";
import {
  disciplinaTempo,
  descreverAlteracao,
  estatisticasJogador,
  eventosSemJogador,
  mensagemResultado,
  placaresEventos,
  timeAutor,
} from "../src/utils/sumulaPartida";
import type { GestaoPartida } from "../src/services/partidasCompartilhadas";

test("histórico identifica o lance mesmo após remoção e preserva sua equipe", () => {
  const jogo = {
    partida: {
      mandante: { id: 10, nome: "Ocian" },
      visitante: { id: 20, nome: "Santos" },
    },
    eventos: [],
    auditoria: [],
  } as unknown as GestaoPartida;
  const registro = {
    id: 1,
    criado_em: "",
    acao: "EVENTO_REGISTRADO",
    dados: {
      evento: {
        id: 1,
        tipo: "GOL",
        time_id: 20,
        periodo: 2,
        jogador: { nome: "Daniel" },
      },
    },
  };
  assert.deepEqual(descreverAlteracao(registro, jogo), {
    titulo: "Gol registrado",
    detalhes: "Santos · Daniel · 2º tempo",
  });
  assert.equal(
    descreverAlteracao({ ...registro, acao: "EVENTO_REMOVIDO" }, jogo).titulo,
    "Gol removido",
  );
  assert.equal(
    descreverAlteracao(
      { ...registro, dados: { tipo: "FALTA", time_id: 10 } },
      jogo,
    ).titulo,
    "Falta registrada",
  );
});

const data = {
  partida: {
    mandante_id: 10,
    visitante_id: 20,
    gols_mandante: 2,
    gols_visitante: 0,
    horario: "22:00",
    data: "2026-11-04",
    categoria: { nome: "SUB-7" },
    mandante: { nome: "Ocian" },
    visitante: { nome: "Santos" },
  },
  equipes: [{ time_id: 10 }, { time_id: 20 }],
  eventos: [
    {
      id: 1,
      tipo: "GOL",
      time_id: 10,
      jogador_id: 1,
      jogador: { nome: "Daniel" },
      periodo: 1,
    },
    {
      id: 2,
      tipo: "GOL",
      time_id: 10,
      gol_contra: true,
      jogador_id: 2,
      jogador: { nome: "Pedro" },
      periodo: 1,
    },
    { id: 3, tipo: "FALTA", time_id: 20, jogador_id: 2, periodo: 1 },
    { id: 4, tipo: "CARTAO_AMARELO", time_id: 20, jogador_id: 2, periodo: 1 },
    { id: 5, tipo: "DEFESA", time_id: 10, jogador_id: null, periodo: 2 },
  ],
} as unknown as GestaoPartida;
test("gol contra beneficia o time escolhido, mas a autoria pertence ao adversário", () => {
  assert.equal(timeAutor(data, data.eventos[1]), 20);
  assert.equal(estatisticasJogador(data.eventos, 2).gols, 0);
  assert.equal(placaresEventos(data).get(1), "1 - 0");
  assert.equal(placaresEventos(data).get(2), "2 - 0");
});
test("faltas e cartões reiniciam visualmente por tempo sem apagar os registros", () => {
  assert.equal(disciplinaTempo(data.eventos, 20, 1).faltas, 1);
  assert.equal(disciplinaTempo(data.eventos, 20, 1).amarelos, 1);
  assert.equal(disciplinaTempo(data.eventos, 20, 2).amarelos, 0);
  assert.equal(data.eventos.length, 5);
});
test("pendências incluem todos os eventos com equipe cadastrada; externo não gera pendência", () => {
  assert.deepEqual(
    eventosSemJogador(data).map((e) => e.id),
    [5],
  );
  const externo = {
    ...data,
    equipes: [],
    eventos: [{ id: 7, tipo: "GOL", time_id: 30, periodo: 1 }],
  } as unknown as GestaoPartida;
  assert.deepEqual(eventosSemJogador(externo), []);
});
test("compartilhamento só inclui nomes após opção explícita e mantém link e placar", () => {
  const privada = mensagemResultado(data, false, "https://local/partidas/1");
  assert.ok(!privada.includes("Daniel"));
  assert.ok(!privada.includes("Pedro"));
  assert.match(privada, /Ocian 2 × 0 Santos/);
  assert.match(
    mensagemResultado(data, true, "https://local/partidas/1"),
    /Gol contra: Pedro/,
  );
});
