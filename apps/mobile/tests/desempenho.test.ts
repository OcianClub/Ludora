import assert from "node:assert/strict";
import { test } from "node:test";
import { temposServidor, lerJsonMedido, destinoApi } from "../src/utils/desempenho";

test("diagnóstico conserva somente nomes e durações do Server-Timing", () => {
  assert.deepEqual(
    temposServidor(
      'scout-db;dur=6447.5;desc="privado", scout-total;dur=10553.9, invalido;dur=NaN',
    ),
    {
      "servidor:scout-db": 6447.5,
      "servidor:scout-total": 10553.9,
    },
  );
  assert.deepEqual(temposServidor(null), {});
});
test("medir leitura do JSON não altera resposta nem oculta falhas", async () => {
  assert.deepEqual(
    await lerJsonMedido(Response.json({ eventos: [1, 2] }), "teste"),
    { eventos: [1, 2] },
  );
  await assert.rejects(lerJsonMedido(new Response("não é JSON"), "teste"));
});


test('diagnóstico identifica API local e Render sem expor credenciais ou query', () => {
  assert.deepEqual(destinoApi('http://192.168.15.2:3000'), {
    origem: 'http://192.168.15.2:3000', ambiente: 'local',
  });
  for (const host of ['localhost', '127.0.0.1', '10.0.2.2', '172.16.0.1', '[::1]'])
    assert.equal(destinoApi(`http://${host}:3000`).ambiente, 'local');
  assert.equal(destinoApi('https://ludora-pgho.onrender.com').ambiente, 'render');
  assert.equal(destinoApi('https://api.example.com').ambiente, 'remoto');
  assert.deepEqual(destinoApi('https://segredo:senha@api.example.com/usuarios/123?token=privado'), {
    origem: 'https://api.example.com', ambiente: 'remoto',
  });
  assert.deepEqual(destinoApi('url inválida'), { origem: 'inválida', ambiente: 'invalido' });
});
