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
test('segundo plano pausa os prazos; retomar oferece cinco segundos completos sem publicar silenciosamente', async () => {
  const enviados: string[] = [];
  const f = fixture(async item => { enviados.push(item.dados); });
  f.fila.adicionar('gol'); await f.avancar(4000); f.fila.pausar();
  await f.avancar(60000);
  assert.deepEqual(enviados, []); assert.equal(f.itens()[0].status, 'pausado');
  f.fila.retomar(); await f.avancar(4999); assert.deepEqual(enviados, []);
  await f.avancar(1); assert.deepEqual(enviados, ['gol']);
});
test('restauração após saída preserva request_id e exige retomada explícita', async () => {
  const enviados: string[] = [];
  const f = fixture(async item => { enviados.push(item.id); });
  f.fila.restaurar([{ id: 'mobile-envio-anterior', dados: 'gol', enviarEm: 0, status: 'enviando' }]);
  await f.avancar(60000); assert.deepEqual(enviados, []);
  f.fila.retomar(); await f.avancar(5000); assert.deepEqual(enviados, ['mobile-envio-anterior']);
});

test('falha de envio em segundo plano pode ser verificada ao retornar sem travar a fila', async () => {
  let rejeitar!: (erro: Error) => void;
  let chamadas = 0;
  const f = fixture(async () => {
    chamadas++;
    if (chamadas === 1) await new Promise<void>((_resolve, reject) => { rejeitar = reject; });
  });
  const id = f.fila.adicionar('gol');
  await f.avancar(5000); f.fila.pausar(); rejeitar(new Error('resposta não confirmada'));
  await f.avancar(1000); assert.equal(f.itens()[0].status, 'erro');
  f.fila.tentar(id);
  await f.avancar(4999); assert.equal(chamadas, 1);
  await f.avancar(1); assert.equal(chamadas, 2); assert.deepEqual(f.itens(), []);
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
