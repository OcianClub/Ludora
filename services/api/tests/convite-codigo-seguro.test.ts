import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cifrarCodigo, decifrarCodigo } from '../src/modules/convites/codigo-seguro';

test('código recuperável é cifrado, autenticado e isolado por clube', () => {
  const codigo='ABCD-2345', a=cifrarCodigo(codigo,1), b=cifrarCodigo(codigo,1);
  assert.notEqual(a,b);assert.ok(!a.includes(codigo));
  assert.equal(decifrarCodigo(a,1),codigo);
  assert.equal(decifrarCodigo(a,2),null);
  const parts=a.split('.');parts[3]='AAAA';assert.equal(decifrarCodigo(parts.join('.'),1),null);
  for(const invalid of ['', 'v2.a.b.c', 'v1.a.b.c.extra','v1.a.b.c'])assert.equal(decifrarCodigo(invalid,1),null);
});
