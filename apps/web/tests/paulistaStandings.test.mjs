import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { chavesDasEquipes, faixasPublicadas } from '../src/utils/paulistaStandings.ts';

const row = (i, extra = {}) => ({ faseId:'initial', fase:'CLASSIFICAÇÃO', grupo:'CHAVE ÚNICA', equipeId:i, posicao:i, ...extra });
const snapshot = () => ({ jogos:[], classificacao:Array.from({length:24}, (_,i) => row(i+1)) });
const published = () => new Map(Array.from({length:24}, (_,i) => [i+1, i<8?'OURO':i<16?'PRATA':'BRONZE']));

test('faixas correspondem às chaves publicadas e preservam a ordem da fonte', () => {
  const rows=snapshot().classificacao, before=structuredClone(rows);
  assert.deepEqual(faixasPublicadas(rows, published()), [
    {chave:'OURO',inicio:1,fim:8},{chave:'PRATA',inicio:9,fim:16},{chave:'BRONZE',inicio:17,fim:24},
  ]);
  assert.deepEqual(rows,before);
});
test('não presume cortes de oito nem atribui ouro sem chave publicada', () => {
  const rows=snapshot().classificacao, keys=new Map([[1,'OURO'],[2,'PRATA']]);
  assert.deepEqual(faixasPublicadas(rows,keys),[
    {chave:'OURO',inicio:1,fim:1},{chave:'PRATA',inicio:2,fim:2},{chave:null,inicio:3,fim:24},
  ]);
  assert.deepEqual(faixasPublicadas(rows,new Map()),[]);
});
test('não apresenta faixas posicionais em grupos independentes, fases eliminatórias ou tabela parcial', () => {
  const rows=snapshot().classificacao;
  for(const altered of [rows.map(r=>({...r,grupo:'C'})), rows.map(r=>({...r,fase:'QUARTAS PRATA'})), rows.slice(8), rows.map(r=>({...r,posicao:1})), rows.map((r,i)=>({...r,faseId:i?'initial':'other'}))]) {
    assert.deepEqual(faixasPublicadas(altered,published()),[]);
  }
});
test('chaves intercaladas, desconhecidas no meio ou fora de ordem não viram faixas enganosas', () => {
  for(const replacement of ['OURO','BRONZE',null]) {
    const keys=published();if(replacement)keys.set(12,replacement);else keys.delete(12);
    assert.deepEqual(faixasPublicadas(snapshot().classificacao,keys),[]);
  }
});
test('Torneio União e registros contraditórios nunca determinam a chave', () => {
  const s=snapshot();s.jogos=[
    {mandanteId:1,visitanteId:2,fase:'QUARTAS OURO'},
    {mandanteId:1,visitanteId:3,fase:'SEMIFINAL PRATA'},
    {mandanteId:4,visitanteId:5,fase:'TORNEIO UNIÃO BRONZE'},
  ];
  assert.deepEqual([...chavesDasEquipes(s)],[[2,'OURO'],[3,'PRATA']]);
});
test('tabela eliminatória e jogos publicados corroboram a mesma chave', () => {
  const s=snapshot();s.jogos=[{mandanteId:1,visitanteId:2,fase:'QUARTAS PRATA'}];
  s.classificacao.push(row(1,{fase:'SEMIFINAL PRATA'}));
  assert.equal(chavesDasEquipes(s).get(1),'PRATA');
});

// Real snapshots remain optional; the synthetic checks above are self-contained.
for(const id of [900,901,908,907,925]) {
  const path=new URL(`../../../test-results/paulista-source-audit/evento-${id}.json`,import.meta.url);
  test(`publicação capturada do evento ${id}`,{skip:!fs.existsSync(path)},()=>{
    const s=JSON.parse(fs.readFileSync(path)), keys=chavesDasEquipes(s);
    const first=s.classificacao.find(r=>/CLASSIFICA/i.test(r.fase));
    const rows=s.classificacao.filter(r=>r.faseId===first.faseId&&r.grupo===first.grupo).sort((a,b)=>a.posicao-b.posicao);
    const bands=faixasPublicadas(rows,keys);
    if(id===925)assert.deepEqual(bands,[],'A3 mantém os grupos independentes');
    else {
      assert.deepEqual(bands.slice(0,2),[{chave:'OURO',inicio:1,fim:8},{chave:'PRATA',inicio:9,fim:16}]);
      assert.equal(bands[2].chave,id===907?null:'BRONZE','Base A1 não inventa Bronze');
    }
  });
}
