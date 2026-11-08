const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const base = 'http://127.0.0.1:5192';
(async () => {
 const browser = await chromium.launch({ channel: 'msedge', headless: true });
 try {
  for (const width of [320, 390, 820, 1024, 1440]) {
   const page = await browser.newPage({ viewport: { width, height: 950 } });
   await page.addInitScript(() => {
    localStorage.setItem('ludora_token', 'visual-test-only'); localStorage.setItem('ludora_clube_id', '2');
    localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Teste' }));
    localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
    localStorage.setItem('ludora_tema', 'dark');
   });
   const errors = []; page.on('pageerror', error => errors.push(error.message));
   await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
   await require('./visual-fixture.cjs').install(page);
   let profiles = 0, saved;
   const contexts=[];
   await page.route('**/jogadores/100/scout-contexto*',route=>{
    const q=new URL(route.request().url()).searchParams; contexts.push(Object.fromEntries(q));
    return route.fulfill({json:{versao:2,jogador_id:100,total_partidas:1,
      recorte:{tipo:q.has('partida_id')?'partida':q.has('competicao_id')?'competicao':'geral',partida_id:Number(q.get('partida_id'))||null,competicao_id:Number(q.get('competicao_id'))||null,ano:null,provisorio:false},
      totais:{convocacoes:1,titularidades:1,titularidades_desconhecidas:0,gols:2,assistencias:1,defesas:0,faltas:0,amarelos:0,vermelhos:0,azuis:0,gols_contra:0},
      partidas:[{id:100,data:'2026-11-01',adversario:'Santos',gols:2,assistencias:1,defesas:0,convocado:true,status:'FINALIZADA',mandante:'Ocian',visitante:'Santos',gols_mandante:2,gols_visitante:1,eventos:[]}],
      opcoes:{temporadas:[2026],competicoes:[{id:1,nome:'Copa Ocian',ano:2026}],partidas:[{id:100,data:'2026-11-01',nome:'Ocian × Santos',status:'FINALIZADA'}]},por_tempo:[{periodo:1,gols:2,assistencias:1,defesas:0}],semelhantes:[],modelo:null}});
   });
   await page.route('**/jogadores/100', route => {
    if (route.request().method() === 'GET') { profiles++; return route.fallback(); }
    if (route.request().method() === 'PATCH') { saved = route.request().postDataJSON(); }
    return route.fallback();
   });
   await page.goto(base + '/jogadores/100');
   await page.getByRole('heading', { name: 'Registros do atleta' }).waitFor();
   assert.equal(await page.getByRole('button', { name: 'Ver Scout', exact:true }).count(), 1);
   assert.equal(await page.getByRole('heading', { name: 'Dados cadastrais' }).count(), 0);
   assert.ok(await page.locator('.player-result-vitoria').count());
   assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
   if (width < 600) {
    const editBox=await page.getByRole('button',{name:'Editar jogador',exact:true}).boundingBox();
    const scoutBox=await page.getByRole('button',{name:'Ver Scout',exact:true}).boundingBox();
    assert.ok(Math.abs(editBox.y-scoutBox.y)<1,'Ações do perfil alinhadas na mesma linha');
    assert.ok(Math.abs(editBox.width-scoutBox.width)<1,'Ações do perfil com a mesma largura');
   }
   if (width === 1440) {
    await page.getByRole('button',{name:'Expandir navegação',exact:true}).click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button',{name:'Recolher navegação',exact:true}).click();
   }
   await page.screenshot({ path: path.resolve('test-results/player-profile', `profile-${width}.png`), fullPage: true });
   await page.getByRole('button', { name: 'Editar jogador', exact: true }).click();
   const modal = page.getByRole('dialog', { name: 'Editar jogador', exact: true });
   await modal.waitFor();
   assert.ok(await modal.evaluate(el => el.scrollWidth <= el.clientWidth));
   const footer = await modal.getByRole('button', { name: 'Salvar alterações' }).boundingBox();
   assert.ok(footer.y >= 0 && footer.y + footer.height <= 950);
   await modal.getByLabel('Camisa (opcional)', { exact: true }).fill('00');
   await modal.getByRole('button', { name: 'Salvar alterações' }).click();
   await modal.getByRole('alert').filter({ hasText: /1 a 99/ }).waitFor();
   await modal.getByLabel('Camisa (opcional)', { exact: true }).fill('7');
   await modal.getByLabel('Nome completo', { exact: true }).focus();
   assert.equal(await modal.getByLabel('Camisa (opcional)', { exact: true }).inputValue(), '07');
   if (width === 390) {
    const photo = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 20; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#127bff'; ctx.fillRect(0, 0, 20, 20); return canvas.toDataURL('image/png').split(',')[1]; });
    await modal.locator('input[type=file]').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from(photo, 'base64') });
    await modal.getByAltText('Prévia da foto').waitFor();
   }
   await page.screenshot({ path: path.resolve('test-results/player-profile', `edit-${width}.png`), fullPage: true });
   await modal.getByRole('button', { name: 'Salvar alterações' }).click();
   await modal.waitFor({ state: 'hidden' });
   await page.getByRole('heading', { name: 'Registros do atleta' }).waitFor();
   assert.equal(saved.numCamisa, 7);
   if (width === 390) assert.match(saved.foto, /^data:image\/jpeg;base64,/);
   await page.getByRole('navigation', {name:'Seções do jogador'}).getByRole('link', { name: 'Partidas', exact: true }).click();
   await page.getByRole('heading', { name: 'Partidas do atleta', exact: true }).waitFor();
   await page.locator('.player-match-table').waitFor();
   const before = profiles;
   await page.getByRole('button',{name:'Mais filtros de partidas'}).click();
   await page.getByRole('dialog').getByRole('combobox',{name:/Todas as situações/}).click();
   await page.getByRole('option', { name: 'Finalizada', exact: true }).click();
   await page.getByRole('button',{name:'Aplicar filtros'}).click();
   await page.waitForURL(/status=FINALIZADA/);
   await page.locator('.player-match-table').waitFor();
   assert.equal(profiles, before, 'Filtrar histórico não recarrega a identidade do jogador');
   assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
   await page.screenshot({ path: path.resolve('test-results/player-profile', `history-${width}.png`), fullPage: true });
   await page.getByRole('button',{name:/Ver análise da partida/}).first().click();
   await page.getByRole('dialog',{name:'Ficha do atleta'}).getByRole('heading',{name:'Nesta partida',exact:true}).waitFor();
   assert.ok(contexts.at(-1).partida_id);
   await page.getByRole('dialog',{name:'Ficha do atleta'}).getByRole('button',{name:'Fechar janela',exact:true}).click();
   await page.getByRole('navigation',{name:'Seções do jogador'}).getByRole('link',{name:'Campeonatos',exact:true}).click();
   await page.locator('.player-championships').waitFor();
   await page.getByText('Inscrito · ainda sem registros em partidas finalizadas',{exact:true}).waitFor();
   assert.equal(await page.getByRole('button',{name:'Anterior',exact:true}).count(),0);
   await page.screenshot({path:path.resolve('test-results/player-profile',`championships-${width}.png`),fullPage:true});
   await page.getByRole('button',{name:'Ver análise do campeonato',exact:true}).click();
   await page.getByRole('dialog',{name:'Ficha do atleta'}).getByRole('heading',{name:'Copa Ocian',exact:true}).waitFor();
   assert.equal(contexts.at(-1).competicao_id,'1');
   await page.getByRole('dialog',{name:'Ficha do atleta'}).getByRole('button',{name:'Fechar janela',exact:true}).click();
   await page.getByRole('navigation',{name:'Seções do jogador'}).getByRole('link',{name:'Dados cadastrais',exact:true}).click();
   await page.getByRole('heading',{name:'Dados cadastrais',exact:true}).waitFor();
   assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
   if (width === 390) {
    const source={id:200,data:'2026-11-01',horario:'19:30',status:'FINALIZADA',mandante_id:10,visitante_id:20,equipe_id:10,
      mandante:{nome:'Associação com nome longo para verificar o truncamento'},visitante:{nome:'Santos'},gols_mandante:2,gols_visitante:1,resultado:'VITORIA',convocado:true,titularInicial:true,
      registros:{gols:1,assistencias:0,defesas:0,faltas:0,cartoes:0,golsContra:0}};
    let failMore=true;
    await page.route('**/jogadores/100/partidas*',route=>{
     const pageNo=Number(new URL(route.request().url()).searchParams.get('pagina')||1);
     if(pageNo===2&&failMore){return route.fulfill({status:503,json:{error:'Falha controlada'}});}
     const items=Array.from({length:25},(_,i)=>({...source,id:source.id+i})).slice((pageNo-1)*20,pageNo*20);
     return route.fulfill({json:{items,total:25,pagina:pageNo,porPagina:20}});
    });
    await page.getByRole('navigation',{name:'Seções do jogador'}).getByRole('link',{name:'Partidas',exact:true}).click();
    await page.getByRole('button',{name:'Carregar mais (5)',exact:true}).waitFor();
    assert.equal(await page.locator('.player-match-table tbody tr').count(),20);
    await page.getByRole('button',{name:'Carregar mais (5)',exact:true}).click();
    await page.getByRole('alert').waitFor();
    failMore=false;
    assert.equal(await page.locator('.player-match-table tbody tr').count(),20);
    await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.player-match-table tbody tr').length===25);
    assert.equal(await page.getByRole('button',{name:/Carregar mais/}).count(),0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
   }
   assert.deepEqual(errors, []);
   console.log(`PASS perfil ${width}: abas, resultados, Scout contextual, edição, foto, camisa e histórico`);
   await page.close();
  }
  for (const width of [320,1440]) {
   const page=await browser.newPage({viewport:{width,height:950}});
   await page.addInitScript(()=>{
    localStorage.setItem('ludora_token','visual-test-only');localStorage.setItem('ludora_clube_id','2');
    localStorage.setItem('ludora_usuario',JSON.stringify({id:1,nome:'Visitante'}));localStorage.setItem('ludora_clube',JSON.stringify({id:2,nome:'Ocian',meuPapel:'TORCEDOR'}));
   });
   await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
   await require('./visual-fixture.cjs').install(page,{role:'TORCEDOR'});
   await page.goto(base+'/jogadores/100?aba=dados');
   await page.getByRole('heading',{name:'Área de gestão do clube',exact:true}).waitFor();
   assert.equal(await page.getByRole('button',{name:'Editar jogador',exact:true}).count(),0);
   assert.equal(await page.getByText('CPF · acesso restrito',{exact:true}).count(),0);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   console.log(`PASS visitante ${width}: dados restritos e edição ausentes`);
   await page.close();
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
