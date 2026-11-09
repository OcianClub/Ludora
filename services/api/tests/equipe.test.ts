import assert from 'node:assert/strict';
import { test } from 'node:test';
import { papelPlataformaEfetivo } from '../src/modules/admin/admin.rules';

test('papéis internos são independentes dos cargos de clube e rejeitam valores desconhecidos', () => {
  for (const papel of ['SUPORTE', 'DESENVOLVEDOR', 'SUPERADMIN', 'USUARIO'] as const) {
    assert.equal(papelPlataformaEfetivo({ papel_plataforma: papel }, new Set()), papel);
  }
  assert.equal(papelPlataformaEfetivo({ papel_plataforma: 'ADMIN' }, new Set()), 'USUARIO');
  assert.equal(papelPlataformaEfetivo({}, new Set()), 'USUARIO');
});

test('allowlist administrativa legada conserva seu efeito explícito', () => {
  assert.equal(papelPlataformaEfetivo({ email: 'owner@example.test', papel_plataforma: 'USUARIO' }, new Set(['owner@example.test'])), 'SUPERADMIN');
});
