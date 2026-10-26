import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caminhoApiPermitido, emailValido, metodoPermitido, validarApiUrl } from '../src/shared/rules';

test('URL da API: https sempre, http só em máquina local, sem credenciais, devolve só a origem', () => {
  assert.equal(validarApiUrl('https://api.ludora.com/'), 'https://api.ludora.com');
  assert.equal(validarApiUrl(' https://api.ludora.com/admin?x=1#y '), 'https://api.ludora.com');
  assert.equal(validarApiUrl('http://localhost:3000'), 'http://localhost:3000');
  assert.equal(validarApiUrl('http://127.0.0.1:3000/'), 'http://127.0.0.1:3000');
  assert.equal(validarApiUrl('http://[::1]:3000'), 'http://[::1]:3000');
  assert.throws(() => validarApiUrl('http://api.ludora.com'), /https/);
  assert.throws(() => validarApiUrl('http://localhost.evil.com'), /https/);
  assert.throws(() => validarApiUrl('ftp://api.ludora.com'), /https/);
  assert.throws(() => validarApiUrl('file:///etc/passwd'), /https/);
  assert.throws(() => validarApiUrl('https://user:pass@api.ludora.com'), /usuário/);
  assert.throws(() => validarApiUrl('não é url'), /inválida/);
  assert.throws(() => validarApiUrl(''), /inválida/);
});

test('renderer só alcança login e rotas /admin (allowlist de caminhos)', () => {
  for (const ok of ['/auth/login', '/admin/me', '/admin/overview', '/admin/clubes/12/membros/7', '/admin/usuarios?busca=ana&limite=20', '/admin/logs?limite=200']) {
    assert.equal(caminhoApiPermitido(ok), true, ok);
  }
  for (const ruim of [
    '/jogadores', '/partidas/1', '/auth/registrar', '/auth/login/x', '/admin', '/admin/',
    '/admin/../jogadores', '/admin/%2e%2e/x', '/admin/clubes/../../x', '//evil.com/admin/me',
    'https://evil.com/admin/me', '/admin/me?a=1?b=2', '/admin/x y', '/admin/me#frag', '/admin/me?x=<script>',
    '', '/x'.repeat(200) + '/admin/me',
  ]) {
    assert.equal(caminhoApiPermitido(ruim), false, ruim);
  }
  for (const nao of [null, undefined, 42, {}, ['/admin/me']]) assert.equal(caminhoApiPermitido(nao), false);
});

test('métodos HTTP e e-mail de login são validados', () => {
  for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(metodoPermitido(m), true);
  for (const m of ['get', 'TRACE', 'CONNECT', 'OPTIONS', '', null, 1]) assert.equal(metodoPermitido(m), false);
  assert.equal(emailValido('dev@ludora.com'), true);
  for (const e of ['dev', 'a b@c.com', '', null, 'x'.repeat(300) + '@a.com']) assert.equal(emailValido(e), false);
});
