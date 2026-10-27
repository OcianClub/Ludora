import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'node:net';
import { prisma } from '../src/lib/prisma';
import { JWT_SECRET, JWT_OPTIONS } from '../src/config/env';
import { criarPartidaRoutes } from '../src/modules/partidas/partida.routes';
import jogadores from '../src/modules/jogadores/jogador.routes';
import locais, { googleSuggestions } from '../src/modules/partidas/locais.routes';
import perfis from '../src/modules/jogadores/perfil.routes';
import clubes from '../src/modules/clubes/perfil-clube.routes';
import { fotoValida } from '../src/utils/foto';

test('Google Places usa contrato oficial sem repassar chave ao cliente', async () => {
  let request: RequestInit | undefined;
  const items = await googleSuggestions('Harbor sports','test-secret',async (url,init)=>{
    assert.equal(url,'https://places.googleapis.com/v1/places:autocomplete');request=init;
    return new Response(JSON.stringify({suggestions:[{placePrediction:{placeId:'abc',text:{text:'Harbor Sports, Santos'}}},{queryPrediction:{text:'ignored'}}]}));
  });
  assert.equal((request!.headers as Record<string,string>)['X-Goog-Api-Key'],'test-secret');
  assert.deepEqual(JSON.parse(String(request!.body)),{input:'Harbor sports',includedRegionCodes:['br'],languageCode:'pt-BR'});
  assert.deepEqual(items,[{id:'abc',label:'Harbor Sports, Santos',source:'google'}]);
  await assert.rejects(()=>googleSuggestions('Harbor','secret',async()=>new Response('',{status:429})),/indisponível/);
});

test('HTTP: mando, paginação e sugestões com autenticação real e persistência isolada', async t => {
  const originalKey = process.env.GOOGLE_PLACES_API_KEY;
  delete process.env.GOOGLE_PLACES_API_KEY;
  t.after(()=>{if(originalKey===undefined)delete process.env.GOOGLE_PLACES_API_KEY;else process.env.GOOGLE_PLACES_API_KEY=originalKey;});
  let role='ADMIN', external=false;
  const writes:any[]=[];const reads:any[]=[];
  function replace(target:any,key:string,value:any) {const old=target[key];target[key]=value;t.after(()=>target[key]=old);}
  replace(prisma.usuario,'findUnique',async()=>({versao_sessao:0}));
  replace(prisma.clube,'findUnique',async()=>({id:2}));
  replace(prisma.clube,'findMany',async()=>[{id:3,nome:'Wolves',endereco:{logradouro:'Harbor Road',numero:'7',cidade:'Santos',estado:'SP',cep:'11000000'}},{id:2,nome:'Harbor',endereco:{logradouro:'Harbor Avenue',numero:'8',cidade:'Praia Grande',estado:'SP',cep:'11700000'}}]);
  replace(prisma.clube,'update',async(args:any)=>({id:2,...args.data}));
  replace(prisma.usuarioClube,'findUnique',async()=>({id:1,papel:role,acesso_todas_categorias:role==='ADMIN',categorias:[{categoria_id:9}]}));
  replace(prisma.usuarioClube,'findMany',async()=>[]); // no notification or push is sent
  replace(prisma.categoria,'findUnique',async()=>({id:9,clube_id:2,tipo:'BASE'}));
  replace(prisma.categoria,'count',async()=>1);
  replace(prisma.time,'findMany',async(args:any)=>[{id:1,clube_representado_id:external?4:2},{id:2,clube_representado_id:3}].filter(team=>args.where.id.in.includes(team.id)));
  replace(prisma.partida,'findFirst',async()=>null);
  replace(prisma.partida,'findUnique',async()=>({id:99,mandante_id:1,visitante_id:2,categoria_id:9,categoria:{clube_id:2}}));
  replace(prisma.partida,'create',async(args:any)=>{writes.push(args.data);return {id:99,...args.data,mandante:{nome:'Harbor'},visitante:{nome:'Wolves'}};});
  replace(prisma.partida,'update',async(args:any)=>{writes.push(args.data);return {id:99,...args.data};});
  replace(prisma.partida,'findMany',async(args:any)=>{reads.push(args);return args.select.id?[{id:99,data:new Date(),mandante:{nome:'Harbor'},visitante:{nome:'Wolves'},status:'FINALIZADA'}]:[{local:'Harbor Court'}];});
  replace(prisma.partida,'count',async()=>5);
  replace(prisma.competicao,'count',async()=>2);
  replace(prisma.competicao,'findMany',async()=>[{id:1,nome:'Harbor Cup',ano:2026,tipo:'BASE'}]);
  replace(prisma.jogador,'findFirst',async(args:any)=>args.where.id===404?null:{id:7,nome:'James Walker',foto:null,dtNasc:new Date('2014-10-28'),posicao:'Fixo',categoria_id:9,categoria:{id:9,nome:'sub-12',tipo:'BASE'}});
  replace(prisma.jogador,'findUnique',async()=>({cpf:'12345678901'}));
  replace(prisma,'$transaction',async(args:any)=>Promise.all(args));
  replace(prisma,'$queryRaw',async()=>[{jogador_id:7,total:5n}]);
  replace(prisma.jogador,'findMany',async(args:any)=>{reads.push(args);return [{id:7,nome:'James Walker',categoria_id:9}];});
  replace(prisma.jogador,'groupBy',async(args:any)=>{reads.push(args);return [{categoria_id:9,_count:{_all:12,numCamisa:10}}];});
  const app=express();app.use(express.json());app.use(criarPartidaRoutes({to:()=>({emit:()=>{}})} as any),jogadores,locais,perfis,clubes);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())));
  const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const token=jwt.sign({id:1,versao_sessao:0},JWT_SECRET,JWT_OPTIONS);
  const headers={'Content-Type':'application/json','x-clube-id':'2',Authorization:`Bearer ${token}`};
  const game={categoria_id:9,mandante_id:1,visitante_id:2,data:'2027-03-20',horario:'19:30',emCasa:false};
  const send=(method:string,path:string,body?:unknown)=>fetch(base+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
  await t.test('POST e PATCH calculam mando mesmo com emCasa adulterado',async()=>{
    let response=await send('POST','/partidas',game);assert.equal(response.status,201,await response.text());assert.equal(writes.at(-1).emCasa,true);
    response=await send('PATCH','/partidas/99',{mandante_id:2,visitante_id:1,emCasa:true});assert.equal(response.status,200,await response.text());assert.equal(writes.at(-1).emCasa,false);
  });
  await t.test('dois adversários, mesmo time e visitante não gravam',async()=>{
    const count=writes.length;external=true;
    assert.equal((await send('POST','/partidas',game)).status,400);
    assert.equal((await send('PATCH','/partidas/99',game)).status,400);external=false;
    assert.equal((await send('POST','/partidas',{...game,visitante_id:1})).status,400);
    assert.equal((await send('POST','/partidas',{...game,horario:'24:00'})).status,400);
    assert.equal((await send('PATCH','/partidas/99',{horario:'19:60'})).status,400);
    role='TORCEDOR';assert.equal((await send('POST','/partidas',game)).status,403);role='ADMIN';
    assert.equal(writes.length,count);
  });
  await t.test('resumo não consulta atletas; página preserva clube, filtros e limite',async()=>{
    let response=await send('GET','/jogadores?resumo=true&busca=James');assert.equal(response.status,200);assert.deepEqual(await response.json(),[{categoria_id:9,total:12,semCamisa:2}]);
    assert.deepEqual(reads.at(-1).where.categoria,{clube_id:2});assert.equal(reads.at(-1).where.nome.contains,'James');
    response=await send('GET','/jogadores?categoria_id=9&limite=5&offset=5&ordem=desc&posicao=Alas&camisa=missing');assert.equal(response.status,200);
    const args=reads.at(-1);assert.equal(args.take,5);assert.equal(args.skip,5);assert.equal(args.where.categoria_id,9);assert.equal(args.where.numCamisa,null);assert.equal(args.orderBy[0].nome,'desc');
    assert.equal(args.select.cpf,undefined);
    assert.equal((await send('GET','/jogadores?limite=1000')).status,400);
    assert.equal((await send('GET','/jogadores?limite=5&offset=-1')).status,400);
    role='TECNICO';assert.equal((await send('GET','/jogadores?categoria_id=77&limite=5')).status,403);
    await send('GET','/jogadores?resumo=true');assert.deepEqual(reads.at(-1).where.categoria_id,{in:[9]});role='ADMIN';
    assert.equal((await send('GET','/jogadores')).status,200,'Contrato antigo continua sendo array sem paginação');
  });
  await t.test('locais funcionam sem Google e respeitam acesso',async()=>{
    const response=await send('GET','/locais/sugestoes?q=Harbor');assert.equal(response.status,200);
    const body=await response.json();assert.equal(body.providerEnabled,false);assert.equal(body.items[0].id,'clube:2');assert.equal(body.items[1].id,'clube:3');assert.equal(body.items[2].source,'local');
    assert.deepEqual(reads.at(-1).where.categoria,{clube_id:2});
    role='TECNICO';await send('GET','/locais/sugestoes?q=Harbor');assert.deepEqual(reads.at(-1).where.categoria_id,{in:[9]});
    role='TORCEDOR';assert.equal((await send('GET','/locais/sugestoes?q=Harbor')).status,403);
    assert.equal((await fetch(base+'/locais/sugestoes')).status,401);role='ADMIN';
  });
  await t.test('perfil só envia CPF a admin/técnico autorizado; visitantes não recebem o campo',async()=>{
    for(const current of ['ADMIN','TECNICO','MESARIO','TORCEDOR','OLHEIRO']) {
      role=current;const response=await send('GET','/jogadores/7');assert.equal(response.status,200);const profile=await response.json();
      assert.equal('cpf' in profile,['ADMIN','TECNICO'].includes(current));assert.equal(profile.podeEditar,['ADMIN','TECNICO','MESARIO'].includes(current));
      assert.equal(profile.totalPartidas,5);
    }
    assert.equal((await send('GET','/jogadores/404')).status,404);
    assert.equal((await send('GET','/jogadores/7/partidas?pagina=0')).status,400);
    const response=await send('GET','/jogadores/7/partidas?pagina=2&status=FINALIZADA');assert.equal(response.status,200);assert.equal((await response.json()).pagina,2);
    assert.equal((await send('GET','/jogadores/7/campeonatos?ano=2026')).status,200);role='ADMIN';
  });
  await t.test('sede exige admin, endereço válido e foto não aceita SVG executável',async()=>{
    const body={nome:'Harbor',escudo:null,endereco:{logradouro:'Avenue',numero:'8',complemento:'',bairro:'Center',cidade:'Santos',estado:'SP',cep:'11000000'}};
    role='TECNICO';assert.equal((await send('PATCH','/clube/perfil',body)).status,403);role='ADMIN';
    assert.equal((await send('PATCH','/clube/perfil',{...body,endereco:{...body.endereco,cep:'abc'}})).status,400);
    assert.equal((await send('PATCH','/clube/perfil',body)).status,200);
    assert.equal(fotoValida('data:image/svg+xml;base64,abcd'),false);assert.equal(fotoValida('javascript:alert(1)'),false);
  });
});
