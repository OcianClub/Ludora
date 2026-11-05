import assert from "node:assert/strict";
import { test } from "node:test";
import { criarFilaConsulta } from "../src/utils/filaConsulta";

test("vários pedidos simultâneos compartilham uma leitura", async () => {
  let chamadas = 0;
  const fila = criarFilaConsulta(async () => ++chamadas);
  assert.deepEqual(
    await Promise.all([fila.consultar(), fila.consultar(), fila.consultar()]),
    [1, 1, 1],
  );
  assert.equal(await fila.consultar(), 2);
});

test("rajada de eventos durante consulta lenta gera apenas uma leitura adicional", async () => {
  const conclusoes: ((n: number) => void)[] = [];
  const fila = criarFilaConsulta(
    () => new Promise<number>((resolve) => conclusoes.push(resolve)),
  );
  const primeira = fila.consultar();
  await Promise.resolve();
  const a = fila.consultar(true),
    b = fila.consultar(true),
    c = fila.consultar(true);
  assert.equal(conclusoes.length, 1);
  conclusoes[0](1);
  assert.equal(await primeira, 1);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(conclusoes.length, 2);
  conclusoes[1](2);
  assert.deepEqual(await Promise.all([a, b, c]), [2, 2, 2]);
});

test("falha não prende fila e uma atualização posterior à escrita recebe dados novos", async () => {
  let falhar!: (e: Error) => void;
  let chamadas = 0;
  const fila = criarFilaConsulta(() =>
    ++chamadas === 1
      ? new Promise<number>((_, reject) => {
          falhar = reject;
        })
      : Promise.resolve(chamadas),
  );
  const primeira = fila.consultar();
  await Promise.resolve();
  const depois = fila.consultar(true);
  const erro = assert.rejects(primeira, /rede/);
  falhar(new Error("rede"));
  await erro;
  assert.equal(await depois, 2);
  assert.equal(await fila.consultar(), 3);
});
