import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  codigoSenhaValido,
  normalizarCodigoSenha,
  senhaRecuperacaoValida,
} from '../src/utils/recuperacaoSenha';

test('código aceita hífen, espaços e letras minúsculas sem aceitar caracteres ambíguos', () => {
  assert.equal(normalizarCodigoSenha('abcd-2345'), 'ABCD2345');
  assert.equal(codigoSenhaValido(' abcd 2345 '), true);
  for (const codigo of ['', 'ABCD234', 'ABCD23456', 'ABCD-0000', 'ABCD/2345']) {
    assert.equal(codigoSenhaValido(codigo), false);
  }
});

test('a nova senha respeita o mínimo e o limite em bytes do bcrypt', () => {
  assert.equal(senhaRecuperacaoValida('1234567'), false);
  assert.equal(senhaRecuperacaoValida('Uma-senha-123'), true);
  assert.equal(senhaRecuperacaoValida('a'.repeat(72)), true);
  assert.equal(senhaRecuperacaoValida('a'.repeat(73)), false);
  assert.equal(senhaRecuperacaoValida('á'.repeat(36)), true);
  assert.equal(senhaRecuperacaoValida('á'.repeat(37)), false);
  assert.equal(senhaRecuperacaoValida('🔒'.repeat(19)), false);
});
