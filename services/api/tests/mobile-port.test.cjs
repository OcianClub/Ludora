const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { escolherPorta, portaDisponivel } = require('../../../scripts/start-mobile.cjs');

test('inicialização do mobile evita porta ocupada sem encerrar o processo existente', async t => {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  assert.equal(await portaDisponivel(port), false);
  await assert.rejects(escolherPorta(port, port), /ocupadas/);
  if (port < 65535) {
    const next = await escolherPorta(port, Math.min(port + 10, 65535));
    assert.ok(next > port);
  }
  assert.equal(server.listening, true, 'O servidor que já estava aberto é preservado');
});
