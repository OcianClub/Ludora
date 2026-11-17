const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';

(async () => {
  const browser = await chromium.launch({ channel:'msedge', headless:true });
  try {
    for (const width of [320, 1366]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport:{ width, height:900 } });
      const original = { mandante_id:'13', visitante_id:'14', data:'2027-12-21', horario:'19:00', local:'Rascunho anterior', categoria_id:'1', competicao_id:'amistoso', rodada:'', emCasa:'true' };
      await context.addInitScript(({theme,original}) => {
        localStorage.setItem('ludora_token','visual-test-only');
        localStorage.setItem('ludora_usuario',JSON.stringify({id:1,nome:'Alex',email:'visual@example.test'}));
        localStorage.setItem('ludora_clube',JSON.stringify({id:2,nome:'Ocian',meuPapel:'ADMIN'}));
        localStorage.setItem('ludora_clube_id','2'); localStorage.setItem('ludora_tema',theme);
        localStorage.setItem('ludora:partida:http://localhost:3000:1:2',JSON.stringify({form:original,savedAt:Date.now()}));
      },{theme,original});
      const page = await context.newPage(), errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
      await require('./visual-fixture.cjs').install(page,{ decorate:({partidas})=>{
        const match=partidas.find(p=>p.id===101); match.competicao_id=2;
        const compartilhada=partidas.find(p=>p.id===106);
        partidas.splice(0,partidas.length,match,compartilhada);
      }});
      let previewFails=false;
      await page.route('**/partidas/organizacao/contexto?*',route=>route.fulfill({json:{recentes:[],ultimoLocalCasa:null}}));
      await page.route('**/partidas/organizacao/conflitos?*',async route=>{
        if(previewFails) return route.fulfill({status:503,json:{error:'Consulta temporariamente indisponível'}});
        const horario=new URL(route.request().url()).searchParams.get('horario');
        if(horario==='18:30') await new Promise(resolve=>setTimeout(resolve,500));
        return route.fulfill({json:{conflito:horario==='18:30',mensagem:'Compromisso anterior',partidaId:null,propostaId:null}}).catch(()=>{});
      });
      await page.goto(base+'/partidas?status=FINALIZADA');
      const action=page.getByRole('button',{name:'Organizar novo confronto',exact:true});
      await action.waitFor();
      await page.locator('.match-card').screenshot({path:path.resolve(__dirname,`../../../test-results/web-schedule/repeat-card-${width}-${theme}.png`)});
      await action.click();
      const form=page.getByRole('dialog',{name:'Organizar partida',exact:true});
      assert.ok(await form.getByRole('note').filter({hasText:'Novo confronto a partir de'}).isVisible());
      assert.match(await form.getByRole('button',{name:'Data',exact:true}).innerText(),/Escolher data/);
      assert.equal(await form.getByLabel('Horário',{exact:true}).inputValue(),'18:30');
      assert.equal(await form.getByLabel('Local · opcional',{exact:true}).inputValue(),'Quadra de demonstração');
      assert.equal(await form.getByRole('button',{name:'Selecionar adversário: Santos',exact:true}).count(),1);
      assert.ok(await form.getByRole('button',{name:/Copa Ocian Iniciação/}).isVisible());
      assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ludora:partida:http://localhost:3000:1:2')).form),original);
      await form.getByRole('button',{name:'Retomar rascunho',exact:true}).click();
      assert.equal(await form.getByLabel('Local · opcional',{exact:true}).inputValue(),'Rascunho anterior');
      assert.equal(await form.getByRole('note').filter({hasText:'Novo confronto a partir de'}).count(),0);
      // An older request cannot mark a new time as occupied.
      await form.getByLabel('Horário',{exact:true}).fill('18:30');
      await page.waitForRequest(req=>req.url().includes('/organizacao/conflitos?')&&req.url().includes('18%3A30'));
      await form.getByLabel('Horário',{exact:true}).fill('19:15');
      await page.waitForFunction(()=>!document.querySelector('.schedule-availability'));
      assert.ok(await form.getByRole('button',{name:'Organizar partida',exact:true}).isEnabled());
      previewFails=true;
      await form.getByLabel('Horário',{exact:true}).fill('19:20');
      await form.getByText(/Não foi possível conferir agora/).waitFor();
      assert.ok(await form.getByRole('button',{name:'Organizar partida',exact:true}).isEnabled(),'Failed preview does not block server validation');
      await form.getByRole('button',{name:'Organizar partida',exact:true}).click();
      await page.getByRole('dialog',{name:'Revisar partida',exact:true}).waitFor();
      assert.deepEqual(errors,[]);
      console.log(`PASS ${width}px ${theme}: repetir confronto, preservar rascunho, ignorar resposta antiga e falha de consulta sem bloqueio`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
