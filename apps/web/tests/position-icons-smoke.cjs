const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const {chromium}=require('playwright');
const base=process.env.LUDORA_WEB_TEST_URL||'http://127.0.0.1:5188';
(async()=>{
 const out=path.resolve(__dirname,'../../../test-results/positions');fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const theme of ['dark','light'])for(const width of [390,1366]){
   const context=await browser.newContext({viewport:{width,height:900}});
   await context.addInitScript(theme=>{localStorage.setItem('ludora_tema',theme);localStorage.setItem('ludora_token','visual-test-only');localStorage.setItem('ludora_usuario',JSON.stringify({id:1,nome:'Alex',email:'test@example.test'}));localStorage.setItem('ludora_clube_id','2');localStorage.setItem('ludora_clube',JSON.stringify({id:2,nome:'Ocian',meuPapel:'ADMIN'}));},theme);
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());await require('./visual-fixture.cjs').install(page);
   await page.goto(base+'/jogadores');await page.locator('.alunos-category-toggle').first().click();await page.locator('.position-icon').first().waitFor();
   for(const label of ['Goleiro','Fixo','Ala','Pivô']){
    const icon=page.locator(`[data-position-icon="${label}"]`).first();
    const rendered=await icon.evaluate(svg=>{const b=svg.getBoundingClientRect(),ink=svg.getBBox(),s=getComputedStyle(svg);return {width:b.width,height:b.height,inkWidth:ink.width+1.6,inkHeight:ink.height+1.6,bg:s.backgroundColor,border:s.borderWidth,stroke:svg.getAttribute('stroke-width')};});
    assert.equal(rendered.width,24);assert.equal(rendered.height,24);assert.ok(rendered.inkWidth<=18&&rendered.inkHeight<=18);assert.equal(rendered.bg,'rgba(0, 0, 0, 0)');assert.equal(rendered.border,'0px');assert.equal(rendered.stroke,'1.6');
    await icon.locator('..').focus();await page.getByRole('tooltip').waitFor();assert.equal(await page.getByRole('tooltip').innerText(),label);await page.keyboard.press('Escape');
   }
   await page.locator('#main-content').focus();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,`players-${width}-${theme}.png`),fullPage:true});
   await page.getByRole('button',{name:'+ Adicionar aluno',exact:true}).click();
   const dialog=page.getByRole('dialog',{name:'Adicionar aluno',exact:true});
   const choices=dialog.getByRole('group',{name:'Posição do aluno'});await choices.screenshot({path:path.join(out,`positions-form-${width}-${theme}.png`)});
   const colors=await choices.locator('svg').evaluateAll(items=>items.map(item=>getComputedStyle(item).color));assert.equal(new Set(colors).size,4);
   await page.evaluate(()=>{
    const box=document.createElement('div');box.id='position-comparison';Object.assign(box.style,{position:'fixed',left:'10px',top:'10px',zIndex:'99999',display:'flex',gap:'20px',padding:'16px',background:'var(--fundo-card)',color:'var(--texto)'});
    for(const svg of document.querySelector('.position-options').querySelectorAll('svg')){const cell=document.createElement('div');Object.assign(cell.style,{display:'flex',flexDirection:'column',alignItems:'center',gap:'8px',fontSize:'12px'});cell.append(svg.cloneNode(true),document.createTextNode(svg.dataset.positionIcon));box.append(cell);}document.querySelector('dialog').append(box);
   });
   await page.locator('#position-comparison').screenshot({path:path.join(out,`four-icons-${width}-${theme}.png`)});
   await page.locator('#position-comparison').evaluate(el=>el.remove());await dialog.getByRole('button',{name:'Fechar',exact:true}).click();
   await page.goto(base+'/elenco');await page.locator('.scout-player .position-icon').first().waitFor();await page.screenshot({path:path.join(out,`scout-${width}-${theme}.png`),fullPage:true});
   assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${width}px ${theme}: quatro desenhos, 24px, área interna, transparência, cores, tooltips, lista/formulário/scout`);
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
