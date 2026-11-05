import assert from "node:assert/strict";
import { test } from "node:test";
import { criarCacheConsultasRecentes } from "../src/utils/consultasRecentes";

test('consulta feita enquanto uma escrita aguarda confirmação não permanece no cache', async () => {
  let concluir!: (resposta: Response) => void;
  let leituras = 0;
  const cache = criarCacheConsultasRecentes(async (_, opcoes) =>
    opcoes?.method === 'PATCH'
      ? new Promise<Response>(resolve => { concluir = resolve; })
      : Response.json(++leituras)
  );
  const escrita = cache.consultar('/camisa', { method: 'PATCH' });
  await cache.consultar('/agenda', {}, 15_000);
  concluir(Response.json({}));
  await escrita;
  assert.equal(await (await cache.consultar('/agenda', {}, 15_000)).json(), 2);
});

test("navegação reaproveita a leitura por 15s e atualização manual consulta novamente", async () => {
  let agora = 0,
    chamadas = 0;
  const cache = criarCacheConsultasRecentes(
    async () => Response.json({ revisao: ++chamadas }),
    () => agora,
  );
  const ler = async (forcar = false) =>
    (await cache.consultar("/agenda", {}, 15_000, forcar)).json();
  assert.deepEqual(await ler(), { revisao: 1 });
  assert.deepEqual(await ler(), { revisao: 1 });
  assert.deepEqual(await ler(true), { revisao: 2 });
  agora = 15_000;
  assert.deepEqual(await ler(), { revisao: 3 });
});

test("separa sessão, clube e filtros e permite ler cada resposta uma única vez", async () => {
  let chamadas = 0;
  const cache = criarCacheConsultasRecentes(async () =>
    Response.json(++chamadas),
  );
  for (const token of ["a", "b"])
    for (const clube of ["1", "2"]) {
      const options = {
        headers: { Authorization: token, "x-clube-id": clube },
      };
      const primeira = await (
        await cache.consultar("/agenda?ano=2026", options, 15_000)
      ).json();
      assert.equal(
        await (
          await cache.consultar("/agenda?ano=2026", options, 15_000)
        ).json(),
        primeira,
      );
    }
  await cache.consultar("/agenda?ano=2027", {}, 15_000);
  assert.equal(chamadas, 5);
});

test("escritas e eventos em tempo real invalidam as leituras", async () => {
  let chamadas = 0;
  const cache = criarCacheConsultasRecentes(async () =>
    Response.json(++chamadas),
  );
  await cache.consultar("/agenda", {}, 15_000);
  await cache.consultar("/jogadores/1", { method: "PATCH" });
  assert.equal(await (await cache.consultar("/agenda", {}, 15_000)).json(), 3);
  cache.invalidar();
  assert.equal(await (await cache.consultar("/agenda", {}, 15_000)).json(), 4);
});

test("resposta antiga em andamento não repovoa cache após uma alteração", async () => {
  let concluir!: (r: Response) => void;
  let chamadas = 0;
  const cache = criarCacheConsultasRecentes(async () => {
    chamadas++;
    return chamadas === 1
      ? new Promise<Response>((resolve) => {
          concluir = resolve;
        })
      : Response.json(chamadas);
  });
  const primeira = cache.consultar("/agenda", {}, 15_000);
  cache.invalidar();
  concluir(Response.json("antiga"));
  await primeira;
  assert.equal(await (await cache.consultar("/agenda", {}, 15_000)).json(), 2);
});

test("falhas, cancelamentos e endpoints sem cache sempre voltam à rede", async () => {
  let chamadas = 0;
  const cache = criarCacheConsultasRecentes(async () => {
    chamadas++;
    return Response.json({}, { status: 500 });
  });
  await cache.consultar("/scout", {}, 15_000);
  await cache.consultar("/scout", {}, 15_000);
  await cache.consultar("/gestao");
  await cache.consultar("/gestao");
  const controller = new AbortController();
  controller.abort();
  await cache.consultar("/scout", { signal: controller.signal }, 15_000);
  assert.equal(chamadas, 5);
});

test("recusa de acesso descarta leituras existentes e cache tem limite de 20 consultas", async () => {
  let chamadas = 0;
  const cache = criarCacheConsultasRecentes(async (url) => {
    chamadas++;
    return Response.json({}, { status: url === "/negado" ? 403 : 200 });
  });
  await cache.consultar("/agenda", {}, 15_000);
  await cache.consultar("/negado", {}, 15_000);
  await cache.consultar("/agenda", {}, 15_000);
  assert.equal(chamadas, 3);
  for (let id = 0; id < 21; id++)
    await cache.consultar(`/atleta/${id}`, {}, 15_000);
  await cache.consultar("/atleta/0", {}, 15_000);
  assert.equal(chamadas, 25);
});
