import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  filtrosJogosAtuais,
  mesmosFiltrosJogos,
  parametrosJogos,
  periodoJogos,
} from '../src/utils/filtrosJogos';

test('filtro inicial usa mês e ano locais, com todos os status', () => {
  assert.deepEqual(filtrosJogosAtuais(new Date(2027, 0, 1, 0, 15)), {
    mes: 1,
    ano: 2027,
    status: 'TODOS',
  });
});

test('barra distingue o mesmo mês em anos diferentes e informa ano inteiro', () => {
  assert.equal(
    periodoJogos({ mes: 10, ano: 2025, status: 'TODOS' }),
    'Outubro de 2025'
  );
  assert.equal(
    periodoJogos({ mes: null, ano: 2024, status: 'TODOS' }),
    'Ano de 2024'
  );
});

test('requisição envia ano explícito e omite mês quando a opção é ano inteiro', () => {
  assert.deepEqual(parametrosJogos({ mes: null, ano: 2025, status: 'TODOS' }), {
    ano: 2025,
    mes: undefined,
    status: undefined,
    resumo: true,
  });
  assert.deepEqual(
    parametrosJogos({ mes: 2, ano: 2024, status: 'FINALIZADA' }),
    {
      ano: 2024,
      mes: 2,
      status: 'FINALIZADA',
      resumo: true,
    }
  );
});

test('somente alterações de mês, ano ou status exigem nova consulta', () => {
  const inicial = filtrosJogosAtuais(new Date(2026, 9, 21));
  assert.equal(mesmosFiltrosJogos(inicial, { ...inicial }), true);
  assert.equal(mesmosFiltrosJogos(inicial, { ...inicial, ano: 2025 }), false);
  assert.equal(mesmosFiltrosJogos(inicial, { ...inicial, mes: null }), false);
  assert.equal(
    mesmosFiltrosJogos(inicial, { ...inicial, status: 'AO_VIVO' }),
    false
  );
});
