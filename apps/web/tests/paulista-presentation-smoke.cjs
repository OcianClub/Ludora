// Isolated UI checks: no live API, database, federation or writes.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { prepare } = require('./responsive-audit.cjs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5192';
const event = { id: 900, ano: 2026, categoria: 'Sub-7', divisao: 'A2' };
function fixture() {
 const game = (id, stage, home, away, a, b, day) => ({ id, faseId: stage, fase: stage, sumulaId: null, mandanteId: home, visitanteId: away, golsMandante: a, golsVisitante: b, data: day, horario: '19:30', local: 'Ginásio oficial', ocorrencia: null });
 const nomes = ['Ocian','Santos Futebol Clube Associação Esportiva','A.D. Suzano','Clube Batalha','ADC Marvel','Metalúrgicos de Jundiaí','União Esportiva','Associação Esportiva de Praia Grande'];
 const equipes = nomes.map((nome, i) => ({ id: (i+1)*10, nome, escudo: null }));
 const jogos = [
  ...Array.from({length:8}, (_,i) => game('group-'+i,'FASE DE CLASSIFICAÇÃO',10,20,i%3,1,`2026-03-${String(i+1).padStart(2,'0')}`)),
  game('q1','Quartas de final PRATA',10,80,3,0,'2026-09-05'),
  game('q2','Quartas de final PRATA',20,30,2,2,'2026-09-05'), // Draw: advancement corroborated by the next published fixture.
  game('q3','Quartas de final PRATA',40,50,4,0,'2026-09-06'),
  game('q4','Quartas de final PRATA',60,70,6,2,'2026-09-06'),
  game('s1','Semifinais PRATA',30,10,6,4,'2026-09-13'),
  game('s2','Semifinais PRATA',40,60,5,3,'2026-09-13'),
  game('f1','Final PRATA',30,40,4,3,'2026-09-20'),
 ];
 const classificacao = equipes.map((e,i) => ({ faseId:'classificacao',fase:'FASE DE CLASSIFICAÇÃO',grupo:'CHAVE ÚNICA',equipeId:e.id,posicao:i===0?8:i,pontos:i===0?17:30-i,jogos:8,vitorias:5,empates:2,derrotas:1,golsPro:20,golsContra:10,saldo:10 }));
 return { evento:{id:900,versao:1,consultadoEm:'2026-11-08T00:00:00Z'},snapshot:{...event,titulo:'Campeonato Paulista',fonte:'https://eventos.admfutsal.com.br/evento/900',equipes,jogos,classificacao,avisos:[],fasesExcluidas:[]},vinculos:[{equipeId:10,clubeId:2,nome:'Ocian',escudo:null}],jogosLocais:[],pendencias:[],retroativos:[] };
}
async function choose(page,label,value) { await page.getByRole('combobox',{name:new RegExp('^'+label)}).click(); await page.getByRole('option',{name:value,exact:true}).click(); }
async function refresh(page) { await page.getByRole('button',{name:'Opções do campeonato',exact:true}).click(); await page.getByRole('menuitem',{name:'Atualizar dados',exact:true}).click(); }
async function showMap(page) { const button=page.getByRole('button',{name:'Mapa',exact:true}); if(await button.count())await button.click(); }
async function noOverflow(page) { assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'only bracket/table may scroll horizontally'); }
async function capture(page, options) {
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.screenshot(options);
}
async function expandedSidebar(page,width,role,tab) {
 if(width!==1440 || role!=='ADMIN')return;
 await page.locator('.sidebar-toggle').click();await page.waitForTimeout(250);
 await noOverflow(page);
 if(tab==='games')assert.ok(await page.locator('.paulista-fixture .match-card').evaluateAll(cards=>cards.every(e=>{
  const date=e.querySelector('time').getBoundingClientRect(),badges=e.querySelector('.match-card-badges').getBoundingClientRect();
  return date.right<=badges.left || date.bottom<=badges.top;
 })),'expanded sidebar never makes the date overlap the badges');
 await capture(page,{path:`test-results/paulista-${tab}-${width}-expanded-sidebar.png`,fullPage:true});
 await page.locator('.sidebar-toggle').click();await page.waitForTimeout(250);
}
async function mapControls(page) {
 const surface=page.locator('.paulista-flow-surface'), viewport=page.locator('.react-flow__viewport');
 const compact=await page.locator('.paulista-flow').getAttribute('data-compact')==='true';
 const moveButton=page.getByRole('button',{name:'Mover mapa',exact:true});
 assert.equal(await moveButton.count(),compact?0:1,'small map has no redundant movement toggle');
 if(!compact)assert.equal(await moveButton.getAttribute('aria-pressed'),'false');
 assert.equal(await page.getByRole('button',{name:'Voltar ao tamanho real'}).innerText(),'100%','map starts at readable actual size');
 const dimensions=await page.locator('[data-game-id="q1"]').evaluate(e=>{const r=e.getBoundingClientRect();return [r.width,r.height]});
 assert.deepEqual(dimensions,[260,compact?162:136]);
 assert.ok(await surface.evaluate(e=>e.clientHeight>= (e.closest('.paulista-flow').dataset.compact==='true'?848:768)),'whole bracket has room at actual size');
 assert.ok(await page.locator('.paulista-map-controls').evaluate(e=>{const r=e.getBoundingClientRect(),s=e.parentElement.getBoundingClientRect();return getComputedStyle(e).position==='absolute'&&r.x>=s.x&&r.right<=s.right&&r.bottom<=s.bottom;}),'all map controls float inside the canvas');
 const align=async()=>{await surface.evaluate(e=>window.scrollTo(0,window.scrollY+e.getBoundingClientRect().top-180));return surface.boundingBox();};
 const drag=async()=>{const b=await align();await page.mouse.move(b.x+b.width-30,b.y+10);await page.mouse.down();await page.mouse.move(b.x+b.width-90,b.y+30,{steps:8});await page.mouse.up();};
 if(!compact){
  await moveButton.focus();await page.keyboard.press('Space');assert.equal(await moveButton.getAttribute('aria-pressed'),'true');
  await page.keyboard.press('Space');assert.equal(await moveButton.getAttribute('aria-pressed'),'false');
  const fixed=await viewport.getAttribute('style');
  await drag();assert.equal(await viewport.getAttribute('style'),fixed,'dragging is disabled by default on desktop');
  const b=await align();await page.mouse.move(b.x+b.width-30,b.y+10);await page.mouse.wheel(0,160);await page.waitForTimeout(200);
  assert.equal(await viewport.getAttribute('style'),fixed,'scroll does not zoom a locked desktop map');
  await moveButton.click();
 }
 const beforeDrag=await viewport.getAttribute('style');
 await drag();assert.notEqual(await viewport.getAttribute('style'),beforeDrag,'movement works immediately on small screens and after enabling on desktop');
 const moved=await viewport.getAttribute('style');
 const b=await align();await page.mouse.move(b.x+b.width-30,b.y+10);await page.mouse.wheel(0,-100);await page.waitForTimeout(250);
 assert.notEqual(await viewport.getAttribute('style'),moved,'enabled wheel zoom works');
 if(!compact){await moveButton.click();const locked=await viewport.getAttribute('style');await drag();assert.equal(await viewport.getAttribute('style'),locked,'movement can be locked again');}
 await page.getByRole('button',{name:'Voltar ao tamanho real'}).click();
 assert.equal(await page.getByRole('button',{name:'Voltar ao tamanho real'}).innerText(),'100%');
 await page.getByRole('button',{name:'Ajustar à tela',exact:true}).click();
 // The fit animation lasts 180 ms. Capture its final viewport before resizing.
 await page.waitForTimeout(220);
}
async function connections(page) {
 const paths = page.locator('.paulista-connection .react-flow__edge-path');
 await paths.first().waitFor({state:'attached'});
 assert.equal(await paths.count(),6,'six advances corroborated by publication, including the draw');
 assert.equal(await page.locator('.paulista-connection.is-own').count(),1,'only own confirmed advance highlighted');
 const valid = await paths.evaluateAll(paths => paths.every(p => {
  const d=p.getAttribute('d'); const a=p.getPointAtLength(0),b=p.getPointAtLength(p.getTotalLength());
  return d && !/NaN|undefined/.test(d) && b.x>a.x && Number.isFinite(a.y+b.y);
 }));
 assert.ok(valid,'connectors follow the real cards after layout changes');
 const checkAnchors = () => {
  const root=document.querySelector('.paulista-flow'); if(!root)return false;
  const pairs=[['q1','s1'],['q2','s1'],['q3','s2'],['q4','s2'],['s1','f1'],['s2','f1']];
  const lines=[...root.querySelectorAll('.paulista-connection .react-flow__edge-path')];
  return pairs.every(([from,to])=>{
   const a=root.querySelector(`[data-game-id="${from}"]`).getBoundingClientRect();
   const b=root.querySelector(`[data-game-id="${to}"]`).getBoundingClientRect();
   return lines.some(path=>{
    const first=path.getPointAtLength(0),last=path.getPointAtLength(path.getTotalLength()),matrix=path.getScreenCTM();
    const p=new DOMPoint(first.x,first.y).matrixTransform(matrix),q=new DOMPoint(last.x,last.y).matrixTransform(matrix);
    return Math.abs(p.x-a.right)<3&&Math.abs(p.y-a.y-a.height/2)<3&&Math.abs(q.x-b.left)<3&&Math.abs(q.y-b.y-b.height/2)<3;
   });
  });
 };
 await page.waitForFunction(checkAnchors);
 assert.ok(await page.evaluate(checkAnchors),'every line remains anchored to the correct source and destination after resizing the sidebar');
 // Verify destination center lies midway between its two confirmed feeders.
 const center = id => page.locator(`[data-game-id="${id}"]`).evaluate(e=>{const r=e.getBoundingClientRect();return r.y+r.height/2;});
 assert.ok(Math.abs(await center('f1') - ((await center('s1'))+(await center('s2')))/2)<2);
}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for (const width of (process.env.PAULISTA_WIDTHS || '320,390,600,820,1024,1280,1440,1920').split(',').map(Number)) for (const role of ['ADMIN','TORCEDOR']) {
   const {page,context}=await prepare(browser,width,920,width===820?'light':'dark',{role});
   let current=fixture(); let reads=0; let failRead=false;
   const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/paulista/**',route=>{
    const r=route.request(),url=new URL(r.url());if(url.origin===base)return route.fallback();
    if(r.method()==='OPTIONS')return route.fulfill({status:204});
    if(r.method()!=='GET'){writes.push(url.pathname);return route.abort();}
    if(url.pathname.endsWith('/status'))return route.fulfill({json:{ativo:true,bancoPronto:true}});
    if(url.pathname.endsWith('/eventos'))return route.fulfill({json:[event,...[8,9,10].map((sub,i)=>({...event,id:901+i,categoria:`Sub-${sub}`}))]});
    reads++; if(failRead)return route.fulfill({status:503,json:{error:'Simulated outage'}}); return route.fulfill({json:current});
   });
   try {
    await page.goto(base+'/competicoes', {waitUntil:'domcontentloaded',timeout:30000});await page.locator('.paulista-participation-position>strong').waitFor();
    assert.match(await page.locator('.paulista-participation-position').innerText(),/8º/);
    assert.match(await page.locator('.paulista-campaign-state').innerText(),/Eliminado/);
    assert.deepEqual(await page.locator('.paulista-campaign-metrics dd').allTextContents(),['17','8','5V2E1D','+10'],'classification metrics keep their original scope and values');
    assert.equal(await page.locator('.paulista-journey [data-game-id]').count(),2,'only real published fixtures appear in the journey');
    assert.equal(await page.locator('.paulista-journey li.is-advanced').count(),1);
    assert.equal(await page.locator('.paulista-journey li.is-ended').count(),1);
    assert.equal(await page.locator('.paulista-nearby tbody tr.is-own').count(),1,'own team highlighted in summary standings');
    assert.equal(await page.locator('.paulista-journey [data-game-id="s1"]').count(),1,'latest match appears only once');
    assert.equal(await page.locator('.paulista-stage-progress li.is-unreached').count(),1,'final not reached after confirmed elimination');
    assert.equal(await page.locator('.paulista-category-band').evaluate(e=>getComputedStyle(e).borderBottomWidth),'0px');
    const categoryHeights=await page.locator('.paulista-category-band button').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));
    assert.ok(categoryHeights.every(h=>Math.abs(h-categoryHeights[0])<1),'phase and sub controls have the same height');
    assert.ok(await page.locator('.paulista-header-actions').evaluate(e=>{
     const controls=[...e.children].map(c=>c.getBoundingClientRect());
     return controls.every(r=>Math.abs(r.bottom-controls[0].bottom)<2);
    }),'season and actions share the same bottom alignment');
    const headerLayout = await page.locator('.paulista-page').evaluate(root => {
     const header=root.querySelector('.paulista-header').getBoundingClientRect(), category=root.querySelector('.paulista-category-band').getBoundingClientRect(), nav=root.querySelector('.paulista-tabs');
     return { compact:root.clientWidth<=760, headerTop:header.top, headerHeight:header.height, categoryTop:category.top, categoryBottom:category.bottom,
      navScrollbar:getComputedStyle(nav).scrollbarWidth, navWidth:nav.clientWidth, navContentWidth:nav.scrollWidth,
      division:root.querySelector('.paulista-division') && ['backgroundColor','borderTopWidth','paddingTop'].map(k=>getComputedStyle(root.querySelector('.paulista-division'))[k]),
      controls:[...root.querySelector('.paulista-header-actions').children].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,y:r.y,height:r.height};}) };
    });
    const trophy=page.locator('.paulista-participation-key .paulista-key-trophy');
    assert.equal(await trophy.innerText(),'Chave Prata','the key name accompanies the filled trophy');
    assert.ok(await trophy.evaluate(e=>{const r=e.getBoundingClientRect(),identity=e.closest('.paulista-participation-header').querySelector('.paulista-participation-identity').getBoundingClientRect();return r.left>=identity.right || r.top>=identity.bottom;}),'key sits next to the team, wrapping below only when space is insufficient');
    assert.ok(await trophy.evaluate(e=>getComputedStyle(e).color===getComputedStyle(e.querySelector('span')).color),'trophy and label share the key color');
    assert.equal(await trophy.getAttribute('aria-label'),'Chave Prata');
    assert.equal(await trophy.evaluate(e=>getComputedStyle(e).borderTopWidth),'0px');
    assert.deepEqual(await trophy.locator('svg').evaluate(e=>{const r=e.getBoundingClientRect();return [r.width,r.height]}),[30,30]);
    if(!headerLayout.compact){
     assert.ok(await page.locator('.paulista-participation-position').evaluate(e=>{const r=e.getBoundingClientRect(),card=e.closest('.paulista-participation').getBoundingClientRect();return Math.abs(r.top+r.height/2-card.top-card.height/2)<2;}),'classification block is vertically centered in the summary');
     assert.ok(await page.locator('.paulista-participation').evaluate(e=>e.getBoundingClientRect().height<=135),'desktop campaign summary is a compact band');
     assert.equal(await page.locator('.paulista-participation-position').evaluate(e=>getComputedStyle(e).borderLeftWidth),'0px');
     assert.equal(await page.locator('.paulista-header-actions .schedule-select-trigger').evaluate(e=>getComputedStyle(e).fontSize),'15px');
     assert.deepEqual(await page.locator('.paulista-menu-trigger').evaluate(e=>{const r=e.getBoundingClientRect();return [r.width,r.height]}),[36,36]);
    }
    assert.deepEqual(headerLayout.division,['rgba(0, 0, 0, 0)','0px','0px'],'division is secondary text, without a badge');
    assert.deepEqual(await page.locator('.paulista-header-actions .schedule-select-trigger').evaluate(e=>[getComputedStyle(e).backgroundColor,getComputedStyle(e).borderTopWidth]),['rgba(0, 0, 0, 0)','0px'],'season is text and chevron, without a button surface');
    assert.equal(await page.locator('.paulista-header-actions .schedule-select-chevron').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
    const year=page.locator('.paulista-header-actions .schedule-select-trigger');
    const yearBefore=await year.evaluate(e=>{const r=e.getBoundingClientRect();return [getComputedStyle(e).fontSize,r.width,r.height];});
    await year.hover();
    assert.deepEqual(await year.evaluate(e=>{const r=e.getBoundingClientRect();return [getComputedStyle(e).fontSize,r.width,r.height];}),yearBefore,'season hover never changes font size or control dimensions');
    await year.click();
    assert.deepEqual(await year.evaluate(e=>{const r=e.getBoundingClientRect();return [getComputedStyle(e).fontSize,r.width,r.height];}),yearBefore,'open season keeps the same font size and dimensions');
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Opções do campeonato',exact:true}).click();
    assert.equal(await page.getByRole('menuitem',{name:'Consultar fonte oficial em nova aba'}).getAttribute('href'),current.snapshot.fonte);
    assert.ok(await page.locator('.paulista-source-link > svg').first().evaluate(e=>getComputedStyle(e).color===getComputedStyle(document.documentElement).getPropertyValue('--primaria').trim() || getComputedStyle(e).color==='rgb(14, 120, 255)'),'source icon uses brand blue');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('menu').count(),0);
    assert.equal(headerLayout.navScrollbar,'none','tabs have no overlaid scrollbar');
    if(headerLayout.compact){
     assert.deepEqual(await page.locator('.paulista-header-actions').evaluate(e=>[e.querySelector('.schedule-select-trigger'),e.querySelector('.paulista-menu-trigger')].map(e=>e.getBoundingClientRect().height)),[28,28],'controls no longer keep an invisible 44px layout box');
     assert.ok(await page.locator('.paulista-header').evaluate(e=>{
      const title=e.querySelector('h1'),line=title.getBoundingClientRect().top+parseFloat(getComputedStyle(title).lineHeight)/2;
      return ['.schedule-select-compact-label','.paulista-menu-trigger > svg'].every(s=>{const r=e.querySelector(s).getBoundingClientRect();return Math.abs(r.top+r.height/2-line)<2;});
     }),'year and dots align with the first title line, rather than the title and division block');
     assert.ok(headerLayout.categoryBottom<=headerLayout.headerTop,'category and SUB are the first page controls on mobile');
     assert.ok(headerLayout.headerHeight<=96,'competition context stays compact');
     assert.ok(await page.locator('.paulista-tabs').evaluate(e=>{
      const r=e.getBoundingClientRect(),items=[...e.children].map(e=>e.getBoundingClientRect());
      return Math.abs(items[0].left-r.left)<1&&Math.abs(items.at(-1).right-r.right)<1&&e.scrollWidth<=e.clientWidth+1;
     }),'mobile tabs fill the available width without unused space or clipped labels');
    }else assert.ok(headerLayout.headerTop<headerLayout.categoryTop,'desktop retains title before categories');
    assert.ok(headerLayout.controls.every((r,i)=>!i||r.x>=headerLayout.controls[i-1].right),'season and actions never overlap');
    assert.equal(await page.locator('.paulista-stage-progress').isVisible(),headerLayout.compact,'phase sequence is shown only once on desktop and mobile stays unchanged');
    await noOverflow(page);
    const expectedTabSize=headerLayout.compact?['12px','40px']:['13px','44px'];
    assert.deepEqual(await page.locator('.paulista-tabs button').first().evaluate(e=>[getComputedStyle(e).fontSize,getComputedStyle(e).minHeight]),expectedTabSize,'tab text and touch height follow Partidas');
    await page.locator('.paulista-tabs button').first().focus();
    await page.keyboard.press('End');
    assert.match(page.url(),/aba=chaveamento/);
    assert.ok(await page.locator('.paulista-tabs button').last().evaluate(e=>{const r=e.getBoundingClientRect(),n=e.parentElement.getBoundingClientRect();return r.left>=n.left-1&&r.right<=n.right+1;}),'keyboard makes the final tab visible without a scrollbar');
    await page.keyboard.press('Home');
    assert.match(page.url(),/aba=visao/);
    await expandedSidebar(page,width,role,'overview');
    await capture(page,{path:`test-results/paulista-overview-${width}-${role}.png`,fullPage:true});
    await page.locator('.paulista-journey li.is-latest .paulista-journey-match').click();
    await page.getByRole('dialog',{name:'Detalhes oficiais da partida'}).waitFor();
    await page.keyboard.press('Escape');
    await page.locator('.paulista-journey-match').first().focus();await page.keyboard.press('Enter');
    await page.getByRole('dialog',{name:'Detalhes oficiais da partida'}).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Jogos',exact:true}).click();
    assert.ok(await page.locator('.paulista-game-toolbar').evaluate(e=>{
     const search=e.querySelector('.collection-search'),button=e.querySelector('.collection-filter-button'),size=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--collection-control-height'));
     return [search,button].every(e=>Math.abs(e.getBoundingClientRect().height-size)<1)&&(e.closest('.paulista-page').clientWidth>760 || Math.abs(button.getBoundingClientRect().width-size)<1);
    }),'search and filter use the shared Scout/Partidas size');
    await page.locator('.paulista-menu-trigger').hover();
    assert.deepEqual(await page.locator('.paulista-menu-trigger').evaluate(e=>{const s=getComputedStyle(e,'::after');return [s.width,s.height];}),['28px','28px'],'dots hover is a compact square');
    assert.equal(await page.locator('.paulista-fixture').count(),10,'only own matches');
    assert.equal(await page.locator('.paulista-day-group').count(),2,'different days share month grids');
    assert.equal(await page.locator('.paulista-day-group h3').first().innerText(),'Março de 2026');
    if(headerLayout.compact){
     assert.equal(await page.locator('.paulista-fixture .match-card').count(),10,'mobile restores fixture cards');
     const heights=await page.locator('.paulista-fixture .match-card').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));
     assert.ok(heights.every(h=>h<=280),'compact mobile cards stay below 280px, including knockout context');
     assert.ok(await page.getByRole('searchbox',{name:'Buscar adversário ou local'}).isVisible());
    }
    assert.ok(await page.locator('.paulista-fixture .match-card').evaluateAll(cards=>cards.every(card=>{
     const date=card.querySelector('time').getBoundingClientRect(),context=card.querySelector('.match-competition-context'),box=context.getBoundingClientRect(),badges=card.querySelector('.match-card-badges').getBoundingClientRect();
     return (badges.left>=date.right || badges.top>=date.bottom) && (getComputedStyle(context).display==='none' || Math.abs(box.left-date.left)<1 && box.top>=date.bottom && box.right<=card.getBoundingClientRect().right);
    })),'competition text starts under the date without colliding with date or badges');
    const columns=await page.locator('.paulista-fixtures-grid').first().evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);
    if(width>=1440)assert.ok(columns>=2,'desktop no longer has one match per date row');
    await page.getByRole('button',{name:'Filtrar jogos oficiais',exact:true}).click();
    await choose(page,'Etapa','Eliminatórias');
    await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();
    assert.equal(await page.locator('.paulista-fixture').count(),2);
    await page.getByRole('button',{name:'Remover filtro: Eliminatórias',exact:true}).click();
    assert.equal(await page.locator('.paulista-fixture').count(),10,'individual filter removal restores the calendar');
    if(!headerLayout.compact){
     await page.getByRole('button',{name:'Lista',exact:true}).click();
     assert.equal(await page.locator('.paulista-fixture').count(),10);
     await noOverflow(page);
     await page.getByRole('button',{name:'Cards',exact:true}).click();
    }
    if(!headerLayout.compact){
     assert.ok(await page.getByText('Mais filtros',{exact:true}).isVisible());
     assert.ok(await page.locator('.match-card-official').evaluateAll(cards=>cards.every(e=>{
      const names=[...e.querySelectorAll('.match-team strong')], badges=e.querySelector('.match-card-badges').getBoundingClientRect(), teams=e.querySelector('.match-teams').getBoundingClientRect();
      return badges.top>=teams.bottom-1 && names.every(n=>Math.abs(n.getBoundingClientRect().height-40)<1) && e.getBoundingClientRect().height<310;
     })),'desktop cards reserve two name lines and give secondary status its own compact row');
     assert.doesNotMatch(await page.locator('.match-competition-context').allTextContents().then(a=>a.join(' ')),/Campeonato Paulista|SUB-7/,'page context is not repeated in cards');
     const firstCard=page.locator('.match-card-official').first();
     await firstCard.focus();await page.keyboard.press('Enter');
     await page.getByRole('dialog',{name:'Detalhes oficiais da partida'}).waitFor();await page.keyboard.press('Escape');
     await page.getByRole('button',{name:'Filtrar jogos oficiais',exact:true}).click();
     await choose(page,'Período','setembro de 2026');await choose(page,'Ordenar por data','Mais recentes primeiro');
     await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();
     assert.equal(await page.locator('.paulista-fixture').count(),2);assert.equal(await page.locator('.paulista-fixture').first().getAttribute('data-game-id'),'s1');
     await page.getByRole('button',{name:'Filtrar jogos oficiais',exact:true}).click();await page.getByRole('button',{name:'Limpar filtros',exact:true}).click();await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();
     assert.equal(await page.locator('.paulista-fixture').count(),10);
    }
    await expandedSidebar(page,width,role,'games');
    await capture(page,{path:`test-results/paulista-games-${width}-${role}.png`,fullPage:true});
    await page.getByRole('button',{name:'Classificação',exact:true}).click();
    assert.equal(await page.getByRole('combobox',{name:/Etapa da classificação/}).count(),0,'only one published stage needs no selector');
    if(headerLayout.compact){
     assert.ok(await page.locator('.paulista-table-title').evaluate(e=>{
      const title=e.querySelector('h2').getBoundingClientRect(),count=e.querySelector('p').getBoundingClientRect();
      return count.left>title.right&&Math.abs(count.bottom-title.bottom)<5;
     }),'team count stays beside the group title');
     assert.ok(await page.locator('.paulista-table-filters .schedule-select-trigger').evaluateAll(es=>es.every(e=>Math.abs(e.getBoundingClientRect().width-e.closest('.paulista-table-heading').getBoundingClientRect().width)<1)),'standings selectors fill mobile width');
    }
    assert.equal(await page.locator('.paulista-table-scroll tbody tr[data-team-id]').last().getAttribute('class'),'is-own','official order preserved');
    await page.getByRole('button',{name:'Localizar meu clube',exact:true}).click();
    assert.equal(await page.locator('.paulista-table-scroll tr.is-located').count(),1,'locating the club gives visible temporary feedback');
    assert.ok(await page.locator('.paulista-table-scroll').evaluate(e=>{
     const head=[...e.querySelectorAll('thead th')],row=[...e.querySelector('tbody tr[data-team-id]').children];
     return head.slice(2).every((h,i)=>{const a=h.getBoundingClientRect(),b=row[i+2].getBoundingClientRect();return Math.abs(a.x+a.width/2-b.x-b.width/2)<1;});
    }),'statistic headers are centered over the corresponding values');
    if(width<=760){
     const scroll=page.locator('.paulista-table-scroll');
     const before=await scroll.locator('tbody tr[data-team-id] th').first().boundingBox();
     await scroll.evaluate(e=>{e.scrollLeft=200;});
     const after=await scroll.locator('tbody tr[data-team-id] th').first().boundingBox();
     assert.ok(Math.abs(before.x-after.x)<1,'team stays visible while browsing statistics');
     await scroll.evaluate(e=>{e.scrollLeft=0;});
    }
    await noOverflow(page);
    await expandedSidebar(page,width,role,'standings');
    await capture(page,{path:`test-results/paulista-standings-${width}-${role}.png`,fullPage:true});
    await page.getByRole('button',{name:'Chaveamento',exact:true}).click();
    if(width<=760){
     assert.equal(await page.locator('.paulista-bracket').getAttribute('data-view'),'fases');
     assert.equal(await page.locator('.paulista-bracket-heading h2').innerText(),'Chave Prata');
     assert.equal(await page.getByRole('button',{name:'Por fase',exact:true}).count(),0);
     assert.equal(await page.getByRole('button',{name:'Mapa',exact:true}).count(),1);
     assert.doesNotMatch(await page.locator('.paulista-bracket-toolbar').innerText(),/publicados|Seu clube|até/);
     const widths=await page.locator('.paulista-round-tabs button').evaluateAll(buttons=>buttons.map(b=>b.getBoundingClientRect().width));
     assert.ok(Math.max(...widths)-Math.min(...widths)<1,'round buttons share available mobile width');
     await page.getByRole('button',{name:/Quartas de final/}).click();
     assert.equal(await page.locator('.paulista-bracket-game').count(),4);await noOverflow(page);
     assert.doesNotMatch(await page.locator('.paulista-bracket-help').innerText(),/linhas/);
     await capture(page,{path:`test-results/paulista-rounds-${width}-${role}.png`,fullPage:true});
    }
    await showMap(page);
    await connections(page);await noOverflow(page);
    await mapControls(page);
    if(width===390 && role==='ADMIN'){
     const viewBefore=await page.locator('.react-flow__viewport').getAttribute('style');
     await page.setViewportSize({width:1440,height:920});
     await page.getByRole('button',{name:'Mover mapa',exact:true}).waitFor();
     assert.equal(await page.getByRole('button',{name:'Mover mapa',exact:true}).getAttribute('aria-pressed'),'false');
     await page.setViewportSize({width:390,height:920});
     await page.getByRole('button',{name:'Mover mapa',exact:true}).waitFor({state:'detached'});
     assert.ok(await page.locator('.paulista-flow.is-movable').count(),'small map automatically unlocks after resizing');
     assert.equal(await page.locator('.react-flow__viewport').getAttribute('style'),viewBefore,'responsive controls do not reset the view');
     await noOverflow(page);
    }
    await page.getByRole('button',{name:'Voltar ao tamanho real'}).click();
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await capture(page,{path:`test-results/paulista-map-actual-${width}-${role}.png`,fullPage:true});
    await page.getByRole('button',{name:'Ajustar à tela',exact:true}).click();
    await capture(page,{path:`test-results/paulista-map-fit-${width}-${role}.png`,fullPage:true});
    assert.equal(await page.locator('.paulista-bracket-game').count(),7);
    assert.equal(await page.locator('[data-game-id="q2"] .has-won').count(),0,'advancement after draw is not a score victory');
    await page.getByRole('img',{name:'A.D. Suzano avançou para a próxima fase',exact:true}).first().waitFor();
    assert.ok(await page.locator('.paulista-flow').evaluate(e=>e.clientWidth<=document.documentElement.clientWidth));
    if(role==='ADMIN'&&width>=1024){
     const toggle=page.locator('.sidebar-toggle');
     await toggle.click();await page.waitForTimeout(300);await connections(page);await noOverflow(page);
     await capture(page,{path:`test-results/paulista-bracket-${width}-sidebar-toggle.png`,fullPage:true});
     await toggle.click();await page.waitForTimeout(300);await connections(page);
    }
    await page.getByRole('button',{name:'Focar meu clube',exact:true}).click();
    await page.getByRole('button',{name:'Diminuir zoom',exact:true}).click();
    const before=await page.locator('.react-flow__viewport').getAttribute('style');
    current=fixture(); current.snapshot.jogos.find(j=>j.id==='q1').golsMandante=4;
    await refresh(page);
    await page.waitForFunction(()=>document.querySelector('[data-game-id="q1"] .paulista-bracket-team b')?.textContent==='4');
    assert.equal(await page.locator('.react-flow__viewport').getAttribute('style'),before,'refresh preserves pan and zoom');
    assert.equal(await page.locator('.paulista-bracket').getAttribute('data-view'),'mapa');
    assert.equal(await page.getByRole('button',{name:'Por fase',exact:true}).count(),1);
    assert.equal(await page.getByRole('button',{name:'Mapa',exact:true}).count(),0);
    assert.ok(reads>=2);
    current.snapshot.jogos.find(j=>j.id==='q1').golsMandante=5;
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(()=>document.querySelector('[data-game-id="q1"] .paulista-bracket-team b')?.textContent==='5');
    assert.equal(await page.locator('.react-flow__viewport').getAttribute('style'),before,'automatic refresh also preserves viewport');
    failRead=true;
    await refresh(page);
    await page.locator('.paulista-update-notice').waitFor();
    assert.equal(await page.locator('.paulista-bracket-game').count(),7,'failed refresh retains valid map');
    failRead=false; await page.getByRole('button',{name:'Tentar atualizar',exact:true}).click();
    await page.locator('.paulista-update-notice').waitFor({state:'hidden'});
    await capture(page,{path:`test-results/paulista-bracket-${width}-${role}.png`,fullPage:true});
    await page.getByRole('button',{name:'Por fase',exact:true}).click();
    await page.getByRole('button',{name:/Quartas de final/}).click();
    await page.locator('[data-game-id="q1"]').focus();await page.keyboard.press('Enter');
    await page.getByRole('dialog',{name:'Detalhes oficiais da partida'}).waitFor();
    await page.keyboard.press('Escape');
    await showMap(page);
    if(width===390 || width===1440){
     current=fixture(); current.snapshot.jogos=current.snapshot.jogos.filter(j=>!['s1','s2','f1'].includes(j.id));
     current.snapshot.jogos.find(j=>j.id==='q4').ocorrencia='WO';
     await refresh(page);
     await page.waitForFunction(()=>document.querySelectorAll('.paulista-bracket-game').length===4);
     assert.equal(await page.locator('.react-flow__edge-path').count(),0,'no future pairings invented');
     assert.equal(await page.locator('.paulista-bracket-pending').count(),2,'generic future phases, not fictitious fixtures');
     await page.locator('.paulista-bracket-warnings summary').click();
     await page.getByText('W.O. publicado: o placar não determina automaticamente quem avançou.',{exact:true}).waitFor();
     await noOverflow(page);
    }
    if(width===820 || width===1440){
     await page.getByRole('button',{name:'Visão geral',exact:true}).click();
     const accents=[];
     for(const key of ['OURO','PRATA','BRONZE']){
      current=fixture();current.snapshot.jogos=current.snapshot.jogos.map(j=>({...j,fase:j.fase.replace(/PRATA/g,key)}));
      await refresh(page);
      await page.locator(`.paulista-overview-screen.key-${key.toLowerCase()}`).waitFor();
      accents.push(await page.locator('.paulista-participation-key .paulista-medal').evaluate(e=>getComputedStyle(e).color));
      assert.equal(await page.locator('.paulista-journey [data-game-id]').count(),2,'key styling never changes published fixtures');
      await noOverflow(page);
      if(role==='ADMIN')await capture(page,{path:`test-results/paulista-overview-${key.toLowerCase()}-${width}.png`,fullPage:true});
     }
     assert.equal(new Set(accents).size,3,'gold, silver and bronze use distinct colors in both themes');
     current=fixture();current.snapshot.jogos=[];current.snapshot.classificacao=[];
     await refresh(page);
     await page.locator('.paulista-key-pending').waitFor();
     assert.deepEqual(await page.locator('.paulista-campaign-metrics dd').allTextContents(),['—','—','—','—'],'missing data never becomes zero');
     assert.equal(await page.locator('.paulista-journey [data-game-id]').count(),0);
     await noOverflow(page);
    }
    assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
    console.log(`OK ${width}px/${role}: four tabs, filters, official ordering, six corroborated connectors and refresh without losing zoom, responsive sidebar and keyboard`);
   } catch(e) { console.error(e); await capture(page,{path:`test-results/paulista-failure-${width}-${role}.png`,fullPage:true}).catch(()=>{});throw e; }
   finally { await context.close(); }
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
