const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { prepare } = require('./responsive-audit.cjs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5192';
const catalog = [
 { id:900, ano:2026, categoria:'Sub-7', divisao:'A2' },
 { id:901, ano:2026, categoria:'Sub-8', divisao:'A2' },
 { id:912, ano:2026, categoria:'Sub-12', divisao:'A3' },
 { id:800, ano:2025, categoria:'Sub-7', divisao:'A2' },
];
function panel(event) {
 const jogo={id:'official-'+event.id,faseId:'classificacao',fase:'FASE DE CLASSIFICAÇÃO',sumulaId:null,mandanteId:10,visitanteId:20,data:`${event.ano}-10-03`,horario:'19:30',local:'Ginásio oficial',golsMandante:2,golsVisitante:1,ocorrencia:null};
 return {evento:{id:event.id,versao:4,consultadoEm:'2026-11-08T00:00:00Z',verificadoEm:null,diario:true},
  snapshot:{...event,titulo:'Paulista',fonte:`https://eventos.admfutsal.com.br/evento/${event.id}`,equipes:[{id:10,nome:'OCIAN PRAIA CLUBE',escudo:null},{id:20,nome:'SANTOS FC',escudo:null}],
   jogos:[jogo,{...jogo,id:'future-'+event.id,data:'2027-01-10',golsMandante:null,golsVisitante:null}],
   classificacao:[{faseId:'classificacao',fase:'FASE DE CLASSIFICAÇÃO',grupo:'CHAVE ÚNICA',equipeId:10,posicao:2,pontos:17,jogos:8,vitorias:5,empates:2,derrotas:1,golsPro:20,golsContra:10,saldo:10}],avisos:[],fasesExcluidas:[]},
  vinculos:[{equipeId:10,clubeId:2,nome:'Ocian',escudo:null}],jogosLocais:[],pendencias:[],retroativos:[]};
}
async function choose(page,label,value){await page.getByRole('combobox',{name:new RegExp('^'+label)}).click();await page.getByRole('option',{name:value,exact:true}).click();}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const width of [320,390,820,1440]) for(const role of ['ADMIN','TORCEDOR']){
   const {page,context}=await prepare(browser,width,950,width===820?'light':'dark',{role});
   const errors=[],reads=[],writes=[];let localReads=0,mode='ready';
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/competicoes**',route=>{
    const url=new URL(route.request().url());if(url.origin===base)return route.fallback();
    localReads++;return route.fulfill({json:[{id:1,nome:'Torneio local não deve aparecer'}]});
   });
   await page.route('**/paulista/**',route=>{
    const request=route.request(),url=new URL(request.url());if(url.origin===base)return route.fallback();
    if(request.method()==='OPTIONS')return route.fulfill({status:204});
    if(request.method()!=='GET'){writes.push(url.pathname);return route.abort();}
    reads.push(url.pathname);
    if(url.pathname.endsWith('/status'))return route.fulfill({json:{ativo:mode!=='disabled',bancoPronto:mode!=='disabled'}});
    if(url.pathname.endsWith('/eventos'))return route.fulfill({json:mode==='empty'?[]:catalog});
    const event=catalog.find(event=>url.pathname.endsWith('/'+event.id));
    if(event)return route.fulfill({json:panel(event)});
    return route.abort();
   });
   await page.goto(base+'/competicoes');
   await page.locator('.paulista-participation-position>strong').getByText('2º',{exact:true}).waitFor();
   assert.equal(await page.getByRole('heading',{name:'Campeonato Paulista',exact:true}).count(),1);
   assert.equal(await page.locator('.competition-card,.competition-tabs').count(),0);
   assert.equal(await page.getByRole('button',{name:'Nova competição',exact:true}).count(),0);
   assert.equal(await page.locator('.paulista-back').count(),0,'entrada não volta para a mesma tela');
   assert.equal(localReads,0,'entrada não consulta competições locais');
   await page.getByRole('button',{name:'Opções do campeonato'}).click();
   assert.equal(await page.locator('.paulista-source-link').getAttribute('href'),'https://eventos.admfutsal.com.br/evento/900');
   await page.keyboard.press('Escape');
   await page.getByRole('button',{name:'Classificação',exact:true}).click();
   await page.locator('.paulista-ranking-summary dd').getByText('17',{exact:true}).waitFor();
   assert.match(await page.locator('.paulista-standings .is-own').innerText(),/17/);
   await page.getByRole('button',{name:'Jogos',exact:true}).click();
   await page.locator('.paulista-fixture').first().waitFor();
   assert.equal(await page.locator('.paulista-fixture').count(),2);
   await page.locator('.paulista-fixture').first().getByRole('button').last().click();
   const detail=page.getByRole('dialog',{name:'Detalhes oficiais da partida'});await detail.waitFor();
   await detail.getByRole('button',{name:'Fechar janela'}).click();
   await page.getByRole('button',{name:'Chaveamento',exact:true}).click();
   await page.getByText('A federação ainda não publicou a chave eliminatória',{exact:false}).waitFor();
   await page.getByRole('button',{name:'Visão geral',exact:true}).click();
   await page.getByRole('tab',{name:'SUB-8',exact:true}).click();
   await page.waitForURL(/evento=901/);await page.locator('.paulista-participation-position>strong').waitFor();
   await page.getByRole('tab',{name:'Base',exact:true}).click();await page.waitForURL(/evento=912/);
   await page.getByRole('tab',{name:'Iniciação',exact:true}).click();await page.waitForURL(/evento=900/);
   await choose(page,'Temporada','Temporada 2025');await page.waitForURL(/evento=800/);
   await choose(page,'Temporada','Temporada 2026');await page.waitForURL(/evento=900/);
   await page.locator('.paulista-participation').waitFor();
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const before=reads.filter(p=>p==='/paulista/eventos/900').length;
   const reloaded=page.waitForResponse(r=>new URL(r.url()).pathname==='/paulista/eventos/900'&&r.request().method()==='GET');
   await page.getByRole('button',{name:'Opções do campeonato'}).click();
   await page.getByRole('menuitem',{name:'Atualizar dados',exact:true}).click();
   await reloaded;
   await page.waitForFunction(()=>document.querySelector('.paulista-header').getAttribute('aria-busy')==='false');
   assert.ok(reads.filter(p=>p==='/paulista/eventos/900').length>before);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'sem overflow horizontal');
   await page.screenshot({path:`test-results/federation-home-${width}-${role}.png`,fullPage:true});
   await page.goto(base+'/competicoes/paulista?evento=900&ano=2026&faixa=INICIACAO&aba=classificacao');
   await page.locator('.paulista-standings .is-own').waitFor();
   assert.match(await page.locator('.paulista-ranking-summary').innerText(),/17/,'links antigos conservam os dados e filtros');
   mode='disabled';await page.goto(base+'/competicoes');await page.getByRole('heading',{name:'Campeonato Paulista indisponível'}).waitFor();
   assert.equal(await page.getByText('Suas competições do clube continuam disponíveis.',{exact:true}).count(),0);
   mode='empty';await page.goto(base+'/competicoes');await page.getByRole('heading',{name:'Nenhuma participação confirmada'}).waitFor();
   assert.deepEqual(writes,[],'nenhuma escrita nos dados oficiais');assert.deepEqual(errors,[]);
   console.log(`OK ${width}px/${role}: Paulista direto, abas, filtros, retorno, vazio e indisponível`);
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
