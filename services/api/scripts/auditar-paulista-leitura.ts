import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { baixarEvento, lerFonte } from '../src/modules/paulista/provider';
import { resumoClube } from '../../../apps/web/src/utils/paulistaView';
import { campanhaPublicada } from '../../../apps/web/src/utils/paulistaOverview';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { SnapshotPaulista } from '../../../packages/shared-types/src/paulista';
import { load } from 'cheerio';
const db = new PrismaClient({log:[]});
const folder=resolve('../../test-results/paulista-source-audit');
async function main(){
 await mkdir(folder,{recursive:true});
 if (process.argv.includes('--reconferir-tabelas')) return reconferirTabelas();
 const stored=await db.fpfsEvento.findMany({select:{id:true,payload:true,consultadoEm:true}});
 const links=await db.fpfsVinculo.findMany({select:{equipeId:true,clubeId:true,clube:{select:{nome:true}}}});
 await writeFile(resolve(folder,'stored.json'),JSON.stringify({stored,links},null,2));
 console.log('Leitura do banco:',stored.length,'eventos;',links.length,'identidades confirmadas.');
 const ids=[896,897,898,899,900,901,902,903,904,905,906,907,908,909,910,911,918,919,920,921,922,923,924,925];
 const results:any[]=[];let next=0;
 await Promise.all([0,1].map(async()=>{while(next<ids.length){const id=ids[next++];try{
  const fresh=await baixarEvento(id);await writeFile(resolve(folder,`evento-${id}.json`),JSON.stringify(fresh,null,2));
  const old=stored.find(e=>e.id===id)?.payload as unknown as SnapshotPaulista|undefined;
  const own=links.filter(l=>fresh.equipes.some(e=>e.id===l.equipeId));
  const clubs=own.map(l=>{const ids=new Set([l.equipeId]);const s=resumoClube(fresh,ids,'2026-11-09');const c=campanhaPublicada(fresh,ids,s.chaves[0]);return {clube:l.clube.nome,equipeId:l.equipeId,nomeOficial:fresh.equipes.find(e=>e.id===l.equipeId)?.nome,chaves:s.chaves,posicao:s.classificacao?.posicao,situacao:c.titulo,ultimos:s.jogos.slice(-3).map(j=>({id:j.id,fase:j.fase,placar:[j.golsMandante,j.golsVisitante]}))}});
  const row={id,categoria:fresh.categoria,divisao:fresh.divisao,jogos:fresh.jogos.length,tabelas:fresh.classificacao.length,clubes:clubs,stored:!!old,iguais:old?{meta:old.id===fresh.id&&old.ano===fresh.ano&&old.categoria===fresh.categoria&&old.divisao===fresh.divisao&&old.fonte===fresh.fonte,jogos:isDeepStrictEqual(old.jogos,fresh.jogos),classificacao:isDeepStrictEqual(old.classificacao,fresh.classificacao),equipes:isDeepStrictEqual(old.equipes,fresh.equipes)}:null};results.push(row);console.log(JSON.stringify(row));
 }catch(e){const row={id,error:e instanceof Error?e.message:'Falha de leitura'};results.push(row);console.log(JSON.stringify(row));}}}));
 await writeFile(resolve(folder,'report.json'),JSON.stringify({checkedAt:new Date().toISOString(),readOnly:true,results},null,2));
}main().catch(()=>{console.error('Não foi possível completar a leitura do banco/fonte. Nenhuma alteração realizada.');process.exitCode=1}).finally(()=>db.$disconnect());

async function reconferirTabelas() {
 const report=JSON.parse(await readFile(resolve(folder,'report.json'),'utf8'));
 const results=[];
 for(const event of report.results.filter((r:any)=>r.iguais && !r.iguais.classificacao)) {
  const previous=JSON.parse(await readFile(resolve(folder,`evento-${event.id}.json`),'utf8')) as SnapshotPaulista;
  const html=await lerFonte(`/evento/${event.id}`);
  await writeFile(resolve(folder,`ranking-${event.id}.html`),html);
  const $=load(html), changes:any[]=[];
  // Independent DOM read: source position and every numeric column, before any sorting.
  $('[role="tabpanel"][id^="pills-fase-"]').each((_i,pane)=>{
   const phase=$(pane).attr('id')!.replace('pills-fase-','');
   if(!/^\d+$/.test(phase))return;
   $(pane).find('tbody tr').each((_j,row)=>{
    const td=$(row).children('td');
    const team=Number($(row).find('img.escudo').attr('src')?.match(/\/escudo\/(\d+)\./)?.[1]);
    const group=td.eq(0).text().replace(/\s+/g,' ').trim();
    const old=previous.classificacao.find(r=>r.faseId===phase&&r.equipeId===team&&r.grupo===group);
    if(!old)return;
    const position=parseInt(td.eq(1).text(),10);
    const values=Array.from({length:8},(_,k)=>Number(td.eq(k+3).text().trim().replace(/\*$/,'')));
    const stats=[old.pontos,old.jogos,old.vitorias,old.empates,old.derrotas,old.golsPro,old.golsContra,old.saldo];
    if(position!==old.posicao||!isDeepStrictEqual(values,stats))changes.push({fase:old.fase,grupo:group,equipeId:team,posicaoAnterior:old.posicao,posicaoNova:position,estatisticasIguais:isDeepStrictEqual(values,stats)});
   });
  });
  const result={id:event.id,changes};results.push(result);console.log(JSON.stringify(result));
 }
 await writeFile(resolve(folder,'ranking-recheck.json'),JSON.stringify({checkedAt:new Date().toISOString(),readOnly:true,results},null,2));
}
