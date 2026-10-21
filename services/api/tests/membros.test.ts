import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validarCargo} from '../src/modules/clubes/membros.rules';
import {perspectivaPartida,escopoPartidas} from '../src/modules/partidas/visibilidade';
test('técnico precisa de categorias, IDs duplicados e cargos desconhecidos são rejeitados',()=>{
  assert.throws(()=>validarCargo({papel:'TECNICO'}));
  assert.throws(()=>validarCargo({papel:'DONO'}));
  assert.throws(()=>validarCargo({papel:'TECNICO',categoria_ids:[1,1]}));
  assert.deepEqual(validarCargo({papel:'TECNICO',categoria_ids:[3]}),{papel:'TECNICO',ids:[3],acessoTotal:false});
});
test('olheiro e visitante nunca ganham escrita por acesso total ou categorias',()=>{
  for(const papel of ['TORCEDOR','OLHEIRO']) assert.deepEqual(validarCargo({papel,categoria_ids:[2],acesso_todas_categorias:true}),{papel,ids:[],acessoTotal:false});
});
test('histórico mantém IDs e inverte mando para o clube visitante; vínculo não concede escrita',()=>{
  const p={id:91,categoria:{clube_id:2},emCasa:true,mandante:{clube_representado_id:2},visitante:{clube_representado_id:3}};
  assert.equal(perspectivaPartida(p,3).emCasa,false);
  assert.equal(perspectivaPartida(p,3).somente_leitura,true);
  assert.equal(perspectivaPartida(p,3).id,91);
  assert.equal(perspectivaPartida(p,2).somente_leitura,false);
  assert.deepEqual(escopoPartidas(3).OR,[{categoria:{clube_id:3}},{mandante:{clube_representado_id:3}},{visitante:{clube_representado_id:3}}]);
});

test('clube vinculado fornece identidade atual sem substituir IDs históricos',()=>{
  const p={id:91,categoria:{clube_id:2},emCasa:true,mandante:{id:20,nome:'Ocian sub-7',clube_representado_id:2},visitante:{id:21,nome:'Santos sub-7',escudo:null as string|null,clube_representado_id:3,clubeRepresentado:{nome:'Santos',escudo:'https://example.test/santos.svg'}}};
  const result=perspectivaPartida(p,3);
  assert.equal(result.visitante.id,21);assert.equal(result.visitante.nome,'Santos');
  assert.equal(result.visitante.escudo,'https://example.test/santos.svg');
  assert.equal(p.visitante.nome,'Santos sub-7');
});
