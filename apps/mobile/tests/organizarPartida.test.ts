import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dataPartidaISO } from '../src/utils/validarPartida';
import {
  dataPartidaTexto,
  diasCalendarioPartida,
  errosOrganizarPartida,
  gruposCategoriasPartida,
  confrontoNaCategoria,
  prepararRevisaoPartida,
  identidadeTimePartida,
  mascaraDataPartida,
  mascaraHorarioPartida,
  normalizarBuscaPartida,
  rascunhoPartidaAlterado,
  type CamposPartida,
  type CategoriaPartida,
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

test('seletor agrupa somente categorias recebidas e ordena subs numericamente', () => {
  const categorias: CategoriaPartida[] = [
    { id: 18, nome: 'sub-18', tipo: 'BASE' },
    { id: 10, nome: 'sub-10', tipo: 'INICIACAO' },
    { id: 7, nome: 'sub-7', tipo: 'INICIACAO' },
    { id: 15, nome: 'sub-15', tipo: 'BASE' },
  ];
  const grupos = gruposCategoriasPartida(categorias);
  assert.deepEqual(grupos.map((grupo) => grupo.titulo), ['Iniciação', 'Base']);
  assert.deepEqual(grupos[0].categorias.map((categoria) => categoria.id), [7, 10]);
  assert.deepEqual(grupos[1].categorias.map((categoria) => categoria.id), [15, 18]);
  assert.equal(categorias[0].id, 18);
  assert.deepEqual(gruposCategoriasPartida([]), []);
  assert.deepEqual(
    gruposCategoriasPartida([categorias[0]]).map((grupo) => grupo.tipo),
    ['BASE']
  );
});

test('troca de categoria remove apenas times incompatíveis com a nova seleção', () => {
  const { mandante, visitante } = camposValidos();
  assert.deepEqual(confrontoNaCategoria(9, mandante, visitante), {
    mandante,
    visitante,
  });
  assert.deepEqual(confrontoNaCategoria(10, mandante, visitante), {
    mandante: null,
    visitante: null,
  });
  const outroTime = { ...visitante!, categoria_id: 10 };
  assert.deepEqual(confrontoNaCategoria(10, mandante, outroTime), {
    mandante: null,
    visitante: outroTime,
  });
  assert.deepEqual(confrontoNaCategoria(10, null, null), {
    mandante: null,
    visitante: null,
  });
});

test('seleção e cards usam o escudo do clube representado quando existe vínculo', () => {
  const time = {
    ...camposValidos().mandante!,
    escudo: null,
    clubeRepresentado: { nome: 'Ocian', escudo: ' https://exemplo.com/ocian.png ' },
  };
  const exibido = identidadeTimePartida(time);
  assert.equal(exibido.escudo, 'https://exemplo.com/ocian.png');
  assert.equal(exibido.nome, 'Ocian');
  assert.equal(exibido.id, time.id);
  assert.equal(exibido.categoria_id, time.categoria_id);
  assert.equal(time.escudo, null);
  assert.equal(
    identidadeTimePartida({ ...time, escudo: 'https://exemplo.com/antigo.png' }).escudo,
    'https://exemplo.com/ocian.png'
  );
});

test('escudo próprio é mantido sem vínculo e clube sem escudo permite inicial', () => {
  const time = { ...camposValidos().visitante!, escudo: 'https://exemplo.com/time.png' };
  assert.equal(identidadeTimePartida(time).escudo, time.escudo);
  assert.equal(identidadeTimePartida({ ...time, escudo: null }).escudo, null);
  assert.equal(identidadeTimePartida({
    ...time,
    clubeRepresentado: { nome: 'Clube sem escudo', escudo: null },
  }).escudo, null);
  assert.equal(identidadeTimePartida({
    ...time,
    clubeRepresentado: { nome: 'Clube sem escudo', escudo: '  ' },
  }).escudo, null);
});

test('revisão recusa formulário incompleto, clube ausente ou categoria divergente', () => {
  const categoria: CategoriaPartida = { id: 9, nome: 'sub-7', tipo: 'INICIACAO' };
  const clube = { id: 2, nome: 'Ocian' };
  assert.equal(prepararRevisaoPartida(camposValidos(), null, categoria), null);
  assert.equal(prepararRevisaoPartida(camposValidos(), clube, undefined), null);
  assert.equal(
    prepararRevisaoPartida(camposValidos(), clube, { ...categoria, id: 10 }),
    null
  );
  for (const alteracao of [
    { visitante: null },
    { competicao: undefined },
    { horario: '25:00' },
    { data: '31/02/2027' },
  ]) {
    assert.equal(
      prepararRevisaoPartida({ ...camposValidos(), ...alteracao }, clube, categoria),
      null
    );
  }
});

test('revisão captura a categoria, clube e dados exatos que serão enviados', () => {
  const campos = camposValidos();
  const categoria: CategoriaPartida = { id: 9, nome: 'sub-7', tipo: 'INICIACAO' };
  const clube = { id: 2, nome: 'Ocian' };
  const revisao = prepararRevisaoPartida(campos, clube, categoria)!;
  assert.equal(revisao.clubeId, 2);
  assert.equal(revisao.clubeNome, 'Ocian');
  assert.equal(revisao.categoria.nome, 'sub-7');
  assert.equal(revisao.mandante, campos.mandante!.nome);
  assert.equal(revisao.visitante, campos.visitante!.nome);
  assert.equal(revisao.competicao, 'Amistoso');
  assert.equal(revisao.dataTexto, '31/12/2027');
  assert.deepEqual(revisao.dados, {
    mandante_id: 1,
    visitante_id: 2,
    categoria_id: 9,
    competicao_id: undefined,
    data: '2027-12-31',
    horario: '19:30',
    local: 'Local não definido',
    emCasa: true,
  });
  campos.horario = '20:00';
  categoria.nome = 'Outro sub';
  clube.id = 3;
  assert.equal(revisao.dados.horario, '19:30');
  assert.equal(revisao.categoria.nome, 'sub-7');
  assert.equal(revisao.clubeId, 2);

  const comCompeticao = prepararRevisaoPartida({
    ...camposValidos(),
    competicao: { id: 5, nome: 'Copa', ano: 2027 },
    local: '  Ginásio Municipal  ',
    emCasa: false,
  }, { id: 2, nome: 'Ocian' }, categoria)!;
  assert.equal(comCompeticao.competicao, 'Copa · 2027');
  assert.equal(comCompeticao.dados.competicao_id, 5);
  assert.equal(comCompeticao.dados.local, 'Ginásio Municipal');
  assert.equal(comCompeticao.dados.emCasa, false);
});
