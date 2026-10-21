import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarAgrupadorConsultas } from '../src/utils/consultasEmAndamento';

function preparar() {
  const chamadas: {
    url: string;
    opcoes?: RequestInit;
    concluir: (resposta: Response) => void;
    falhar: (erro: Error) => void;
  }[] = [];
  const consultar = criarAgrupadorConsultas(
    (url, opcoes) =>
      new Promise((concluir, falhar) => {
        chamadas.push({ url, opcoes, concluir, falhar });
      })
  );
  return { consultar, chamadas };
}

test('GETs simultâneos iguais compartilham rede, mas cada consumidor pode ler o JSON', async () => {
  const { consultar, chamadas } = preparar();
  const a = consultar('/partidas', {
    headers: { Authorization: 'Bearer a', 'x-clube-id': '1' },
  });
  const b = consultar('/partidas', {
    headers: { 'x-clube-id': '1', authorization: 'Bearer a' },
  });
  assert.equal(chamadas.length, 1);
  chamadas[0].concluir(Response.json([1]));
  assert.deepEqual(await (await a).json(), [1]);
  assert.deepEqual(await (await b).json(), [1]);
  const c = consultar('/partidas', {
    headers: { Authorization: 'Bearer a', 'x-clube-id': '1' },
  });
  assert.equal(chamadas.length, 2);
  chamadas[1].concluir(Response.json([2]));
  assert.deepEqual(await (await c).json(), [2]);
});

test('não mistura clubes, sessões, opções de credenciais ou cancelamentos', async () => {
  const { consultar, chamadas } = preparar();
  const promessas = [
    consultar('/partidas', {
      headers: { Authorization: 'a', 'x-clube-id': '1' },
    }),
    consultar('/partidas', {
      headers: { Authorization: 'a', 'x-clube-id': '2' },
    }),
    consultar('/partidas', {
      headers: { Authorization: 'b', 'x-clube-id': '1' },
    }),
    consultar('/partidas', { credentials: 'include' }),
    consultar('/partidas', { credentials: 'omit' }),
    consultar('/partidas', { signal: new AbortController().signal }),
    consultar('/partidas', { signal: new AbortController().signal }),
  ];
  assert.equal(chamadas.length, promessas.length);
  chamadas.forEach((chamada, i) => chamada.concluir(Response.json(i)));
  assert.deepEqual(
    await Promise.all(promessas.map(async (p) => (await p).json())),
    [0, 1, 2, 3, 4, 5, 6]
  );
});

test('mutação não é agrupada e uma nova leitura não reaproveita GET anterior à escrita', async () => {
  const { consultar, chamadas } = preparar();
  const promessas = [
    consultar('/partidas'),
    consultar('/partidas', { method: 'POST' }),
    consultar('/partidas', { method: 'POST' }),
    consultar('/partidas'),
  ];
  assert.equal(chamadas.length, 4);
  chamadas.forEach((chamada) => chamada.concluir(Response.json([])));
  await Promise.all(promessas);
});

test('falha compartilhada não prende novas tentativas', async () => {
  const { consultar, chamadas } = preparar();
  const a = consultar('/partidas');
  const b = consultar('/partidas');
  const verificacoes = [
    assert.rejects(a, /Sem rede/),
    assert.rejects(b, /Sem rede/),
  ];
  chamadas[0].falhar(new Error('Sem rede'));
  await Promise.all(verificacoes);
  const c = consultar('/partidas');
  assert.equal(chamadas.length, 2);
  chamadas[1].concluir(Response.json([]));
  await c;
});
