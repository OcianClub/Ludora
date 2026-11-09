import assert from 'node:assert/strict';
import { test } from 'node:test';
import { campanhaPublicada, classificacaoProxima, nomeGrupo } from '../src/utils/paulistaOverview.ts';
const partida = (id, fase, home, away, a, b, date) => ({id,fase,faseId:fase,mandanteId:home,visitanteId:away,golsMandante:a,golsVisitante:b,data:date,horario:'19:00',local:null,ocorrencia:null,sumulaId:null});
const base = () => ({id:1,ano:2026,titulo:'Paulista',categoria:'Sub-7',divisao:'A2',fonte:'',equipes:[],jogos:[],classificacao:[],avisos:[],fasesExcluidas:[]});
test('derrota isolada, empate e W.O. não confirmam eliminação',()=>{
 for(const ocorrencia of [null,'WO']) {
  const s=base();s.jogos=[{...partida('q','Quartas PRATA',1,2,0,2,'2026-09-01'),ocorrencia}];
  const c=campanhaPublicada(s,new Set([1]),'PRATA');
  assert.equal(c.eliminado,false);assert.equal(c.etapas.find(e=>e.etapa===2).estado,'pending');
 }
});
test('avanço e eliminação seguem a fase seguinte publicada; futuras são não alcançadas',()=>{
 const s=base();s.jogos=[partida('q','Quartas PRATA',1,2,3,0,'2026-09-01'),partida('s','Semifinal PRATA',1,3,1,2,'2026-09-10'),partida('f','Final PRATA',3,4,2,0,'2026-09-20')];
 const c=campanhaPublicada(s,new Set([1]),'PRATA');
 assert.equal(c.titulo,'Eliminado na semifinal');assert.equal(c.estados.get('q'),'advanced');assert.equal(c.estados.get('s'),'ended');
 assert.equal(c.etapas.find(e=>e.etapa===3).estado,'unreached');
 assert.equal(c.etapas.some(e=>e.etapa===0),false,'não inventa oitavas');
});
test('tabela resumida respeita fase/grupo, extremos e ordem oficial sem recalcular pontos',()=>{
 const s=base();s.classificacao=Array.from({length:24},(_,i)=>({faseId:'initial',fase:'CLASSIFICAÇÃO',grupo:'A',equipeId:i+1,posicao:i+1,pontos:24-i,saldo:0}));
 s.classificacao.push({...s.classificacao[0],faseId:'other',equipeId:99});
 for(const i of [0,11,23]) { const c=classificacaoProxima(s,s.classificacao[i]);assert.equal(c.total,24);assert.equal(c.linhas.length,5);assert.ok(c.linhas.includes(s.classificacao[i]));assert.ok(c.linhas.every(r=>r.equipeId!==99)); }
 const partial={...s,classificacao:s.classificacao.slice(20,24)};assert.equal(classificacaoProxima(partial,partial.classificacao[0]).total,undefined,'não chama publicação parcial de total de equipes');
 assert.equal(nomeGrupo('CHAVE UNICA'),'Chave Única');
 assert.equal(nomeGrupo('GRUPO UNICO'),'Grupo Único');
});
