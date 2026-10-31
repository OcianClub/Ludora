import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EMPTY_CLUB_ADDRESS, formatClubCep, normalizeClubForm, validateClubForm } from '../src/utils/clubProfile.ts';

test('identidade pode ser salva sem endereço e diferenças de formatação não criam alterações', () => {
  assert.deepEqual(normalizeClubForm({ nome: ' Ocian ', escudo: '', endereco: { ...EMPTY_CLUB_ADDRESS } }),
    { nome: 'Ocian', escudo: null, endereco: null });
  assert.deepEqual(validateClubForm({ nome: 'Ocian', escudo: null, endereco: null }), {});
  assert.equal(formatClubCep('11704890'), '11704-890');
  assert.equal(formatClubCep('11704-89099'), '11704-890');
});

test('endereço parcial aponta os campos necessários e rejeita UF inexistente', () => {
  const address = { ...EMPTY_CLUB_ADDRESS, bairro: 'Ocian' };
  assert.deepEqual(Object.keys(validateClubForm({ nome: 'Ocian', endereco: address })).sort(), ['cep', 'cidade', 'estado', 'logradouro']);
  const form = { nome: 'Ocian', endereco: { ...address, logradouro: 'Av. Presidente Kennedy', cidade: 'Praia Grande', estado: 'SP', cep: '11704-890' } };
  assert.deepEqual(validateClubForm(form), {});
  assert.equal(normalizeClubForm(form).endereco.cep, '11704890');
  assert.ok(validateClubForm({ ...form, endereco: { ...form.endereco, estado: 'ZZ' } }).estado);
});

test('escudo aceita imagem preparada ou HTTPS e rejeita conteúdo incompatível', () => {
  const form = { nome: 'Ocian', endereco: null };
  for (const escudo of ['data:image/png;base64,aGVsbG8=', 'https://example.test/ocian.png']) {
    assert.deepEqual(validateClubForm({ ...form, escudo }), {});
  }
  for (const escudo of ['javascript:alert(1)', 'data:image/svg+xml;base64,abcd', 'data:image/png;base64,' + 'a'.repeat(180000)]) {
    assert.ok(validateClubForm({ ...form, escudo }).escudo);
  }
  assert.ok(validateClubForm({ ...form, nome: ' ' }).nome);
});
