import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  identidadeClubeHeader,
  inicialHeader,
  NOMES_PAPEIS_HEADER,
} from '../src/utils/identidadeHeader';

test('identidade preserva nome completo e papel do clube, sem trocar pelo nome da aba', () => {
  const nome = 'Associação Esportiva de Futebol e Futsal Ludora';
  assert.deepEqual(
    identidadeClubeHeader({
      nome,
      escudo: 'https://exemplo.com/escudo.png',
      papel: 'TECNICO',
    }),
    {
      nome,
      escudo: 'https://exemplo.com/escudo.png',
      papel: 'TECNICO',
    }
  );
  assert.equal(NOMES_PAPEIS_HEADER.TECNICO, 'Técnico');
});

test('clube sem escudo tem inicial própria e não assume papel de gestor', () => {
  const identidade = identidadeClubeHeader({
    nome: '  Águias FC  ',
    escudo: ' ',
    papel: null,
  });
  assert.equal(identidade.nome, 'Águias FC');
  assert.equal(identidade.escudo, null);
  assert.equal(identidade.papel, undefined);
  assert.equal(inicialHeader(identidade.nome), 'Á');
  assert.equal(inicialHeader('jefferson'), 'J');
});

test('sem clube carregado usa identificação neutra e não reutiliza identidade anterior', () => {
  assert.deepEqual(identidadeClubeHeader(null), {
    nome: 'Meu clube',
    escudo: null,
    papel: undefined,
  });
  assert.equal(inicialHeader('  '), 'L');
});
