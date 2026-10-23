import test from 'node:test';
import assert from 'node:assert/strict';
import { caminhoConvite, codigoValido, erroConfirmacao, erroEmail, erroNome, erroSenha, formatarCodigo, normalizarEmail } from '../src/utils/authValidation.ts';

test('valida nome e e-mail sem remover acentos e normaliza o endereço no envio', () => {
  assert.ok(erroNome(' A '));
  assert.equal(erroNome(' João da Silva '), '');
  assert.ok(erroNome('a'.repeat(101)));
  assert.ok(erroEmail('teste@'));
  assert.ok(erroEmail('teste @example.com'));
  assert.equal(erroEmail(' Murilo@Example.com '), '');
  assert.equal(normalizarEmail(' Murilo@Example.com '), 'murilo@example.com');
});

test('senha respeita mínimo de caracteres e limite bcrypt em bytes, inclusive Unicode', () => {
  assert.ok(erroSenha('abc123'));
  assert.equal(erroSenha('segredo123'), '');
  assert.equal(erroSenha('a'.repeat(72)), '');
  assert.ok(erroSenha('a'.repeat(73)));
  assert.equal(erroSenha('é'.repeat(36)), '');
  assert.ok(erroSenha('é'.repeat(37)));
  assert.ok(erroConfirmacao('segredo123', 'Segredo123'));
  assert.equal(erroConfirmacao('segredo123', 'segredo123'), '');
});

test('códigos de confirmação e convite preservam o contrato de oito caracteres', () => {
  assert.equal(formatarCodigo('abcd 2345'), 'ABCD-2345');
  assert.equal(codigoValido('abcd-2345'), true);
  for (const value of ['1234-5678', 'ABCD-2340', 'ABCI-2345', 'ABCO-2345', 'ABCD', 'ABCD23456', 'ABCD/234']) {
    assert.equal(codigoValido(value), false, value);
  }
  assert.equal(caminhoConvite('abcd-2345'), '/convites/codigo/ABCD2345');
  assert.equal(caminhoConvite('../login'), null);
  assert.equal(caminhoConvite('a'.repeat(43), true), `/convites/${'a'.repeat(43)}`);
  assert.equal(caminhoConvite('short', true), null);
});
