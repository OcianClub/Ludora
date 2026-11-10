import assert from 'node:assert/strict';
import { test } from 'node:test';
import { agruparTimes, chaveTime, nomeBaseTime, subDoTime, type Casca } from '../src/modules/admin/clubes-candidatos';
function casca(id:number,nome:string,sub:number|null,origem=1):Casca {
  return {id,nome,escudo:null,categoria:sub===null?null:{nome:`sub-${sub}`,faixaIdade:sub,clube_id:origem,clube:{nome:`Origem ${origem}`}}};
}
test('agrupamento de clube reúne cópias e SUBs de origens diferentes sem alterar os registros',()=>{
  const rows=[casca(5,'Aurora FC sub-7',7),casca(3,'Aurora FC',12,2),casca(8,'AURORA FC sub-12',12,3),casca(9,'Estrela Azul sub-10',10)];
  const antes=JSON.stringify(rows), grupos=agruparTimes(rows);
  assert.equal(grupos.length,2);assert.equal(grupos[0].nome,'Aurora FC');
  assert.deepEqual(grupos[0].subs,[7,12]);assert.equal(grupos[0].registros,3);assert.equal(grupos[0].origens.length,3);
  assert.equal(JSON.stringify(rows),antes);
});
test('normalização conserva identidade A/B, nomes próximos e SUB incompatível com a categoria',()=>{
  assert.equal(nomeBaseTime(casca(1,'Aurora FC sub-7',7)),'Aurora FC');
  assert.equal(nomeBaseTime(casca(1,'Aurora FC sub-7',12)),'Aurora FC sub-7');
  assert.equal(nomeBaseTime(casca(1,'Aurora FC sub-7',null)),'Aurora FC sub-7');
  assert.notEqual(chaveTime(casca(1,'Aurora FC - A',7)),chaveTime(casca(2,'Aurora FC - B',7)));
  assert.equal(agruparTimes([casca(1,'Santo André',7),casca(2,'Santo Andre SUB 12',12)]).length,1);
  assert.equal(agruparTimes([casca(1,'Santo André',7),casca(2,'Associação Santo André',12)]).length,2);
  assert.equal(subDoTime(casca(1,'Livre',null)),null);
});
