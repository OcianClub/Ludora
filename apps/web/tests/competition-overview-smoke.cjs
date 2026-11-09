const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { prepare } = require('./responsive-audit.cjs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5192';
(async () => {
 const browser = await chromium.launch({ channel: 'msedge', headless: true });
 try {
  for (const width of (process.env.COMPETITION_TEST_WIDTH ? [Number(process.env.COMPETITION_TEST_WIDTH)] : [320,390,820,1440])) for (const role of ['ADMIN','TORCEDOR']) {
   const {page,context} = await prepare(browser,width,950,width===820?'light':'dark',{role});
   const errors=[]; page.on('pageerror',e=>errors.push(e.message));
   const summary=(total,finalizadas,situacao)=>({total,finalizadas,ao_vivo:0,situacao,categorias:['SUB-7','SUB-8'],proxima_partida:total!==finalizadas?{id:106,data:'2026-12-08',horario:'19:30',mandante:{nome:'Ocian'},visitante:{nome:'Santos'}}:null});
   let rows=[{id:1,nome:'Copa do clube',ano:2026,tipo:'INICIACAO',clube_id:2,organizador:{nome:'Ocian'},resumo:summary(12,5,'EM_ANDAMENTO')},
    {id:2,nome:'Festival concluído',ano:2026,tipo:'BASE',clube_id:2,resumo:summary(8,8,'FINALIZADA')},
    {id:3,nome:'Torneio arquivado',ano:2025,tipo:'BASE',clube_id:2,arquivada:true,resumo:summary(0,0,'SEM_PARTIDAS')},
    ...[4,5].map((id,i)=>({id,nome:'Paulista '+id,ano:2026,tipo:i?'BASE':'INICIACAO',clube_id:2,paulista_evento_id:900+id,somente_leitura:true})),
    {id:6,nome:'Torneio com nome bastante extenso para testar todos os tamanhos de tela',ano:2026,tipo:'BASE',clube_id:3,somente_leitura:true,resumo:summary(0,0,'SEM_PARTIDAS')}];
   let playerReads=0, registrationReads=0;
   await page.route('**/jogadores/perfis*',r=>{playerReads++;return r.fulfill({json:Array.from({length:24},(_,i)=>({id:100+i,nome:`Atleta ${String(i+1).padStart(2,'0')}`,posicao:'Ala',numCamisa:i+1,categoria_tipo:'INICIACAO',categoria:i<12?'sub-7':'sub-8'}))});});
   await page.route('**/competicoes**',r=>{
    const url=new URL(r.request().url()),p=url.pathname; if(url.origin===base)return r.fallback();
    if(p.endsWith('/classificacao'))return r.fulfill({json:[{grupo:'sub-7 · Geral',times:[{key:'2',nome:'Ocian',pontos:9,jogos:4,vitorias:3,empates:0,derrotas:1,saldo:4},{key:'3',nome:'Santos',pontos:6,jogos:4,vitorias:2,empates:0,derrotas:2,saldo:1}]},{grupo:'sub-8 · Geral',times:[{key:'2',nome:'Ocian',pontos:6,jogos:2,vitorias:2,empates:0,derrotas:0,saldo:3}]}]});
    if(p.endsWith('/jogadores')){if(r.request().method()==='PUT'){assert.deepEqual(r.request().postDataJSON(),{jogador_ids:[100,110,112]});return r.fulfill({json:{ok:true}});}registrationReads++;return r.fulfill({json:[]});}
    if(p.endsWith('/arquivo')){const id=Number(p.split('/').at(-2));rows=rows.map(c=>c.id===id?{...c,arquivada:r.request().postDataJSON().arquivada}:c);return r.fulfill({json:rows.find(c=>c.id===id)});}
    if(p.endsWith('/competicoes'))return r.fulfill({json:role==='ADMIN'?rows:rows.filter(c=>!c.arquivada)});
    return r.fallback();
   });
   await page.goto(base+'/competicoes');await page.getByRole('button',{name:'Abrir Copa do clube',exact:true}).waitFor();
   assert.equal(await page.locator('.competition-federation').count(),1,'Paulista é agrupado');
   assert.equal(await page.locator('.competition-card').count(),2);
   if(width<=390){const boxes=await page.locator('.competition-card').evaluateAll(items=>items.map(el=>el.getBoundingClientRect().y));assert.ok(boxes[1]>boxes[0]+100,'mobile: uma coluna de cards');}
   assert.equal(await page.getByRole('button',{name:'Nova competição',exact:true}).count(),role==='ADMIN'?1:0);
   assert.equal(await page.getByRole('button',{name:/Arquivadas/}).count(),role==='ADMIN'?1:0);
   assert.equal(await page.locator('progress').getAttribute('value'),'5');
   const beforePanelReads=playerReads; await page.getByRole('button',{name:'Abrir Copa do clube',exact:true}).click();
   const panel=page.getByRole('dialog',{name:'Copa do clube',exact:true});await panel.locator('.competition-ranking').waitFor();
   assert.equal(playerReads,beforePanelReads,'classificação não baixa elenco');
   await panel.locator('tbody tr').first().hover();
   const colors=await panel.locator('tbody tr').first().locator('th,td').evaluateAll(cells=>cells.map(cell=>getComputedStyle(cell).backgroundColor));
   assert.equal(new Set(colors).size,1,'hover cobre todas as células da linha');
   assert.equal(await panel.locator('.modal-body').evaluate(el=>el.scrollWidth>el.clientWidth),false,'modal sem overflow horizontal');
   if(role==='ADMIN'){await panel.getByRole('button',{name:'Inscrições do meu clube',exact:true}).click();await panel.getByRole('checkbox').first().waitFor();
    assert.equal(await panel.getByRole('checkbox').count(),10,'dez atletas por página');
    await panel.getByRole('checkbox').first().check();
    await panel.getByRole('button',{name:'Próxima',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.competition-registration-list input').length===2);
    assert.equal(await panel.getByRole('checkbox').count(),2);
    await panel.getByRole('checkbox').first().check();
    await panel.getByRole('combobox',{name:/^Categoria /}).click();
    await panel.getByRole('option',{name:'SUB-8',exact:true}).click();
    await panel.locator('.competition-registration-count').filter({hasText:'SUB-8'}).waitFor();
    await panel.getByRole('checkbox').first().check();
    await panel.screenshot({path:'test-results/competition-registration-'+width+'.png'});
    await panel.getByRole('button',{name:'Salvar inscrições',exact:true}).click();await panel.getByText('Inscrições do seu clube salvas.',{exact:true}).waitFor();assert.equal(registrationReads,1);await panel.getByRole('button',{name:'Classificação',exact:true}).click();}
   await panel.locator('.competition-ranking').waitFor();
   const tableTop=await panel.locator('.competition-table-scroll').evaluate(el=>el.offsetTop);
   await panel.getByRole('combobox',{name:/Categoria \/ grupo/}).click();
   const afterTop=await panel.locator('.competition-table-scroll').evaluate(el=>el.offsetTop);
   assert.ok(Math.abs(afterTop-tableTop)<2,'abrir select não desloca tabela');
   await panel.getByRole('option',{name:'SUB-8 · GERAL',exact:true}).click();
   await page.waitForFunction(()=>document.querySelectorAll('.competition-ranking tbody tr').length===1);
   assert.equal(await panel.locator('tbody tr').count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await panel.screenshot({path:`test-results/competition-panel-${width}-${role}.png`});
   await panel.getByRole('button',{name:'Fechar janela',exact:true}).click();
   await page.getByRole('button',{name:'Opções de Copa do clube',exact:true}).click();
   await page.getByRole('menuitem',{name:'Regulamento',exact:true}).click();
   const rules=page.getByRole('dialog',{name:'Regulamento',exact:true});
   await rules.screenshot({path:'test-results/competition-rules-'+width+'-'+role+'.png'});
   await rules.getByRole('button',{name:'Fechar',exact:true}).click();
   if(role==='ADMIN'){
    await page.getByRole('button',{name:'Opções de Copa do clube',exact:true}).click();
    await page.getByRole('menuitem',{name:'Editar competição',exact:true}).click();
    const edit=page.getByRole('dialog',{name:'Editar competição',exact:true});
    assert.equal(await edit.getByLabel('Categorias',{exact:true}).getAttribute('readonly'),'');
    await edit.getByText('Categorias e regras estão bloqueadas',{exact:false}).waitFor();
    await edit.screenshot({path:'test-results/competition-edit-'+width+'.png'});
    await edit.getByRole('button',{name:'Cancelar',exact:true}).click();
    await page.getByRole('button',{name:'Opções de Copa do clube',exact:true}).click();await page.keyboard.press('Escape');assert.equal(await page.getByRole('menu').count(),0);
    await page.getByRole('button',{name:'Opções de Copa do clube',exact:true}).click();
    assert.equal(await page.getByRole('menuitem',{name:/Arquivar competição/}).getAttribute('aria-disabled'),'true');
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:/Finalizadas/}).click();
    await page.getByRole('button',{name:'Opções de Festival concluído',exact:true}).click();
    await page.getByRole('menuitem',{name:'Arquivar competição',exact:true}).click();
    await page.getByRole('dialog',{name:'Arquivar competição?',exact:true}).getByRole('button',{name:'Arquivar competição',exact:true}).click();
    await page.getByRole('button',{name:/Arquivadas/}).click();await page.getByRole('button',{name:'Abrir Festival concluído',exact:true}).waitFor();
    await page.getByRole('button',{name:'Opções de Festival concluído',exact:true}).click();await page.getByRole('menuitem',{name:'Restaurar competição',exact:true}).click();await page.getByRole('dialog',{name:'Restaurar competição?',exact:true}).getByRole('button',{name:'Restaurar competição',exact:true}).click();
    await page.getByRole('button',{name:/Ativas/}).click();
    await page.getByRole('button',{name:'Nova competição',exact:true}).click();const editor=page.getByRole('dialog',{name:'Nova competição',exact:true});await editor.screenshot({path:`test-results/competition-editor-${width}.png`});assert.equal(await editor.getByLabel('Nome da competição').count(),1);await editor.getByRole('button',{name:'Cancelar',exact:true}).click();
   }
   await page.getByRole('button',{name:/Finalizadas/}).click();assert.equal(await page.locator('.competition-card').count(),1);
   await page.getByRole('button',{name:/Ativas/}).click();await page.getByRole('button',{name:'Filtros',exact:true}).click();
   const filters=page.getByRole('dialog',{name:'Filtrar competições'});await filters.getByRole('combobox',{name:/Organização/}).click();await filters.getByRole('option',{name:'Competições locais',exact:true}).click();await filters.getByRole('button',{name:'Aplicar filtros',exact:true}).click();assert.equal(await page.locator('.competition-federation').count(),0);
   await page.getByRole('button',{name:'Filtros',exact:true}).click();await page.getByRole('button',{name:'Limpar filtros',exact:true}).click();await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();
   if(width===1440){await page.screenshot({path:`test-results/competitions-grid-${role}.png`,fullPage:true});if(role==='ADMIN'){const expand=page.getByRole('button',{name:'Expandir navegação',exact:true});if(await expand.count())await expand.click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}await page.getByRole('button',{name:'Lista',exact:true}).click();assert.equal(await page.locator('.competition-list').count(),1);}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:`test-results/competitions-refined-${width}-${role}.png`,fullPage:true});assert.deepEqual(errors,[]);
   console.log(`OK ${width}px/${role}: cards, federação, filtros, classificação, regras e arquivo`);await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
