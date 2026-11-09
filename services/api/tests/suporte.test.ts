import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classificar, rotaSegura, sanitizar } from '../src/modules/suporte/rules';

test('triagem determinística prioriza restrição, alcance e recorrência', () => {
  assert.equal(classificar('RECUPERACAO', 100, 20, 500).fila, 'RESTRITA');
  assert.equal(classificar('ERRO', 1, 1, 500).regra, 'TRIAGEM_HUMANA');
  assert.equal(classificar('ERRO', 3, 1, 500).fila, 'DESENVOLVIMENTO');
  assert.equal(classificar('ERRO', 1, 3).prioridade, 'ALTA');
  assert.equal(classificar('CONVITE', 1, 1).fila, 'SUPORTE');
});
test('sanitização elimina query, códigos, documentos e segredos reconhecíveis', () => {
  assert.equal(rotaSegura('https://example.test/convites/codigo/ABCD-EFGH?token=private'), '/convites/[removido]/ABCD-EFGH'.replace('ABCD-EFGH', '[código removido]'));
  const text = sanitizar('senha=private 123.456.789-10 token=abcdef person@example.test ABCD-EFGH 123456');
  for (const segredo of ['private', '123.456.789-10', 'abcdef', 'person@example.test', 'ABCD-EFGH', '123456']) assert.equal(text.includes(segredo), false);
});
