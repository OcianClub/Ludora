import assert from "node:assert/strict";
import { test } from "node:test";
import {
  criarFilaPublicacao,
  type ItemPublicacao,
} from "../src/utils/filaPublicacao";

function fixture(executar: (item: ItemPublicacao<string>) => Promise<void>) {
  let agora = 0,
    seq = 0;
  let itens: ItemPublicacao<string>[] = [];
  const timers = new Map<number, { em: number; fn: () => void }>();
  const fila = criarFilaPublicacao({
    executar,
    atualizar: (next) => {
      itens = next;
    },
    agora: () => agora,
    agendar: (fn, ms) => {
      const id = ++seq;
      timers.set(id, { em: agora + ms, fn });
      return id as any;
    },
    cancelarTimer: (id) => {
      timers.delete(id as any);
    },
  });
  async function avancar(ms: number) {
    agora += ms;
    for (let vez = 0; vez < 10; vez++) {
      const ready = [...timers].filter(([, t]) => t.em <= agora);
      for (const [id, t] of ready) {
        timers.delete(id);
        t.fn();
      }
      await new Promise((resolve) => setImmediate(resolve));
      if (!ready.length) break;
    }
  }
  return { fila, avancar, itens: () => itens };
}
test("lançamento não sai antes de cinco segundos e cancelar evita a escrita/notificação", async () => {
  const enviados: string[] = [];
  const f = fixture(async (i) => {
    enviados.push(i.dados);
  });
  const id = f.fila.adicionar("gol");
  await f.avancar(4999);
  assert.deepEqual(enviados, []);
  f.fila.cancelar(id);
  await f.avancar(10000);
  assert.deepEqual(enviados, []);
  f.fila.adicionar("falta");
  await f.avancar(5000);
  assert.deepEqual(enviados, ["falta"]);
});
test("escritas são sequenciais e repetição manual preserva o identificador idempotente", async () => {
  const ids: string[] = [];
  let falha = true;
  const f = fixture(async (i) => {
    ids.push(i.id);
    if (falha) throw new Error("rede");
  });
  const a = f.fila.adicionar("gol");
  f.fila.adicionar("falta");
  await f.avancar(5000);
  assert.equal(ids.length, 1);
  assert.equal(f.itens()[0].status, "erro");
  falha = false;
  f.fila.tentar(a);
  await f.avancar(4999);
  assert.equal(ids.length, 1);
  await f.avancar(1);
  assert.equal(ids.length, 3);
  assert.equal(ids[0], ids[1]);
  assert.deepEqual(f.itens(), []);
});
test("evento em publicação não pode ser cancelado e desmontar descarta apenas os ainda não enviados", async () => {
  let concluir!: () => void,
    chamadas = 0;
  const f = fixture(async () => {
    chamadas++;
    await new Promise<void>((resolve) => {
      concluir = resolve;
    });
  });
  const id = f.fila.adicionar("gol");
  f.fila.adicionar("outro");
  await f.avancar(5000);
  f.fila.cancelar(id);
  assert.equal(f.itens()[0].status, "enviando");
  f.fila.encerrar();
  concluir();
  await f.avancar(10000);
  assert.equal(chamadas, 1);
});
