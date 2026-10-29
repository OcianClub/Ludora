const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const width of [320,390,820,1366]) for(const theme of ['dark','light']) {
   const ctx = await browser.newContext({viewport:{width,height:844}});
   await ctx.addInitScript(theme => {localStorage.setItem('ludora_token','test');localStorage.setItem('ludora_usuario',JSON.stringify({id:1,nome:'Alex'}));localStorage.setItem('ludora_clube_id','2');localStorage.setItem('ludora_clube',JSON.stringify({id:2,nome:'Ocian',meuPapel:'ADMIN'}));localStorage.setItem('ludora_tema',theme);},theme);
   const p=await ctx.newPage(); await p.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:5189'?r.continue():r.abort());
   await require('./visual-fixture.cjs').install(p);
   await p.route('http://localhost:3000/usuarios/me',r=>r.fulfill({json:{id:1,nome:'Alex',email:'alex@example.test',notificacoes_ativas:true,clubes:[{id:4,nome:'Clube Base',meuPapel:'TECNICO'},{id:5,nome:'Clube Seguido',meuPapel:'TORCEDOR'},{id:2,nome:'Ocian',meuPapel:'ADMIN'}]}}));
   await p.goto('http://127.0.0.1:5189/perfil?secao=clubes');
   const groups=p.locator('.perfil-clubes-group');await groups.first().waitFor();
   assert.equal(await groups.count(),2);assert.match(await groups.first().locator('.perfil-clube').first().innerText(),/Ocian/);
   assert.match(await groups.nth(1).innerText(),/Clube Seguido/);
   const card=await p.locator('.perfil-clubes-card').boundingBox(), link=await p.locator('.perfil-explorar').boundingBox();assert.ok(link.x>=card.x && link.x+link.width<=card.x+card.width+1);
   await p.getByRole('tab',{name:'Preferências'}).click();
   const panel=p.locator('#perfil-panel-preferencias');
   assert.equal(await panel.getByRole('radio').count(),3);
   await panel.getByRole('radio',{name:'Tema do sistema'}).click();assert.equal(await p.evaluate(()=>localStorage.getItem('ludora_tema')),'system');
   await panel.getByRole('radio',{name:'Tema escuro'}).click();assert.equal(await p.evaluate(()=>localStorage.getItem('ludora_tema')),'dark');
   assert.ok(await panel.getByRole('switch',{name:'Receber notificações'}).isVisible());
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(width===1366){await p.getByRole('button',{name:'Expandir navegação'}).click();await p.waitForTimeout(400);const brand=await p.locator('.sidebar-brand img').boundingBox(), crest=await p.locator('.sidebar-club .club-badge').boundingBox(), user=await p.locator('.sidebar .sidebar-usuario').boundingBox(), bell=await p.locator('.sidebar-footer .notifications-trigger').boundingBox();assert.ok(Math.abs(brand.x-crest.x)<=1);assert.ok(bell.x-user.x-user.width>=6);await p.locator('.sidebar .account-trigger').click();const popup=p.getByRole('dialog',{name:'Conta e aparência'});await popup.getByRole('radio',{name:'Tema claro'}).click();assert.equal(await panel.getByRole('radio',{name:'Tema claro'}).getAttribute('aria-checked'),'true');}
   await ctx.close();console.log(`${width}px ${theme}: clubes, tema e alinhamento OK`);
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
