import assert from 'node:assert/strict';
import { test } from 'node:test';
import { preferenciaTemaSalva, resolverTema } from '../src/utils/tema';

test('primeira instalação segue o sistema', () => {
  assert.equal(preferenciaTemaSalva(null), 'system');
  assert.equal(resolverTema(preferenciaTemaSalva(null), 'dark'), 'dark');
  assert.equal(resolverTema(preferenciaTemaSalva(null), 'light'), 'light');
});
test('modo sistema acompanha mudanças de aparência', () => {
  assert.equal(resolverTema('system', 'light'), 'light');
  assert.equal(resolverTema('system', 'dark'), 'dark');
});
test('escolha manual prevalece sobre o sistema', () => {
  assert.equal(resolverTema('light', 'dark'), 'light');
  assert.equal(resolverTema('dark', 'light'), 'dark');
});
test('preferências manuais antigas são preservadas', () => {
  assert.equal(preferenciaTemaSalva('dark'), 'dark');
  assert.equal(preferenciaTemaSalva('light'), 'light');
});
test('preferência inválida ou sistema sem preferência usa fallback seguro', () => {
  assert.equal(preferenciaTemaSalva('invalido'), 'system');
  assert.equal(resolverTema('system', null), 'light');
  assert.equal(resolverTema('system', undefined), 'light');
});
