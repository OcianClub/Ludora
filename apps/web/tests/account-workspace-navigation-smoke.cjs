const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';
(async () => {
  fs.mkdirSync('test-results/account-workspace', {recursive:true});
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try { for (const width of [320,390,820,1366]) {
    const context = await browser.newContext({viewport:{width,height:900}});
    await context.addInitScript(() => {
      localStorage.setItem('ludora_token','test'); localStorage.setItem('ludora_tema','light');
      localStorage.setItem('ludora_usuario',JSON.stringify({id:1,nome:'Alex',email:'alex@example.test'}));
      localStorage.setItem('ludora_clube_id','2'); localStorage.setItem('ludora_clube',JSON.stringify({id:2,nome:'Ocian',meuPapel:'ADMIN'}));
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await require('./visual-fixture.cjs').install(page); await page.route('**/notificacoes/preferencias',r=>r.fulfill({json:{preferencias:[]}})); await page.goto(base+'/dashboard');
    await page.locator(width<=760 ? '.workspace-header .current-club' : '.sidebar').waitFor();
    if(width<=760) {
      await page.getByRole('button',{name:'Mais opções de navegação',exact:true}).click();
      const more=page.getByRole('dialog',{name:'Mais opções',exact:true});
      await more.getByRole('link',{name:'Torneios',exact:true}).waitFor();
      await more.evaluate(async e=>{await Promise.all(e.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})));});
      assert.equal(await more.getByRole('link',{name:'Configurações do clube',exact:true}).count(),1);
      const settings=more.getByRole('navigation',{name:'Configurações e visualização',exact:true});
      assert.deepEqual(await settings.locator('a').allTextContents(),['Configurações do clube','Ver como visitante']);
      const personal=more.getByRole('navigation',{name:'Conta e ajuda',exact:true});
      assert.equal(await personal.getByRole('button',{name:'Suporte e ajuda',exact:true}).count(),1);
      await more.getByRole('button',{name:'Menu da conta',exact:true}).click();
      await page.waitForURL('**/perfil'); assert.equal(await page.locator('[data-account-popover]').count(),0);
    } else {
      assert.equal(await page.locator('.sidebar').getByRole('link',{name:'Configurações do clube',exact:true}).count(),0);
      assert.equal(await page.locator('.sidebar').getByRole('link',{name:'Torneios',exact:true}).count(),1);
      await page.getByRole('button',{name:'Menu da conta',exact:true}).click();
      const popup=page.locator('[data-account-popover]');await popup.waitFor();
      assert.equal(await popup.getByRole('link',{name:'Meus clubes',exact:true}).count(),0);
      assert.equal(await popup.getByRole('button',{name:'Suporte e ajuda',exact:true}).count(),0);
      await popup.getByRole('link',{name:'Configurações do clube',exact:true}).waitFor();
      await popup.getByRole('link',{name:'Meu perfil',exact:true}).click();
    }
    await page.getByRole('heading',{name:'Meu perfil',exact:true}).waitFor();
    await page.locator('.perfil-page').getByRole('button',{name:'Suporte e ajuda',exact:true}).waitFor();
    await page.getByRole('tab',{name:'Preferências',exact:true}).click();
    await page.getByRole('tab',{name:'Meus clubes',exact:true}).click();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
    await page.screenshot({path:`test-results/account-workspace/profile-${width}.png`,fullPage:true});
    await context.close();console.log(`PASS navigation ${width}px`);
  }} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
