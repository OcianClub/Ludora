const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.env.LUDORA_WEB_TEST_URL||'http://127.0.0.1:5191';
const output=path.resolve(__dirname,'../../../test-results/player-highlights');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try { for(const width of [320,390,820,1024,1180,1280,1440]) for(const role of ['operator','fan','guest']) {
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  await context.addInitScript(({role,width})=>{
   localStorage.setItem('ludora_tema','dark');
   localStorage.setItem('ludora_sidebar_expanded',String(width===1280));
   if(role!=='guest') { localStorage.setItem('ludora_token','test');localStorage.setItem('ludora_usuario',JSON.stringify({id:1,nome:'Alex'}));localStorage.setItem('ludora_clube',JSON.stringify({id:2,nome:'Ocian',meuPapel:role==='operator'?'ADMIN':'TORCEDOR'}));localStorage.setItem('ludora_clube_id','2'); }
   window.drawn=[]; const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(...args){window.drawn.push(args[0]);return original.apply(this,args);};
  },{role,width});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
  let visual;await require('./visual-fixture.cjs').install(page,{decorate:data=>{visual=data;}});
  await page.route('**/publico/clubes/2/*',route=>route.fulfill({json:visual[new URL(route.request().url()).pathname.split('/').pop()]||[]}));
  const players=[1,2,3,4,5,6].map((id,i)=>({jogador_id:id,numCamisa:id,titular:i<5,time_id:13,ordem:i,jogador:{nome:`Atleta Ocian ${id}`,posicao:'Fixo'}}));
  const opponent=players.map(p=>({...p,jogador_id:p.jogador_id+10,time_id:14,jogador:{nome:`Atleta Santos ${p.jogador_id}`,posicao:'Alas'}}));
  const p={id:106,status:'AO_VIVO',data:'2026-11-07',horario:'19:30',local:'Ginasio com um nome bem comprido para testar truncamento sem deslocar horario e mando',categoria_id:1,categoria:{id:1,nome:'sub-7'},mandante_id:13,visitante_id:14,mandante:{id:13,nome:'Ocian'},visitante:{id:14,nome:'Santos'},gols_mandante:1,gols_visitante:1,periodo_atual:1,versao:1,sumula_clube_id:2,titulares_necessarios:5};
  const eventos=[{id:1,tipo:'GOL',time_id:13,jogador_id:1,jogador:players[0].jogador,periodo:1},{id:2,tipo:'GOL',time_id:14,jogador_id:11,jogador:opponent[0].jogador,periodo:1},{id:3,tipo:'DEFESA',time_id:13,jogador_id:2,jogador:players[1].jogador,periodo:1}];
  let matchReads=0,playerVoteRequests=0;
  await page.route(url=>url.origin!==new URL(base).origin&&/\/(?:publico\/)?partidas\/106(?:\/gestao)?$/.test(url.pathname),route=>{matchReads++;return route.fulfill({json:{clube:{id:2,nome:'Ocian'},partida:p,organizador:{id:2,nome:'Ocian'},minhaEquipeId:role==='operator'?1:undefined,podePreparar:role==='operator',podeSumula:role==='operator',eventos,auditoria:[{id:1,acao:'PARTIDA_CRIADA',criado_em:'2026-11-07T19:00:00Z'}],equipes:[{id:1,clube_id:2,time_id:13,categoria_id:1,clube:{id:2,nome:'Ocian'},publicada_em:'2026-11-07',pronta:true,escalacao:players},{id:2,clube_id:3,time_id:14,categoria_id:2,clube:{id:3,nome:'Santos'},publicada_em:'2026-11-07',pronta:true,escalacao:opponent}]}});});
  await page.route('**/partidas/106/palpite',route=>route.fulfill({json:{partida_id:106,revisao:1,status:p.status,aberta:p.status==='AO_VIVO',total:2,votos:{MANDANTE:1,EMPATE:0,VISITANTE:1},percentuais:{MANDANTE:50,EMPATE:0,VISITANTE:50},meuVoto:null}}));
  page.on('request',request=>{if(request.url().includes('/destaques-votos'))playerVoteRequests++;});
  await page.clock.install();await page.goto(base+'/partidas/106');await page.locator('.match-highlights').waitFor();
  const globalHeader=page.locator('.workspace-header, .public-header').first();
  if(width<=760) {
   assert.equal(await globalHeader.isVisible(),false,'Sem header geral na partida mobile');
   const close=await page.getByRole('button',{name:'Voltar para partidas',exact:true}).boundingBox(),title=await page.locator('.match-detail-header h1').boundingBox();
   assert.ok(close.y<=32&&title.x>=close.x+close.width,'Apenas X e confronto no topo');
   assert.match(await page.locator('.match-detail-mobile-title').innerText(),/Ocian.*Santos/);
  } else if(await page.locator('.public-layout').count()) assert.equal(await globalHeader.isVisible(),true,'Header publico desktop preservado');
  else assert.equal(await page.locator('.sidebar').isVisible(),true,'Sidebar desktop preservada');
  assert.equal(await page.locator('.match-fan-highlight').count(),0);
  assert.doesNotMatch(await page.locator('.match-highlights').innerText(),/torcida|votar|voto/i);
  assert.equal(await page.locator('.highlight-category').count(),2);
  assert.equal(await page.locator('.live-timeline-period').count(),1);
  assert.equal(await page.locator('.live-score-card .live-card-totals').count(),0,'Cartoes ficam no Raio-X, sem contadores duplicados no placar');
  assert.equal(await page.locator('.live-score-card .live-foul-dots').count(),role==='operator'?2:0,'Faltas no placar somente para gestao ao vivo');
  if(role==='operator') {
   const finishButton=page.getByRole('button',{name:'Finalizar partida',exact:true});
   const finishBounds=await finishButton.boundingBox(),analysisBounds=await page.locator('.match-insights').boundingBox();
   assert.ok(analysisBounds.y-finishBounds.y-finishBounds.height>=32,'Encerramento separado visualmente do Raio-X');
  }
  const facts=await page.locator('.live-score-facts').evaluate(node=>({width:node.getBoundingClientRect().width,rows:[...node.children].map(item=>{const r=item.getBoundingClientRect(),icon=item.querySelector('.icon').getBoundingClientRect(),text=item.lastElementChild.getBoundingClientRect();return{width:r.width,y:r.y,center:(icon.left+text.right)/2,cellCenter:(r.left+r.right)/2,iconY:icon.y+icon.height/2,textY:text.y+text.height/2,overflow:item.scrollWidth>item.clientWidth+1};})}));
  assert.equal(facts.rows.length,3);
  for(const row of facts.rows){assert.ok(Math.abs(row.width-facts.width/3)<=1,'Tres colunas iguais no rodape');assert.ok(Math.abs(row.center-row.cellCenter)<=1,'Icone e texto centralizados na coluna');assert.ok(Math.abs(row.iconY-row.textY)<=1,'Icone e texto alinhados verticalmente');assert.equal(row.overflow,false,'Nome longo nao invade outras colunas');}

  if(await page.locator('.live-workspace').evaluate(node=>node.clientWidth)>880) {
   const layout=await page.evaluate(()=>Object.fromEntries(['.live-primary','.live-time-stepper','.live-timeline','.live-controls','.match-poll','.live-workspace'].map(selector=>{const node=document.querySelector(selector),r=node?.getBoundingClientRect();return[selector,r?{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}:null];})));
   const primary=layout['.live-primary'],timeline=layout['.live-timeline'],poll=layout['.match-poll'];
   assert.ok(Math.abs(primary.width/timeline.width-1.5)<.02,'Proporcao 60/40 preserva foco no placar');
   assert.ok(Math.abs(primary.y-timeline.y)<=1,'Acontecimentos alinhados ao topo do placar');
   if(role==='operator') {
    assert.ok(Math.abs(layout['.live-time-stepper'].bottom-timeline.bottom)<=1,'Acontecimentos terminam junto ao seletor de tempo');
    const controls=layout['.live-controls'];assert.ok(Math.abs(controls.y-poll.y)<=1&&Math.abs(controls.height-poll.height)<=1,'Votacao e controles na mesma linha e altura');
   } else {
    assert.equal(layout['.live-controls'],null);
    assert.ok(Math.abs(poll.x-timeline.x)<=1&&Math.abs(poll.width-timeline.width)<=1,'Votacao pequena na coluna secundaria');
    assert.ok(Math.abs(poll.y-timeline.bottom-12)<=1,'Votacao abaixo dos acontecimentos');
    assert.ok(timeline.height>=300,'Acontecimentos nao sao comprimidos para encaixar a votacao');
    const analysis=await page.locator('.match-insights').boundingBox(),highlights=await page.locator('.match-highlights').boundingBox();
    assert.ok(analysis.y-primary.bottom>=12&&analysis.y-primary.bottom<=26,'Raio-X preenche a coluna esquerda logo apos o tempo');
    assert.ok(Math.abs(analysis.x-primary.x)<=1&&Math.abs(analysis.width-primary.width)<=1,'Raio-X usa toda a coluna do placar');
    assert.ok(Math.abs(highlights.x-poll.x)<=1&&highlights.y-poll.bottom>=12&&highlights.y-poll.bottom<=20,'Destaques abaixo da votacao na coluna direita');
   }
  }
  if(role!=='operator'&&width===1180) {
   await page.getByRole('group',{name:'Filtrar estatísticas por tempo'}).getByRole('button',{name:'1º tempo',exact:true}).click();
   const readsBeforeResize=matchReads;
   await page.setViewportSize({width:820,height:900});await page.clock.fastForward(400);
   await page.getByRole('heading',{name:'Estatísticas do 1º tempo',exact:true}).waitFor();
   assert.equal(await page.locator('.live-main .match-insights').count(),0,'Tela estreita usa ordem vertical original');
   assert.equal(await page.locator('.match-highlights').count(),1,'Nao duplica destaques ao reorganizar');
   assert.match(await page.locator('.highlight-scope').innerText(),/1º tempo/);
   await page.setViewportSize({width,height:900});await page.clock.fastForward(400);
   await page.locator('.live-main .match-insights').waitFor();
   assert.equal(await page.locator('.match-highlights').count(),1);
   assert.match(await page.locator('.match-insights h2').innerText(),/1º tempo/,'Filtro preservado ao voltar para desktop');
   assert.equal(matchReads,readsBeforeResize,'Responsividade nao recarrega a partida');
   await page.getByRole('group',{name:'Filtrar estatísticas por tempo'}).getByRole('button',{name:'Todos',exact:true}).click();
  }
  if(role!=='operator'&&await page.locator('.live-workspace').evaluate(node=>node.clientWidth)<=880) {
   const sequence=await page.evaluate(()=>['.live-primary','.live-timeline','.match-poll','.match-insights','.match-highlights','.live-lineups'].map(selector=>document.querySelector(selector).getBoundingClientRect().y));
   assert.ok(sequence.every((top,index)=>!index||top>sequence[index-1]),'Ordem vertical do visitante preservada');
  }
  const lineupOrder = await page.evaluate(()=>{const l=document.querySelector('.live-lineups').getBoundingClientRect(),a=document.querySelector('.match-insights').getBoundingClientRect();return{lineup:l.y,analysis:a.y};});
  assert.equal(lineupOrder.lineup<lineupOrder.analysis,role==='operator','Escalacao tem prioridade operacional; visitante ve analises primeiro');
  await page.getByText('Acumulado da partida',{exact:true}).waitFor();
  assert.equal(await page.locator('.match-insights-metric').count(),4);
  assert.equal(await page.locator('.match-insights-card-summary dl>div').count(),3,'Cartoes agrupados sem perder contagens');
  if(role==='operator'&&width>=820) {
   for(let change=0;change<2;change++) {
    await page.locator('.sidebar-toggle').click();
    await page.clock.fastForward(400);
    const layout=await page.evaluate(()=>{const w=document.querySelector('.live-workspace'),p=w.querySelector('.live-primary').getBoundingClientRect(),t=w.querySelector('.live-timeline').getBoundingClientRect();return{available:w.clientWidth,primary:p.width,timeline:t.width,primaryTop:p.y,timelineTop:t.y,overflow:document.documentElement.scrollWidth>innerWidth};});
    assert.equal(layout.overflow,false,'Expandir/recolher sidebar nao cria overflow');
    if(layout.available>880) {assert.ok(Math.abs(layout.primary/layout.timeline-1.5)<.02);assert.ok(Math.abs(layout.primaryTop-layout.timelineTop)<=1);}
    else assert.ok(layout.timelineTop>layout.primaryTop,'Colunas empilham pela largura disponivel, nao apenas pela tela');
   }
  }
  await page.locator('.match-poll-options').waitFor();
  const pollLayout=await page.locator('.match-poll').evaluate(node=>{const h=node.querySelector('header').getBoundingClientRect(),o=node.querySelector('.match-poll-options').getBoundingClientRect(),s=node.querySelector('small').getBoundingClientRect();return{titleBottom:h.bottom,optionsTop:o.top,optionsBottom:o.bottom,noteTop:s.top};});
  assert.ok(pollLayout.optionsTop>=pollLayout.titleBottom&&pollLayout.noteTop>=pollLayout.optionsBottom,'Titulo acima das opcoes e explicacao abaixo, sem banner horizontal');
  assert.deepEqual(await page.locator('.match-poll-options strong').allTextContents(),['50%','0%','50%']);
  assert.ok(await page.locator('.live-timeline-period').evaluate(node=>Math.abs(node.clientWidth-node.parentElement.clientWidth+parseFloat(getComputedStyle(node.parentElement).paddingLeft)+parseFloat(getComputedStyle(node.parentElement).paddingRight))<=1),'Sem estreitamento artificial dentro do card');
  const home=await page.locator('.live-timeline-event.is-home').first().boundingBox(),away=await page.locator('.live-timeline-event.is-visitor').first().boundingBox();assert.ok(away.x>home.x);
  if(role==='operator') {
   for(const side of ['home','visitor']) {
    const event=page.locator('.live-timeline-event.is-'+side).first();
    const menu=await event.locator('summary').boundingBox(),symbol=await event.locator('.live-event-symbol').boundingBox();
    assert.ok(side==='home'?menu.x+menu.width<=symbol.x:symbol.x+symbol.width<=menu.x,'Menu na borda externa antes do icone');
    await event.locator('summary').click();
    const panel=await event.locator('.live-event-menu > div').boundingBox();assert.ok(panel.x>=0&&panel.x+panel.width<=width+1);
    await page.keyboard.press('Escape');assert.equal(await event.locator('details').getAttribute('open'),null);
   }
  }
  p.periodo_atual=2;p.local='';await page.clock.fastForward(16000);
  await page.locator('.live-score-facts.without-location').waitFor();
  const absent=await page.locator('.live-score-facts').evaluate(node=>{const bounds=node.getBoundingClientRect(),cells=[...node.children].map(item=>item.getBoundingClientRect());return{count:cells.length,divider:cells[1].x-bounds.x,half:bounds.width/2,overflow:node.scrollWidth>node.clientWidth+1};});
  assert.equal(absent.count,2);assert.ok(Math.abs(absent.divider-absent.half)<=1,'Sem local divisoria no centro');assert.equal(absent.overflow,false);

  assert.doesNotMatch(await page.locator('.match-highlights').innerText(),/torcida|votar|voto/i);
  assert.equal(playerVoteRequests,0,'Nao consulta votacao de atletas');
  assert.equal(await page.locator('.live-audit').count(),role==='operator'?1:0);
  if(role==='operator') {const log=await page.locator('.live-audit').boundingBox(),lineup=await page.locator('.live-lineups').boundingBox();assert.ok(log.y>=lineup.y+lineup.height,'Log no fim da página');}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(output,`live-${width}-${role}.png`),fullPage:true});
  await page.locator('.live-workspace').screenshot({path:path.join(output,`workspace-${width}-${role}.png`)});
  await page.locator('.match-highlights').screenshot({path:path.join(output,`highlights-${width}-${role}.png`)});
  p.status='FINALIZADA';await page.clock.fastForward(16000);await page.getByRole('heading',{name:'Resultado da partida',exact:true}).waitFor();
  assert.equal(await page.locator('.live-foul-dots').count(),0,'Sem bolinhas operacionais no pos-jogo');
  if(width<=760) assert.equal(await globalHeader.isVisible(),false,'Pos-jogo tambem usa apenas o header da partida');
  assert.equal(await page.getByRole('button',{name:'Trocar meu voto',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Desfazer último',exact:true}).count(),0);
  if(role!=='guest') {
   await page.getByRole('button',{name:'Compartilhar resultado',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Compartilhar resultado',exact:true});await page.clock.fastForward(1600);await dialog.locator('.match-image-preview img').waitFor();
   const imageWithHighlightsHeight = await dialog.locator('.match-image-preview img').evaluate(img=>img.naturalHeight);
   assert.match(await page.evaluate(()=>window.drawn.join('\n')),/DESTAQUES NOS REGISTROS/);assert.doesNotMatch(await page.evaluate(()=>window.drawn.join('\n')),/TORCIDA|Sem votos|Votação/);assert.match(await page.evaluate(()=>window.drawn.join('\n')),/Camisa 01/);assert.doesNotMatch(await page.evaluate(()=>window.drawn.join('\n')),/Atleta Ocian|Atleta Santos/);
   await dialog.getByRole('switch',{name:'Incluir nomes dos jogadores',exact:true}).click();await page.clock.fastForward(1600);await dialog.locator('.match-image-preview img[alt*="com autores"]').waitFor();assert.match(await page.evaluate(()=>window.drawn.join('\n')),/Atleta Ocian 1/);
   await page.screenshot({path:path.join(output,`share-${width}-${role}.png`)});
   await dialog.getByRole('switch',{name:'Incluir nomes dos jogadores',exact:true}).click();
   await dialog.getByRole('switch',{name:'Incluir destaques',exact:true}).click();await page.clock.fastForward(1600);await dialog.locator('.match-image-preview img').waitFor();await dialog.locator('.match-image-preview img').evaluate(img=>img.decode());
   assert.ok(await dialog.locator('.match-image-preview img').evaluate(img=>img.naturalHeight) < imageWithHighlightsHeight,'Desligar destaques remove o bloco e compacta a imagem');await page.keyboard.press('Escape');
  }
  if(width<=760) { await page.getByRole('button',{name:'Voltar para partidas',exact:true}).click();await page.waitForURL('**/partidas');await page.locator('.workspace-header:visible, .public-header:visible').first().waitFor({state:'visible'}); }
  assert.deepEqual(errors,[]);console.log(`OK destaques Ludora/menu externo ${width}px ${role}`);await context.close();
 }} finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
