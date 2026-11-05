import test from "node:test";
import assert from "node:assert/strict";
import { criarCacheDadosScout } from "../src/utils/cacheDadosScout";
const adiar = <T>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};
test("deduplica consultas e reaproveita o JSON com a mesma identidade por 15s", async () => {
  let agora = 0,
    requests = 0;
  const cache = criarCacheDadosScout<{ gols: number }>(() => agora);
  const gate = adiar<{ gols: number }>();
  const load = () => {
    requests++;
    return gate.promise;
  };
  const a = cache.consultar("sessao:clube:atleta:geral", load);
  const b = cache.consultar("sessao:clube:atleta:geral", load);
  await Promise.resolve();
  assert.equal(requests, 1);
  gate.resolve({ gols: 3 });
  const [x, y] = await Promise.all([a, b]);
  assert.equal(x, y);
  assert.equal(await cache.consultar("sessao:clube:atleta:geral", load), x);
  agora = 15000;
  assert.equal(cache.ler("sessao:clube:atleta:geral"), null);
  await cache.consultar("sessao:clube:atleta:geral", () => {
    requests++;
    return Promise.resolve({ gols: 4 });
  });
  assert.equal(requests, 2);
});
test("cancelar uma ficha não cancela a consulta de outro consumidor nem causa novo pedido ao reabrir", async () => {
  const cache = criarCacheDadosScout<number>();
  const gate = adiar<number>();
  let count = 0;
  const load = () => {
    count++;
    return gate.promise;
  };
  const controller = new AbortController();
  const a = cache.consultar("escopo", load, controller.signal);
  const canceled = assert.rejects(a, { name: "AbortError" });
  const b = cache.consultar("escopo", load);
  controller.abort();
  gate.resolve(7);
  await canceled;
  assert.equal(await b, 7);
  assert.equal(await cache.consultar("escopo", load), 7);
  assert.equal(count, 1);
});
test("separa sessão, clube, atleta, filtros e revisão; atualização forçada volta à rede", async () => {
  const cache = criarCacheDadosScout<number>();
  let count = 0;
  const load = async () => ++count;
  for (const key of [
    "sessao1:clube1:0:1:geral",
    "sessao2:clube1:0:1:geral",
    "sessao1:clube2:0:1:geral",
    "sessao1:clube1:1:1:geral",
    "sessao1:clube1:0:2:geral",
    "sessao1:clube1:0:1:ano2026",
  ])
    await cache.consultar(key, load);
  assert.equal(count, 6);
  await cache.consultar("sessao1:clube1:0:1:geral", load, undefined, true);
  assert.equal(count, 7);
});
test("falhas não ficam em cache, chamadas já canceladas não disparam rede e memória é limitada", async () => {
  const cache = criarCacheDadosScout<number>(Date.now, 15000, 2);
  let count = 0;
  await assert.rejects(
    cache.consultar("falha", async () => {
      count++;
      throw new Error("rede");
    }),
  );
  assert.equal(await cache.consultar("falha", async () => ++count), 2);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    cache.consultar("cancelada", async () => ++count, controller.signal),
    { name: "AbortError" },
  );
  assert.equal(count, 2);
  await cache.consultar("a", async () => 1);
  await cache.consultar("b", async () => 2);
  assert.equal(cache.ler("falha"), null);
});
