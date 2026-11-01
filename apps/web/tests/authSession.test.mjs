import test from 'node:test';
import assert from 'node:assert/strict';
import { clearSavedSession, reconcileClubAccess } from '../src/services/authSession.ts';

test('perda do vínculo remove todas as permissões salvas sem bloquear consulta pública', () => {
  const selected = { id: 3, nome: 'Santos', meuPapel: 'TECNICO', acessoTodasCategorias: true, categoriasAcesso: [{ id: 12, nome: 'sub-7' }] };
  const result = reconcileClubAccess(selected, []);
  assert.equal(result.id, 3);
  assert.equal(result.nome, 'Santos');
  assert.equal(result.meuPapel, null);
  assert.equal(result.acessoTodasCategorias, false);
  assert.deepEqual(result.categoriasAcesso, []);
  assert.equal(selected.meuPapel, 'TECNICO');
});

test('perfil atualizado usa as permissões atuais do clube selecionado', () => {
  const selected = { id: 3, nome: 'Santos', meuPapel: 'ADMIN' };
  const current = { id: 3, nome: 'Santos', meuPapel: 'TECNICO', acessoTodasCategorias: false, categoriasAcesso: [{ id: 12, nome: 'sub-7' }] };
  assert.deepEqual(reconcileClubAccess(selected, [{ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }, current]), current);
});

test('logout remove os dados da conta mesmo se uma chave do armazenamento falhar', t => {
  const removed = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { removeItem: key => {
    removed.push(key);
    if (key === 'ludora_token') throw new Error('storage unavailable');
  } } });
  clearSavedSession();
  assert.deepEqual(removed, ['ludora_token', 'ludora_clube_id', 'ludora_usuario', 'ludora_clube']);
});
