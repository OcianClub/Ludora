import assert from "node:assert/strict";
import { test } from "node:test";
import { criarGestoTroca, TEMPO_ATIVAR_TROCA } from "../src/utils/gestoTroca";

function montar() {
  let ativar: (() => void) | undefined;
  let bloqueado = false;
  let selecionados = 0;
  const movimentos: number[][] = [];
  const solturas: number[][] = [];
  const estados: boolean[] = [];
  const gesto = criarGestoTroca(
    {
      capturar: () => {
        bloqueado = true;
      },
      ativar: (ativo) => estados.push(ativo),
      mover: (x, y) => movimentos.push([x, y]),
      soltar: (x, y) => {
        bloqueado = false;
        solturas.push([x, y]);
      },
      tocar: () => {
        selecionados++;
      },
    },
    {
      agendar: (acao) => {
        ativar = acao;
        return 1 as any;
      },
      cancelar: () => {
        ativar = undefined;
      },
    },
  );
  return {
    gesto,
    movimentos,
    solturas,
    estados,
    aguardar: () => ativar?.(),
    bloqueado: () => bloqueado,
    selecionados: () => selecionados,
  };
}

test("o ícone captura o toque antes do movimento e ativa rapidamente o arraste", () => {
  const ui = montar();
  assert.equal(TEMPO_ATIVAR_TROCA, 140);
  ui.gesto.iniciar();
  assert.equal(ui.bloqueado(), true);
  ui.gesto.mover(0, 12);
  assert.deepEqual(ui.movimentos, []);
  ui.aguardar();
  assert.deepEqual(ui.estados, [true]);
  assert.deepEqual(ui.movimentos, [[0, 12]]);
  ui.gesto.mover(0, 80);
  ui.gesto.soltar();
  assert.deepEqual(ui.solturas, [[0, 80]]);
  assert.equal(ui.bloqueado(), false);
  assert.equal(ui.selecionados(), 0);
  assert.deepEqual(ui.movimentos.at(-1), [0, 0]);
});

test("toque simples seleciona uma única vez e não troca por arraste", () => {
  const ui = montar();
  ui.gesto.iniciar();
  ui.gesto.soltar();
  ui.aguardar();
  assert.equal(ui.selecionados(), 1);
  assert.equal(ui.bloqueado(), false);
  assert(ui.solturas[0].every(Number.isNaN));
  assert(!ui.estados.includes(true));
});

test("cancelamento ou movimento rápido libera a rolagem sem troca acidental", () => {
  for (const cancelar of [false, true]) {
    const ui = montar();
    ui.gesto.iniciar();
    ui.gesto.mover(10, 100);
    if (cancelar) {
      ui.aguardar();
      ui.gesto.cancelar();
    } else ui.gesto.soltar();
    ui.aguardar();
    assert.equal(ui.bloqueado(), false);
    assert.equal(ui.selecionados(), 0);
    assert(ui.solturas[0].every(Number.isNaN));
  }
});

test("segurar sem mover preserva a alternativa de selecionar dois jogadores", () => {
  const ui = montar();
  ui.gesto.iniciar();
  ui.aguardar();
  ui.gesto.soltar();
  assert.equal(ui.selecionados(), 1);
  assert.equal(ui.bloqueado(), false);
  assert(ui.solturas[0].every(Number.isNaN));
});
