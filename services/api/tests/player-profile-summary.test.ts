import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registrosAtleta, resumirPartidaAtleta } from '../src/modules/jogadores/perfil-resumo';
const game = { id: 1, status: 'FINALIZADA', mandante_id: 10, visitante_id: 20, gols_mandante: 3, gols_visitante: 1,
  emCasa: true, categoria: { clube_id: 2 }, participantes: [{ time_id: 10 }],
  jogadores_escalonados: [{ time_id: 20, titular_inicial: false as boolean | null }], eventos: [] as {tipo:string;gol_contra:boolean;time_id:number|null}[] };
test('resultado acompanha a equipe histórica do atleta, inclusive quando ela é visitante', () => {
  const row = resumirPartidaAtleta(game, 2);
  assert.equal(row.resultado,'DERROTA');assert.equal(row.equipe_id,20);assert.equal(row.titularInicial,false);
  assert.equal(resumirPartidaAtleta({...game,jogadores_escalonados:[{time_id:10,titular_inicial:true}]},2).resultado,'VITORIA');
  assert.equal(resumirPartidaAtleta({...game,gols_visitante:3},2).resultado,'EMPATE');
});
test('ao vivo não recebe resultado final; titularidade desconhecida não vira reserva', () => {
  const row = resumirPartidaAtleta({...game,status:'AO_VIVO',jogadores_escalonados:[{time_id:10,titular_inicial:null}]},2);
  assert.equal(row.resultado,null);assert.equal(row.titularInicial,null);
});
test('gol contra não vira gol individual, e autoria identifica o time de quem o cometeu', () => {
  const row = resumirPartidaAtleta({...game,jogadores_escalonados:[],eventos:[{tipo:'GOL',gol_contra:true,time_id:10}]},2);
  assert.equal(row.equipe_id,20);assert.equal(row.registros.gols,0);assert.equal(row.registros.golsContra,1);assert.equal(row.convocado,false);
});
test('todos os registros individuais são contados sem criar minutos ou titularidades', () => {
  const data = registrosAtleta(['GOL','ASSISTENCIA','DEFESA','FALTA','CARTAO_AMARELO','CARTAO_VERMELHO','CARTAO_AZUL'].map(tipo=>({tipo,gol_contra:false})));
  assert.deepEqual(data,{gols:1,assistencias:1,defesas:1,faltas:1,cartoes:3,golsContra:0});
});
test('legado usa o mando apenas no clube de origem; time desconhecido não ganha resultado inventado', () => {
  const legacy = {...game,jogadores_escalonados:[],participantes:[]};
  assert.equal(resumirPartidaAtleta({...legacy,emCasa:false},2).equipe_id,20);
  assert.equal(resumirPartidaAtleta(legacy,99).resultado,null);
});
