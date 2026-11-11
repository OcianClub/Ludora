import assert from "node:assert/strict";
import { test } from "node:test";
import {
  criarIndiceAlteracoes,
  indexarEstatisticasJogadores,
  ESTATISTICAS_VAZIAS,
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

test("índice de estatísticas preserva gols contra, tempo, ausência de autor e eventos desconhecidos", () => {
  const eventos = [
    ...data.eventos,
    { id: 6, tipo: "DESCONHECIDO", jogador_id: 2, periodo: 1 },
  ];
  const original = JSON.stringify(eventos);
  const todas = indexarEstatisticasJogadores(eventos);
  assert.deepEqual(todas.get(2), {
    ...ESTATISTICAS_VAZIAS,
    faltas: 1,
    amarelos: 1,
  });
  assert.equal(todas.get(1)?.gols, 1);
  assert.equal(indexarEstatisticasJogadores(eventos, 2).size, 0);
  assert.equal(indexarEstatisticasJogadores(eventos, 1).get(2)?.amarelos, 1);
  assert.equal(JSON.stringify(eventos), original);
  assert.equal(ESTATISTICAS_VAZIAS.gols, 0);
});

test("índice do histórico mantém autoria de eventos removidos e preferência do evento atual", () => {
  const jogo = {
    ...data,
    partida: {
      ...data.partida,
      mandante: { ...data.partida.mandante, id: 10 },
      visitante: { ...data.partida.visitante, id: 20 },
    },
    auditoria: [
      {
        id: 2,
        acao: "EVENTO_REMOVIDO",
        criado_em: "",
        dados: { evento: { ...data.eventos[0], id: 99 } },
      },
      {
        id: 1,
        acao: "EVENTO_REGISTRADO",
        criado_em: "",
        dados: { evento_id: 99 },
      },
    ],
  } as GestaoPartida;
  const indice = criarIndiceAlteracoes(jogo);
  const descricao = descreverAlteracao(jogo.auditoria![1], jogo, indice);
  assert.equal(descricao.titulo, "Gol registrado");
  assert.match(descricao.detalhes, /Ocian.*Daniel.*1º tempo/);
  assert.equal(
    descreverAlteracao(
      {
        id: 3,
        acao: "EVENTO_REGISTRADO",
        criado_em: "",
        dados: { evento_id: 3 },
      },
      jogo,
      indice,
    ).titulo,
    "Falta registrada",
  );
});


test('histórico diferencia desfazer, remoção e disciplina sem perder a autoria', () => {
  const jogo = { ...data, equipes: [{ time_id: 10, escalacao: [{ jogador_id: 1, jogador: { nome: 'Daniel' } }] }] } as unknown as GestaoPartida;
  const registro = { id: 20, criado_em: '', acao: 'EVENTO_REMOVIDO', dados: { tipo: 'GOL', time_id: 10, jogador_id: 1, desfeito: true } };
  assert.match(descreverAlteracao(registro, jogo).titulo, /desfeit/);
  const expulsao = descreverAlteracao({ ...registro, acao: 'JOGADOR_EXPULSO' }, jogo);
  assert.match(expulsao.titulo, /expuls/i);
  assert.match(expulsao.detalhes, /Daniel/);
});
