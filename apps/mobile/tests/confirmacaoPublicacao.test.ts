import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enviarComConfirmacao } from '../src/utils/confirmacaoPublicacao';

test('timeout depois do commit é reconhecido sem reenviar o evento', async () => {
  let envios = 0;
  const recente = { auditoria: [{ dados: { request_id: 'envio-1' } }] };
  const resultado = await enviarComConfirmacao('envio-1', async () => {
    envios++;
    throw new Error('timeout');
  }, async () => recente);
  assert.equal(resultado, recente);
  assert.equal(envios, 1);
});

test('outro evento não confirma envio e preserva o erro original', async () => {
  const erro = new Error('timeout');
  await assert.rejects(enviarComConfirmacao('envio-1', async () => { throw erro; },
    async () => ({ auditoria: [{ dados: { request_id: 'outro-envio' } }] })), e => e === erro);
});

test('falha ao verificar não esconde o erro original', async () => {
  const erro = new Error('sem conexão');
  await assert.rejects(enviarComConfirmacao('envio-1', async () => { throw erro; },
    async () => { throw new Error('consulta indisponível'); }), e => e === erro);
});

test('resposta confirmada não exige consulta extra', async () => {
  let consultas = 0;
  await enviarComConfirmacao('envio-1', async () => ({ ok: true }), async () => { consultas++; return {}; });
  assert.equal(consultas, 0);
});
