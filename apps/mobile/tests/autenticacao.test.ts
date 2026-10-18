import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emailValido, lerRespostaAuth } from '../src/utils/autenticacao';

test('e-mail aceita espaços externos e rejeita endereços malformados', () => {
  assert.equal(emailValido('  pessoa@email.com  '), true);
  for (const email of ['', 'pessoa', 'a@@b.com', 'a b@email.com', 'a@b', `${'a'.repeat(250)}@b.com`]) {
    assert.equal(emailValido(email), false);
  }
});

test('login só inicia sessão quando a resposta contém token válido', async () => {
  for (const dados of [{}, { token: '' }, { token: '  ' }, { token: 42 }]) {
    await assert.rejects(lerRespostaAuth(new Response(JSON.stringify(dados)), 'login'), /confirmar a resposta/);
  }
  assert.equal((await lerRespostaAuth(new Response('{"token":"jwt-teste"}'), 'login')).token, 'jwt-teste');
});

test('HTML e erros internos do serviço não são expostos ao usuário', async () => {
  await assert.rejects(lerRespostaAuth(new Response('<html>Bad gateway</html>', { status: 502 }), 'login'), /indisponível/);
  await assert.rejects(lerRespostaAuth(new Response('{"error":"prisma secret database"}', { status: 500 }), 'cadastro'), /indisponível/);
  await assert.rejects(lerRespostaAuth(new Response('invalid json'), 'cadastro'), /confirmar a resposta/);
});

test('mensagens distinguem credenciais, e-mail existente e limite de tentativas', async () => {
  await assert.rejects(lerRespostaAuth(new Response('{}', { status: 401 }), 'login'), /E-mail ou senha incorretos/);
  await assert.rejects(lerRespostaAuth(new Response('{}', { status: 409 }), 'cadastro'), /já possui uma conta/);
  await assert.rejects(lerRespostaAuth(new Response('{}', { status: 429 }), 'login'), /Muitas tentativas/);
});

test('cadastro reconhece criação sem exigir token de login', async () => {
  assert.equal((await lerRespostaAuth(new Response('{"id":6}', { status: 201 }), 'cadastro')).id, 6);
});
