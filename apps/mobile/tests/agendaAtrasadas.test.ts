import assert from 'node:assert/strict';
import {test} from 'node:test';
import {statusJogos,parametrosJogos,filtrosJogosAtuais} from '../src/utils/filtrosJogos';
import {secoesAgenda,type PartidaAgendaBase,type GrupoAgenda} from '../src/utils/agendaJogos';

test('filtro de atrasadas mantém valor próprio e ordem/nome conforme permissão',()=>{
  assert.deepEqual(statusJogos(true).map(t=>t.value),['TODOS','AO_VIVO','ATRASADAS','PROXIMAS','FINALIZADA','CANCELADA']);
  assert.deepEqual(statusJogos(false).map(t=>t.value),['TODOS','AO_VIVO','PROXIMAS','FINALIZADA','ATRASADAS','CANCELADA']);
  assert.equal(statusJogos(false).find(t=>t.value==='ATRASADAS')?.label,'Atrasadas');
  assert.equal(parametrosJogos({...filtrosJogosAtuais(),status:'ATRASADAS'}).status,undefined,'Derived filter does not send an invalid stored status to the API');
});
test('seções por situação separam contagens paginadas de próximas e atrasadas',()=>{
  const grupos:GrupoAgenda[]=['agenda','pendentes','finalizadas','canceladas','ao_vivo'];
  const rows:PartidaAgendaBase[]=grupos.map((grupo,i)=>({id:i,data:'2026-01-01',horario:'18:00',status:grupo==='pendentes'?'AGENDADA':'FINALIZADA',categoria:{nome:'SUB-7'},grupo_agenda:grupo,posicao:1,total_grupo:grupo==='pendentes'?9:2}));
  const gestor=secoesAgenda(rows,true,true),publico=secoesAgenda(rows,true,false);
  assert.deepEqual(gestor.map(s=>s.key),['ao_vivo','pendentes','agenda','finalizadas','canceladas']);
  assert.deepEqual(publico.map(s=>s.key),['ao_vivo','agenda','finalizadas','pendentes','canceladas']);
  assert.equal(gestor.find(s=>s.key==='pendentes')?.total,9);
  assert.deepEqual(gestor.find(s=>s.key==='pendentes')?.mais,{grupo:'pendentes',apos:1});
  assert.equal(gestor.find(s=>s.key==='agenda')?.total,2);
});
