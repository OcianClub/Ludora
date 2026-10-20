import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lerRespostaConvite } from '../src/features/convites/resposta';

test('convites mostram orientação conforme o estado', async () => {
  for (const [status, error, esperado] of [
    [404, 'Convite inválido', /8 caracteres/],
    [410, 'Este convite expirou', /novo código/],
    [410, 'Este convite foi revogado', /cancelado pelo clube/],
    [409, 'Este convite já foi utilizado', /Entre na sua conta/],
    [403, 'Este convite pertence a outro e-mail', /outra conta/],
    [401, 'Token inválido', /sessão expirou/],
    [429, '', /Muitas tentativas/],
  ] as const) {
    await assert.rejects(lerRespostaConvite(new Response(JSON.stringify({ error }), { status })), esperado);
  }
});

test('convites não expõem erros internos nem aceitam resposta ilegível', async () => {
  await assert.rejects(lerRespostaConvite(new Response('prisma detalhes', { status: 500 })), /indisponível/);
  await assert.rejects(lerRespostaConvite(new Response('HTML')), /confirmar a resposta/);
  await assert.rejects(lerRespostaConvite(new Response(JSON.stringify({ error: 'detalhe interno' }), { status: 400 })), /Confira os dados/);
  assert.deepEqual(await lerRespostaConvite(new Response('{"ok":true}')), { ok: true });
});
