import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dataPartidaISO } from '../src/utils/validarPartida';
import {
  dataPartidaTexto,
  diasCalendarioPartida,
  errosOrganizarPartida,
  mascaraDataPartida,
  mascaraHorarioPartida,
  normalizarBuscaPartida,
  rascunhoPartidaAlterado,
  type CamposPartida,
} from '../src/utils/organizarPartida';

const camposValidos = (): CamposPartida => ({
  categoriaId: 9,
  competicao: null,
  mandante: { id: 1, nome: 'Ludora', escudo: null, categoria_id: 9 },
  visitante: { id: 2, nome: 'Adversário', escudo: null, categoria_id: 9 },
  data: '31/12/2027',
  horario: '19:30',
  local: '',
  emCasa: true,
});

test('criação usa o ano explícito sem quebrar a data curta da edição existente', () => {
  assert.equal(dataPartidaISO('31/12/2027', 2026), '2027-12-31');
  assert.equal(dataPartidaISO('31/12', 2026), '2026-12-31');
  assert.equal(dataPartidaISO('29/02/2024'), '2024-02-29');
  for (const data of [
    '29/02/2027',
    '31/04/2027',
    '01/13/2027',
    '01/01/0000',
    '01/01/9999',
  ])
    assert.equal(dataPartidaISO(data), null);
});

test('máscaras aceitam digitação e colagem sem ultrapassar data e horário', () => {
  assert.equal(mascaraDataPartida('3'), '3');
  assert.equal(mascaraDataPartida('311'), '31/1');
  assert.equal(mascaraDataPartida('31122027'), '31/12/2027');
  assert.equal(mascaraDataPartida('31/12/2027123'), '31/12/2027');
  assert.equal(mascaraHorarioPartida('1930'), '19:30');
  assert.equal(mascaraHorarioPartida('19:30123'), '19:30');
});

test('competição exige escolha explícita, mas amistoso não precisa de ID', () => {
  assert.deepEqual(errosOrganizarPartida(camposValidos()), {});
  assert.match(
    errosOrganizarPartida({ ...camposValidos(), competicao: undefined })
      .competicao!,
    /amistoso/
  );
  assert.deepEqual(
    errosOrganizarPartida({
      ...camposValidos(),
      competicao: { id: 3, nome: 'Copa', ano: 2027 },
    }),
    {}
  );
});

test('formulário aponta erros por campo e não permite confronto de categoria diferente', () => {
  const valido = camposValidos();
  const erros = errosOrganizarPartida({
    ...valido,
    categoriaId: null,
    mandante: null,
    data: '31/02/2027',
    horario: '24:00',
  });
  assert.ok(erros.categoria && erros.confronto && erros.data && erros.horario);
  assert.match(
    errosOrganizarPartida({ ...valido, visitante: valido.mandante }).confronto!,
    /diferentes/
  );
  assert.match(
    errosOrganizarPartida({
      ...valido,
      visitante: { ...valido.visitante!, categoria_id: 10 },
    }).confronto!,
    /categoria/
  );
  assert.ok(errosOrganizarPartida({ ...valido, data: '31/12' }).data);
});

test('local é opcional e aceita endereço dentro do limite', () => {
  assert.deepEqual(
    errosOrganizarPartida({ ...camposValidos(), local: '  ' }),
    {}
  );
  assert.deepEqual(
    errosOrganizarPartida({
      ...camposValidos(),
      local: 'Ginásio Municipal, Rua A, 10',
    }),
    {}
  );
  assert.ok(
    errosOrganizarPartida({ ...camposValidos(), local: 'a'.repeat(161) }).local
  );
});

test('calendário inclui todos os dias, respeita início da semana e fevereiro bissexto', () => {
  const fevereiro = diasCalendarioPartida(2024, 1);
  assert.equal(fevereiro.filter((dia) => dia !== null).length, 29);
  assert.equal(
    fevereiro.findIndex((dia) => dia === 1),
    4
  );
  assert.equal(fevereiro.length % 7, 0);
  assert.equal(
    diasCalendarioPartida(2027, 1).filter((dia) => dia !== null).length,
    28
  );
  assert.equal(dataPartidaTexto(new Date(2027, 0, 1)), '01/01/2027');
});

test('confirmação de saída ignora categoria inicial e detecta alterações reais', () => {
  const inicial: CamposPartida = {
    categoriaId: 9,
    competicao: undefined,
    mandante: null,
    visitante: null,
    data: '',
    horario: '',
    local: '',
    emCasa: true,
  };
  assert.equal(rascunhoPartidaAlterado(inicial, 9), false);
  for (const alteracao of [
    { local: 'Ginásio' },
    { data: '21/10/2026' },
    { competicao: null },
    { categoriaId: 10 },
    { emCasa: false },
  ]) {
    assert.equal(
      rascunhoPartidaAlterado({ ...inicial, ...alteracao }, 9),
      true
    );
  }
});

test('busca de time ou competição ignora acentos, caixa e espaços externos', () => {
  assert.equal(normalizarBuscaPartida('  São PAULO  '), 'sao paulo');
  assert.ok(
    normalizarBuscaPartida('Copa Iniciação 2027').includes(
      normalizarBuscaPartida('iniciacao')
    )
  );
});
