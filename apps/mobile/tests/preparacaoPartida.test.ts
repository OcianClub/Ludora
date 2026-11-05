import assert from "node:assert/strict";
import { test } from "node:test";
import {
  atualizarCamisas,
  conciliarCamisas,
  escalaValida,
  etapaPreparacao,
  normalizarConvocados,
  numeroCamisa,
  trocarConvocados,
  type Convocado,
} from "../src/utils/preparacaoPartida";
import type { GestaoPartida } from "../src/services/partidasCompartilhadas";
import { acoesDaPartidaNaHome } from "../src/utils/resumoPartidas";

const elenco = (total = 7): Convocado[] =>
  Array.from({ length: total }, (_, index) => ({
    jogador_id: index + 1,
    numCamisa: index + 1,
    titular: index < 5,
    jogador: { nome: `Jogador ${index + 1}`, posicao: "Fixo" },
  }));
const dados = (convocados: Convocado[], pronta = false) =>
  ({
    podePreparar: true,
    minhaEquipeId: 10,
    partida: { status: "AGENDADA", horario: "22:00", titulares_necessarios: 5 },
    equipes: [{ id: 10, pronta, escalacao: convocados }],
  }) as GestaoPartida;

test("a convocação mantém cinco titulares e promove o primeiro reserva ao retirar um titular", () => {
  const convocados = normalizarConvocados(
    elenco().filter((item) => item.jogador_id !== 2),
  );
  assert.deepEqual(
    convocados.filter((item) => item.titular).map((item) => item.jogador_id),
    [1, 3, 4, 5, 6],
  );
  assert.equal(convocados.at(-1)?.titular, false);
});

test("troca titular e reserva na mesma posição sem perder os demais convocados", () => {
  const antes = elenco();
  const depois = trocarConvocados(antes, 2, 7);
  assert.deepEqual(
    depois.map((item) => item.jogador_id),
    [1, 7, 3, 4, 5, 6, 2],
  );
  assert.equal(depois[1].titular, true);
  assert.equal(depois[6].titular, false);
  assert.equal(antes[1].jogador_id, 2);
  assert.equal(trocarConvocados(antes, 2, 2), antes);
  assert.equal(trocarConvocados(antes, 2, 99), antes);
});

test("jogador que perde a camisa sai da convocação e volta ao elenco", () => {
  const depois = atualizarCamisas(elenco(), 9, 2, {
    jogador_id: 2,
    camisa_anterior: null,
  });
  assert.equal(
    depois.some((item) => item.jogador_id === 2),
    false,
  );
  assert.equal(
    depois.some((item) => item.jogador_id === 9),
    false,
  );
  assert.deepEqual(
    depois.filter((item) => item.titular).map((item) => item.jogador_id),
    [1, 3, 4, 5, 6],
  );
  assert.equal(escalaValida(depois), true);
});

test("troca duas camisas mantendo os convocados quando ambos continuam numerados", () => {
  const depois = atualizarCamisas(elenco(), 1, 7, {
    jogador_id: 7,
    camisa_anterior: 1,
  });
  assert.equal(depois.length, 7);
  assert.equal(depois[0].numCamisa, 7);
  assert.equal(depois[6].numCamisa, 1);
  assert.equal(escalaValida(depois), true);
});

test("retoma os dados, o rascunho salvo e a revisão conforme o progresso", () => {
  assert.equal(etapaPreparacao(dados([]), null), 0);
  assert.equal(etapaPreparacao(dados([]), "1"), 1);
  assert.equal(etapaPreparacao(dados(elenco()), null), 1);
  assert.equal(etapaPreparacao(dados(elenco()), "2"), 2);
  assert.equal(etapaPreparacao(dados(elenco(), true), "1"), 2);
  assert.equal(etapaPreparacao(dados(elenco(4)), "2"), 1);
  assert.equal(
    etapaPreparacao({ ...dados(elenco()), podePreparar: false }, "2"),
    0,
  );
});

test("bloqueia a revisão de escalações incompletas, repetidas ou sem camisa", () => {
  assert.equal(escalaValida(elenco()), true);
  assert.equal(escalaValida(elenco(4)), false);
  assert.equal(
    escalaValida(elenco().map((item) => ({ ...item, titular: true }))),
    false,
  );
  assert.equal(
    escalaValida(
      elenco().map((item, index) =>
        index === 0 ? { ...item, numCamisa: 0 } : item,
      ),
    ),
    false,
  );
  assert.equal(
    escalaValida(elenco().map((item) => ({ ...item, numCamisa: 7 }))),
    false,
  );
});

test("camisas com um dígito recebem zero à esquerda somente na apresentação", () => {
  assert.deepEqual([1, 2, 7, 10, 99].map(numeroCamisa), [
    "01",
    "02",
    "07",
    "10",
    "99",
  ]);
});

test("recarregar o elenco concilia camisas alteradas em outro dispositivo sem perder a ordem", () => {
  const antes = elenco();
  const jogadores = antes.map((j) => ({
    id: j.jogador_id,
    numCamisa: j.numCamisa as number | null,
  }));
  assert.equal(conciliarCamisas(antes, jogadores), antes);
  jogadores[0].numCamisa = 20;
  jogadores[1].numCamisa = null;
  const depois = conciliarCamisas(antes, jogadores);
  assert.deepEqual(
    depois.map((j) => j.jogador_id),
    [1, 3, 4, 5, 6, 7],
  );
  assert.equal(depois[0].numCamisa, 20);
  assert.equal(depois[4].titular, true);
  assert.equal(depois[5].titular, false);
  assert.equal(escalaValida(depois), true);
  assert.deepEqual(conciliarCamisas(antes, []), []);
});

test("gestor do adversário pode abrir sua preparação pela home sem receber o controle de início", () => {
  const partida = {
    id: 1,
    somente_leitura: true,
    minha_equipe_pronta: false,
    data: "2026-11-04",
    horario: "22:00",
    status: "AGENDADA",
    emCasa: false,
    gols_mandante: 0,
    gols_visitante: 0,
  };
  const agora = new Date(2026, 10, 4, 12);
  assert.deepEqual(acoesDaPartidaNaHome(partida, true, agora), {
    preparar: true,
    iniciar: false,
  });
  assert.deepEqual(acoesDaPartidaNaHome(partida, false, agora), {
    preparar: false,
    iniciar: false,
  });
  assert.deepEqual(
    acoesDaPartidaNaHome(
      { ...partida, minha_equipe_pronta: null },
      true,
      agora,
    ),
    { preparar: false, iniciar: false },
  );
});
