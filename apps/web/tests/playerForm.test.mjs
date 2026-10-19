import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCpf, digitsOnly, cleanName, birthDate, birthYearLimits } from '../src/utils/playerForm.ts';
test('CPF recebe máscara progressiva e ignora emoji/letras',()=>{
  assert.equal(formatCpf('28838829922'),'288.388.299-22');
  assert.equal(formatCpf('2883'),'288.3');
  assert.equal(formatCpf('288.388.299-22 extra 99 ⚽'),'288.388.299-22');
  assert.equal(digitsOnly('2⚽1e+3'),'213');
});
test('nome preserva acentos e hífen, removendo emoji e controles',()=>{
  assert.equal(cleanName("Éric O’Neil-Santos ⚽\n"),"Éric O’Neil-Santos ");
});
test('nascimento usa limites móveis de 4 a 18 anos e valida fevereiro',()=>{
  assert.deepEqual(birthYearLimits(new Date('2026-10-19T12:00:00Z')),{min:2008,max:2022});
  assert.equal(birthDate('2020','02','29'),'2020-02-29');
  assert.equal(birthDate('2021','02','29'),'');
  assert.equal(birthDate('2020','','29'),'');
});
