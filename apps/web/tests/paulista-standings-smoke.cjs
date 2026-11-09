// Browser-only verification using saved source publications. No server writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { prepare } = require('./responsive-audit.cjs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5192';
const folder = path.resolve(__dirname,'../../../test-results/paulista-source-audit');
const { links } = JSON.parse(fs.readFileSync(path.join(folder,'stored.json')));
const ids=[900,901,907,925];
const data=new Map(ids.map(id=>[id,JSON.parse(fs.readFileSync(path.join(folder,`evento-${id}.json`)))]));

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const width of (process.env.PAULISTA_STANDINGS_WIDTHS || '320,390,600,820,1024,1280,1440,1920').split(',').map(Number)) for(const role of ['ADMIN','TORCEDOR']) {
   const {page,context}=await prepare(browser,width,950,process.env.PAULISTA_STANDINGS_THEME || 'dark',{role,clubeNome:'Ocian'});
   const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/paulista/**',async route=>{
    const r=route.request(),url=new URL(r.url());if(url.origin===base)return route.fallback();
    if(r.method()==='OPTIONS')return route.fulfill({status:204});
    if(r.method()!=='GET'){writes.push(url.pathname);return route.abort();}
    if(url.pathname.endsWith('/status'))return route.fulfill({json:{ativo:true,bancoPronto:true}});
    if(url.pathname.endsWith('/eventos'))return route.fulfill({json:ids.map(id=>{const s=data.get(id);return {id,ano:s.ano,categoria:s.categoria,divisao:s.divisao};})});
    const id=Number(url.pathname.split('/').pop()),s=data.get(id);
    return route.fulfill({json:{evento:{id,versao:1,consultadoEm:'2026-11-09T00:00:00Z'},snapshot:s,
     vinculos:links.filter(l=>s.equipes.some(e=>e.id===l.equipeId)).map(l=>({equipeId:l.equipeId,clubeId:l.clube.nome==='Ocian'?2:100+l.clubeId,nome:l.clube.nome,escudo:null})),
     jogosLocais:[],pendencias:[],retroativos:[]}});
   });
   try {
    await page.goto(base+'/competicoes?evento=901',{waitUntil:'domcontentloaded'});
    await page.locator('.paulista-participation').waitFor();
    await page.getByRole('button',{name:'Classificação',exact:true}).click();
    const table=page.locator('.paulista-table-scroll'), teams=table.locator('tbody tr[data-team-id]');
    const source=data.get(901).classificacao.filter(r=>/CLASSIFICA/i.test(r.fase)).sort((a,b)=>a.posicao-b.posicao);
    assert.deepEqual(await teams.evaluateAll(es=>es.map(e=>Number(e.dataset.teamId))),source.map(r=>r.equipeId),'official order preserved');
    assert.equal(await table.locator('.paulista-ranking-band').count(),3);
    assert.match(await table.locator('.band-ouro').innerText(),/1º ao 8º/);
    assert.match(await table.locator('.band-prata').innerText(),/9º ao 16º/);
    assert.match(await table.locator('.band-bronze').innerText(),/17º ao 24º/);
    assert.equal(await page.locator('.paulista-standing-position b').innerText(),'23º');
    assert.equal(await page.locator('.paulista-standing-key .paulista-medal').innerText(),'Chave Bronze');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no page overflow');
    assert.ok(await table.evaluate(e=>{const head=[...e.querySelectorAll('thead th')],cells=e.querySelector('tr[data-team-id]').children;return head.every((h,i)=>Math.abs(h.getBoundingClientRect().x-cells[i].getBoundingClientRect().x)<1);}), 'all headings and cells share columns');
    if(width<=760){
     const band=table.locator('.paulista-ranking-band-label').first(), bandBefore=await band.boundingBox();
     const before=await teams.first().locator('th').boundingBox();await table.evaluate(e=>{e.scrollLeft=250;});
     const after=await teams.first().locator('th').boundingBox();assert.ok(Math.abs(before.x-after.x)<1,'club remains visible while scrolling statistics');
     const bandAfter=await band.boundingBox();assert.ok(Math.abs(bandBefore.x-bandAfter.x)<1,'key name and position range stay visible during horizontal scroll');
     assert.ok(await teams.first().locator('th').evaluate(e=>{const s=getComputedStyle(e,'::after');return s.backgroundImage.includes('linear-gradient')&&s.pointerEvents==='none';}),'frozen edge fades gently without intercepting gestures');
     await table.screenshot({path:`test-results/paulista-ranking-horizontal-${width}-${role}.png`});
     await table.evaluate(e=>{e.scrollLeft=0;});
    }
    if(await page.locator('.paulista-page').evaluate(e=>e.clientWidth>760)){
     await table.evaluate(e=>{e.scrollTop=e.scrollHeight;});
     assert.ok(await table.evaluate(e=>{const box=e.getBoundingClientRect(),head=e.querySelector('thead th').getBoundingClientRect();return Math.abs(head.top-box.top)<3;}),'column headings remain visible at the bottom of the table');
     await page.getByRole('button',{name:'Localizar meu clube',exact:true}).click();
     assert.ok(await table.locator('tr.is-located').count(),'locate highlights the actual club row');
     assert.ok(await table.evaluate(e=>{const box=e.getBoundingClientRect(),row=e.querySelector('tr.is-located').getBoundingClientRect(),head=e.querySelector('thead').getBoundingClientRect();return row.top>=head.bottom-1 && row.bottom<=box.bottom+1;}),'located row is fully visible below the sticky headings');
     if(width===1440 && role==='ADMIN'){await page.waitForTimeout(2300);assert.equal(await table.locator('tr.is-located').count(),0,'locate feedback clears automatically');}
     await table.evaluate(e=>{e.scrollTop=0;});
    }
    const own=table.locator('.is-own');await own.hover();
    const colors=await own.locator(':scope > *').evaluateAll(es=>es.map(e=>getComputedStyle(e).backgroundColor));
    assert.equal(new Set(colors).size,1,'full row highlight');
    const layouts=async()=>{
     const layout=await page.locator('.paulista-ranking-layout').evaluate(e=>{const t=e.querySelector('.paulista-ranking-table').getBoundingClientRect(),c=e.querySelector('aside').getBoundingClientRect();return {columns:getComputedStyle(e).gridTemplateColumns.split(' ').length,t:{x:t.x,y:t.y,bottom:t.bottom,right:t.right},c:{x:c.x,y:c.y,bottom:c.bottom}};});
     if(layout.columns===2)assert.ok(Math.abs(layout.t.y-layout.c.y)<1&&layout.c.x>layout.t.right,'summary aligned at the right');
     else assert.ok(layout.c.bottom<=layout.t.y,'compact summary above table');
    };
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await layouts();
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({path:`test-results/paulista-ranking-${width}-${role}.png`,fullPage:true});
    if(width===1440&&role==='ADMIN'){
     await page.locator('.sidebar-toggle').click();await page.waitForTimeout(250);await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await layouts();
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
     await page.screenshot({path:'test-results/paulista-ranking-expanded.png',fullPage:true});
     await page.locator('.sidebar-toggle').click();
    }
    if(width>=1440){
     const aside=page.locator('.paulista-ranking-summary');
     await page.evaluate(()=>window.scrollTo({top:450,behavior:'instant'}));
     assert.ok(await aside.evaluate(e=>{const r=e.getBoundingClientRect(),parent=e.closest('.paulista-ranking-layout').getBoundingClientRect();return getComputedStyle(e).position==='sticky'&&r.top>=76-1&&r.bottom<=parent.bottom+1;}),'summary follows the page within the standings area');
     await table.evaluate(e=>{e.scrollTop=e.scrollHeight;});
     await page.screenshot({path:`test-results/paulista-ranking-scrolled-${width}-${role}.png`,fullPage:false});
     await table.evaluate(e=>{e.scrollTop=0;});
    }
    // Selectors retain their original phase/group boundaries. Base A3 must not inherit 1–8 cuts.
    if(width===390||width===1440){
     await page.goto(base+'/competicoes?evento=925');await page.locator('.paulista-participation').waitFor();
     await page.getByRole('button',{name:'Classificação',exact:true}).click();
     assert.equal(await page.locator('.paulista-ranking-band').count(),0);
     const select=page.getByRole('combobox',{name:/^Grupo\/chave/});await select.click();
     const option=page.getByRole('option',{name:/Grupo B/i});await option.click();
     assert.match(await page.locator('.paulista-table-heading h2').innerText(),/Grupo B/i);
     assert.equal(await page.locator('.paulista-ranking-summary').count(),0,'other group has no wrong own-club card');
     await page.screenshot({path:`test-results/paulista-ranking-group-${width}-${role}.png`,fullPage:true});
    }
    assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
    console.log(`OK classificação ${width}px/${role}: faixas publicadas, ordem, alinhamento e responsividade`);
   } finally {await context.close();}
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
