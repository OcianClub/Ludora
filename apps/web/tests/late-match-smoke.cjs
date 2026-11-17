const assert=require('node:assert/strict'),{chromium}=require('playwright');
const base=process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{for(const width of [320,1366])for(const theme of ['light','dark']){
    const context=await browser.newContext({viewport:{width,height:950}});
    await context.addInitScript(theme=>{
      localStorage.setItem('ludora_token','visual-test-only');localStorage.setItem('ludora_usuario',JSON.stringify({id:1,nome:'Alex',email:'visual@example.test'}));localStorage.setItem('ludora_clube',JSON.stringify({id:2,nome:'Ocian',meuPapel:'ADMIN'}));localStorage.setItem('ludora_clube_id','2');localStorage.setItem('ludora_tema',theme);
    },theme);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.clock.install({time:new Date('2026-11-17T00:47:30Z')});
    await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
    await require('./visual-fixture.cjs').install(page);
    await page.route('**/partidas/organizacao/contexto?*',r=>r.fulfill({json:{recentes:[],ultimoLocalCasa:null}}));
    await page.route('**/partidas/organizacao/conflitos?*',r=>r.fulfill({json:{conflito:false,mensagem:'Disponível',partidaId:null,propostaId:null}}));
    await page.route('**/partidas/atrasadas',r=>r.fulfill({json:[{id:106,categoria:{id:1,nome:'sub-7'}}]}));
    await page.goto(base+'/partidas');
    await page.getByRole('button',{name:'Nova partida',exact:true}).filter({visible:true}).click();
    const form=page.getByRole('dialog',{name:'Organizar partida',exact:true});
    await form.getByRole('button',{name:'Selecionar adversário',exact:true}).click();
    await page.getByRole('dialog',{name:'Selecionar adversário',exact:true}).getByRole('radio',{name:'Santos',exact:true}).click();
    await form.getByRole('button',{name:/^Hoje/}).click();
    await form.getByLabel('Horário',{exact:true}).fill('21:46');
    await form.getByRole('button',{name:'Organizar partida',exact:true}).click();
    await form.getByRole('alert').filter({hasText:'Este horário já passou'}).waitFor();
    assert.equal(await page.getByRole('dialog',{name:'Revisar partida',exact:true}).count(),0);
    await form.getByRole('button',{name:'Cancelar',exact:true}).click();
    await page.goto(base+'/dashboard');
    await page.getByRole('link',{name:/Partidas atrasadas/}).waitFor();
    const match=()=>({id:106,status:'AGENDADA',versao:1,data:'2026-11-15',horario:'19:30',categoria_id:1,categoria:{id:1,nome:'sub-7',clube_id:2},mandante_id:13,visitante_id:10,mandante:{id:13,nome:'Ocian',clube_representado_id:2},visitante:{id:10,nome:'Aurora FC',clube_representado_id:null},emCasa:true,gols_mandante:0,gols_visitante:0,organizador_id:2,sumula_clube_id:2});
    await require('./shared-match-fixture.cjs').install(page,{players:[],lineup:()=>[],match});
    let deletes=0;
    await page.route('**/partidas/106',route=>{
      if(route.request().resourceType()==='document')return route.fallback();
      if(route.request().method()==='DELETE'){deletes++;assert.equal(route.request().postDataJSON().versao,1);return route.fulfill({json:{excluida:true,id:106}});}
      return route.fulfill({json:match()});
    });
    await page.goto(base+'/partidas/106');
    await page.route('**/partidas/106/status',route=>{
      const body=route.request().postDataJSON();assert.equal(body.status,'CANCELADA');assert.equal(body.motivo,'Quadra indisponível');
      return route.fulfill({status:503,json:{error:'Falha simulada. Tente novamente.'}});
    });
    await page.getByRole('button',{name:'Ações da partida',exact:true}).click();
    await page.getByRole('menuitem',{name:'Cancelar partida',exact:true}).click();
    const cancel=page.getByRole('dialog',{name:'Cancelar partida',exact:true});
    const confirmCancel=cancel.getByRole('button',{name:'Confirmar cancelamento',exact:true});
    assert.ok(await confirmCancel.isDisabled());
    await cancel.getByLabel(/Motivo do cancelamento/).fill('   ');assert.ok(await confirmCancel.isDisabled());
    await cancel.getByLabel(/Motivo do cancelamento/).fill('Quadra indisponível');
    await confirmCancel.click();await cancel.getByRole('alert').waitFor();
    assert.equal(await cancel.getByLabel(/Motivo do cancelamento/).inputValue(),'Quadra indisponível','A failed cancellation keeps the reason');
    await cancel.screenshot({path:require('node:path').resolve(__dirname,`../../../test-results/cancel-match-${width}-${theme}.png`)});
    await cancel.getByRole('button',{name:'Voltar',exact:true}).click();
    try{await page.getByRole('button',{name:'Ações da partida',exact:true}).click({timeout:10000});}catch(e){console.error(await page.locator('body').innerText(),errors);throw e;}
    await page.getByRole('menuitem',{name:'Excluir partida',exact:true}).click();
    const confirm=page.getByRole('dialog',{name:'Excluir partida',exact:true});
    await confirm.waitFor();assert.equal(deletes,0,'Opening confirmation does not delete');
    const box=await confirm.boundingBox(),action=await confirm.getByRole('button',{name:'Excluir definitivamente',exact:true}).boundingBox();
    assert.ok(action.x>box.x && action.x+action.width<box.x+box.width-10,'Buttons have horizontal padding');
    assert.ok(action.y+action.height<box.y+box.height-10,'Buttons have bottom padding');
    assert.ok(await confirm.evaluate(el=>el.scrollWidth<=el.clientWidth));
    await confirm.screenshot({path:require('node:path').resolve(__dirname,`../../../test-results/delete-match-${width}-${theme}.png`)});
    await confirm.getByRole('button',{name:'Voltar',exact:true}).click();assert.equal(deletes,0);
    await page.getByRole('button',{name:'Ações da partida',exact:true}).click();
    await page.getByRole('menuitem',{name:'Excluir partida',exact:true}).click();
    await confirm.getByRole('button',{name:'Excluir definitivamente',exact:true}).click();
    await page.waitForURL(base+'/partidas');assert.equal(deletes,1);assert.deepEqual(errors,[]);
    console.log(`PASS ${width}px ${theme}: horário passado bloqueado, pendência visível e exclusão exige confirmação`);
    await context.close();
  }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
