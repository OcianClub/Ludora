import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectMatchTeam, matchHasOwnTeam } from '../src/utils/matchTeams.ts';
import { formatTimeInput, validTimeInput } from '../src/utils/timeInput.ts';
import { playerAge } from '../src/utils/playerAge.ts';
test('seleção e inversão preservam o adversário e impedem times externos à categoria', () => {
  const teams=[{id:1,nome:'Harbor',categoria_id:9,clube_representado_id:2},{id:2,nome:'Wolves',categoria_id:9,clube_representado_id:3},{id:3,nome:'Rovers',categoria_id:10,clube_representado_id:null}];
  assert.deepEqual(selectMatchTeam(teams,2,9,'mandante',2,{mandante_id:'',visitante_id:''}),{mandante_id:'2',visitante_id:'1',emCasa:'false'});
  assert.deepEqual(selectMatchTeam(teams,2,9,'mandante',1,{mandante_id:'2',visitante_id:'1'}),{mandante_id:'1',visitante_id:'2',emCasa:'true'});
  assert.throws(()=>selectMatchTeam(teams,2,9,'mandante',3,{mandante_id:'',visitante_id:''}),/categoria/);
  assert.throws(()=>selectMatchTeam(teams,8,9,'mandante',2,{mandante_id:'',visitante_id:''}),/vinculado/);
  assert.equal(matchHasOwnTeam(teams[1],teams[2],2),false);
});
test('horário recebe somente quatro dígitos, máscara e validação de limites',()=>{
  for(const [input,output] of [['1945','19:45'],['0830','08:30'],['0000','00:00'],['2⚽3a5x9','23:59'],['194599','19:45'],['19','19'],['193','19:3']])assert.equal(formatTimeInput(input),output);
  for(const value of ['00:00','08:30','23:59'])assert.equal(validTimeInput(value),true);
  for(const value of ['24:00','19:60','1:30','19:',''])assert.equal(validTimeInput(value),false);
});
test('idade é cronológica e não a idade da temporada esportiva',()=>{
  assert.equal(playerAge('2014-10-28',new Date(2026,9,27)),11);
  assert.equal(playerAge('2014-10-27',new Date(2026,9,27)),12);
});
