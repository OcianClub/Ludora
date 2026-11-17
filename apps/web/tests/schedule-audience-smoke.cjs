const assert=require('node:assert/strict'),{chromium}=require('playwright');
const base=process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
for(const width of [390,1366])for(const theme of ['dark','light'])for(const audience of ['manager','viewer','restricted','visitor']){
  const role=audience==='viewer' ? 'TORCEDOR' : audience==='restricted' ? 'TECNICO' : 'ADMIN';
  const context=await browser.newContext({viewport:{width,height:950}});
  await context.addInitScript(({role,theme,audience})=>{
    localStorage.setItem('ludora_token','visual-test-only');localStorage.setItem('ludora_usuario',JSON.stringify({id:1,nome:'Alex',email:'visual@example.test'}));
    localStorage.setItem('ludora_clube',JSON.stringify({id:2,nome:'Ocian',meuPapel:role}));localStorage.setItem('ludora_clube_id','2');localStorage.setItem('ludora_tema',theme);
    if(audience==='visitor')sessionStorage.setItem('ludora_visitor_view',JSON.stringify({clubId:2,userId:1}));
  },{role,theme,audience});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  await require('./visual-fixture.cjs').install(page,{role,decorate:({clubes,partidas})=>{
    clubes[0].acessoTodasCategorias=false;clubes[0].categoriasAcesso=[];
    for(const p of partidas){const n=p.id%100;p.status=n===0?'AO_VIVO':n===1?'AGENDADA':n===2?'PREPARADA':n===3?'CANCELADA':'FINALIZADA';p.data=n===2?'2027-12-21T00:00:00Z':'2026-01-01T00:00:00Z';}
  }});
  await page.goto(base+'/partidas');
  await page.getByRole('button',{name:/^Canceladas/}).filter({visible:true}).waitFor();
  const titles=await page.locator('.schedule-section-title').filter({visible:true}).allTextContents();
  assert.deepEqual(titles,audience==='manager'?['Ao vivo','Atrasadas','Próximas','Finalizadas','Canceladas']:['Ao vivo','Próximas','Finalizadas','Atrasadas','Canceladas']);
  assert.equal(await page.getByRole('button',{name:/^Canceladas/}).filter({visible:true}).getAttribute('aria-expanded'),'false');
  const overdue=page.getByRole('button',{name:audience==='manager'?/^Atrasadas/:/^Atrasadas/}).filter({visible:true});
  assert.equal(await overdue.getAttribute('aria-expanded'),audience==='manager'?'true':'false');
  if(audience!=='manager'){
    await overdue.click();await page.getByText('O horário previsto passou, mas o início ainda não foi registrado.',{exact:true}).filter({visible:true}).waitFor();
    assert.equal(await page.locator('.match-overdue').filter({visible:true}).first().innerText(),'Atrasada');
  }else assert.equal(await page.locator('.match-overdue').filter({visible:true}).first().innerText(),'Atrasada');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Labels fit the viewport');
  if(width===1366){
    await page.getByRole('button',{name:'Lista',exact:true}).filter({visible:true}).click();
    assert.equal(await overdue.getAttribute('aria-expanded'),'true','Presentation toggle preserves the chosen open state');
    assert.ok(await page.locator('.match-list-row').filter({visible:true}).first().evaluate(el=>el.scrollWidth<=el.clientWidth),'Long status fits list rows');
  }
  const tabs=page.getByRole('tablist',{name:'Filtrar por situação',exact:true});
  const lateTab=tabs.getByRole('tab',{name:audience==='manager'?/^Atrasadas/:/^Atrasadas/});
  const count=tab=>tab.locator('.filter-tabs-count').innerText().then(Number);
  assert.equal(await count(lateTab),1);
  assert.equal(await count(tabs.getByRole('tab',{name:/^Próximas/})),1,'Upcoming count excludes overdue matches');
  const tabNames=await tabs.getByRole('tab').evaluateAll(nodes=>nodes.map(node=>Array.from(node.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('')));
  assert.deepEqual(tabNames,audience==='manager'?['Todos','Ao vivo','Atrasadas','Próximas','Finalizadas','Canceladas']:['Todos','Ao vivo','Próximas','Finalizadas','Atrasadas','Canceladas']);
  await lateTab.click();
  assert.ok(page.url().includes('status=ATRASADAS'));
  await page.locator('.match-overdue').filter({visible:true}).first().waitFor();
  assert.equal(await page.locator('.match-card, .match-list-row').filter({visible:true}).count(),1,'Overdue tab shows only overdue fixtures');
  if(width===1366 && audience==='manager'){
    await page.reload();await page.getByRole('tab',{name:/^Atrasadas/}).waitFor();
    assert.equal(await page.getByRole('tab',{name:/^Atrasadas/}).getAttribute('aria-selected'),'true','Overdue filter survives reload');
  }
  await tabs.getByRole('tab',{name:/^Próximas/}).click();
  await page.getByText('21 DEZ',{exact:true}).filter({visible:true}).waitFor();
  assert.equal(await page.locator('.match-overdue').filter({visible:true}).count(),0);
  assert.equal(await page.locator('.match-card, .match-list-row').filter({visible:true}).count(),1);
  assert.deepEqual(errors,[]);console.log(`PASS ${width} ${theme} ${audience}: order, labels, defaults and responsive layout`);await context.close();
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
