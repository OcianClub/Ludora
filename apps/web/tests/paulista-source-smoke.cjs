// Real, read-only federation snapshots captured by auditar-paulista-leitura.ts.
// Browser requests are intercepted: this test cannot publish or change data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { prepare } = require('./responsive-audit.cjs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5192';
const folder = path.resolve(__dirname, '../../../test-results/paulista-source-audit');
const { links } = JSON.parse(fs.readFileSync(path.join(folder, 'stored.json'), 'utf8'));
const expected = {
 Ocian: [[900,'PRATA',12],[901,'BRONZE',23],[902,'BRONZE',22],[903,'PRATA',11],[925,'PRATA',4],[923,null,6],[924,null,7],[922,'PRATA',5]],
 Santos: [[908,'OURO',4],[909,'OURO',6],[910,'OURO',6],[911,'OURO',5],[907,'OURO',3],[905,'PRATA',11],[906,'OURO',7],[904,'OURO',6]],
};
const snapshots = new Map([...new Set(Object.values(expected).flat().map(e=>e[0]))].map(id=>[id,JSON.parse(fs.readFileSync(path.join(folder,`evento-${id}.json`),'utf8'))]));
async function noOverflow(page) { assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false); }
async function sourceLink(page) {
 await page.getByRole('button',{name:'Opções do campeonato',exact:true}).click();
 const href=await page.locator('.paulista-source-link').getAttribute('href');
 await page.keyboard.press('Escape');return href;
}
async function hoverRows(page, selector) {
 const row = page.locator(selector).first();
 await row.hover();
 await page.waitForTimeout(180);
 const colors=await row.locator(':scope > *').evaluateAll(es=>es.map(e=>getComputedStyle(e).backgroundColor));
 assert.equal(new Set(colors).size,1,`hover covers both row header and every data cell: ${selector}: ${colors}`);
}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const width of (process.env.PAULISTA_SOURCE_WIDTHS || '320,390,820,1024,1440').split(',').map(Number)) for(const role of ['ADMIN','TORCEDOR']) for(const clubeNome of ['Ocian','Santos']) {
   const {page,context}=await prepare(browser,width,920,'dark',{role,clubeNome});
   const errors=[],writes=[]; let wrongResponse=false, delayedId=null;
   page.on('pageerror',e=>errors.push(e.message));
   const catalog=expected[clubeNome].map(([id])=>{const s=snapshots.get(id);return {id,ano:s.ano,categoria:s.categoria,divisao:s.divisao};});
   const panel = id => {
    const s=snapshots.get(id);
    return {evento:{id,versao:1,consultadoEm:'2026-11-09T00:00:00Z'},snapshot:s,
     vinculos:links.filter(l=>s.equipes.some(e=>e.id===l.equipeId)).map(l=>({equipeId:l.equipeId,clubeId:l.clube.nome===clubeNome?2:100+l.clubeId,nome:l.clube.nome,escudo:null})),
     jogosLocais:[],pendencias:[],retroativos:[]};
   };
   await page.route('**/paulista/**',async route=>{
    const r=route.request(),url=new URL(r.url());if(url.origin===base)return route.fallback();
    if(r.method()==='OPTIONS')return route.fulfill({status:204});
    if(r.method()!=='GET'){writes.push(url.pathname);return route.abort();}
    if(url.pathname.endsWith('/status'))return route.fulfill({json:{ativo:true,bancoPronto:true}});
    if(url.pathname.endsWith('/eventos'))return route.fulfill({json:catalog});
    const id=Number(url.pathname.split('/').pop());
    if(id===delayedId)await new Promise(resolve=>setTimeout(resolve,600));
    return route.fulfill({json:panel(wrongResponse?catalog.find(e=>e.id!==id).id:id)}).catch(()=>{});
   });
   try {
    for(const [id,key,position] of expected[clubeNome]) {
     await page.goto(base+`/competicoes?evento=${id}`,{waitUntil:'domcontentloaded'});
     await page.locator('.paulista-participation').waitFor();
     assert.equal(await page.locator('.paulista-participation-position > strong').innerText(),position+'º');
     assert.match(await page.locator('.paulista-participation-identity').innerText(),new RegExp(clubeNome));
     assert.equal(await sourceLink(page),snapshots.get(id).fonte);
     if(key)assert.equal(await page.locator('.paulista-participation-key .paulista-medal').getAttribute('aria-label'),'Chave '+key[0]+key.slice(1).toLowerCase());
     else assert.equal(await page.locator('.paulista-participation-key .paulista-medal').count(),0,'no gold fallback for unpublished brackets');
     await noOverflow(page);
    }
    const [id,key]=expected[clubeNome][1];
    await page.goto(base+`/competicoes?evento=${id}`);await page.locator('.paulista-participation').waitFor();
    const progress=page.locator('.paulista-stage-progress');
    if(await progress.evaluate(e=>getComputedStyle(e).display)==='grid') {
     const boxes=await progress.locator('li').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,bottom:r.bottom};}));
     assert.ok(boxes.every((r,i)=>!i || Math.abs(r.x-boxes[0].x)<1&&r.y>=boxes[i-1].bottom),'mobile progresses top to bottom');
    }
    const marker=page.locator('.paulista-journey li.is-ended .paulista-journey-marker');
    if(await marker.count()) {
     assert.equal(await marker.first().evaluate(e=>getComputedStyle(e).backgroundColor),await page.locator('.paulista-journey-details .result-D').last().evaluate(e=>getComputedStyle(e).backgroundColor));
     assert.equal(await marker.first().evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');
    }
    await hoverRows(page,'.paulista-nearby tbody tr:not(.is-own)');
    await hoverRows(page,'.paulista-nearby tbody tr.is-own');
    const match=page.locator('.paulista-journey-match').first();
    const rgb=e=>{const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');ctx.fillStyle=getComputedStyle(e).backgroundColor;ctx.fillRect(0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3);};
    await page.mouse.move(0,0);await page.waitForTimeout(180);const idle=await match.evaluate(rgb);
    await match.hover();await page.waitForTimeout(180);const hover=await match.evaluate(rgb);
    assert.ok(hover.every((v,i)=>Math.abs(v-idle[i])<=12),`match hover changes brightness gently: ${idle} -> ${hover}`);
    await page.mouse.move(0,0);
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.screenshot({path:path.join(folder,`verified-${clubeNome}-${width}-${role}.png`),fullPage:true});
    if(width===1440&&role==='ADMIN') {
     await page.locator('.sidebar-toggle').click();await noOverflow(page);
     await page.screenshot({path:path.join(folder,`verified-${clubeNome}-expanded.png`),fullPage:true});
    }
    await page.getByRole('button',{name:'Classificação',exact:true}).click();
    await hoverRows(page,'.paulista-table-scroll tbody tr[data-team-id]:not(.is-own)');
    await hoverRows(page,'.paulista-table-scroll tbody tr.is-own');
    // A delayed category response must never overwrite the current selection.
    delayedId=catalog[0].id;
    await page.goto(base+`/competicoes?evento=${catalog[0].id}`);
    await page.getByRole('tab',{name:'SUB-8',exact:true}).click();
    await page.locator('.paulista-participation').waitFor();await page.waitForTimeout(650);
    assert.equal(await sourceLink(page),snapshots.get(catalog[1].id).fonte);
    // An invalid background refresh keeps the last valid result on screen.
    wrongResponse=true;delayedId=null;
    const sourceBefore=await sourceLink(page);
    await page.getByRole('button',{name:'Opções do campeonato',exact:true}).click();
    await page.getByRole('menuitem',{name:'Atualizar dados',exact:true}).click();
    await page.locator('.paulista-update-notice').waitFor();
    assert.equal(await sourceLink(page),sourceBefore);
    assert.equal(await page.locator('.paulista-participation').count(),1);
    // A mismatched initial response must be rejected, rather than presenting another key.
    await page.goto(base+`/competicoes?evento=${catalog[0].id}`);
    await page.getByRole('alert').filter({hasText:'não correspondem'}).waitFor();
    assert.equal(await page.locator('.paulista-participation').count(),0);
    wrongResponse=false;
    await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
    await page.locator('.paulista-participation').waitFor();
    assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
    console.log(`OK fonte 2026: ${clubeNome}/${width}px/${role}: oito categorias, divisão, posição, chaves, sem publicação, hovers, progresso e navegação concorrente`);
   } finally {await context.close();}
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
