const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
for(const width of [320,820,1366]){
 const ctx=await browser.newContext({viewport:{width,height:950}});
 await ctx.addInitScript(()=>{localStorage.setItem('ludora_token','test');localStorage.setItem('ludora_usuario',JSON.stringify({id:1,nome:'Alex'}));localStorage.setItem('ludora_clube',JSON.stringify({id:2,nome:'Ocian',meuPapel:'ADMIN'}));localStorage.setItem('ludora_clube_id','2');});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await require('./visual-fixture.cjs').install(page);
 let p={id:'proposal-test',tipo:'CRIACAO',origem_id:3,destino_id:2,respondente_id:2,status:'PENDENTE',versao:1,origem:{nome:'Santos'},destino:{nome:'Ocian'},categoria_nome:'sub-7',dados:{data:'2026-11-17',horario:'20:00',local:'Quadra Santos',sugestao:{clube_id:3,motivo:'Quadra disponível neste horário',criada_em:new Date().toISOString()}}};
 const actions=[];
 await page.route('http://localhost:3000/partidas/solicitacoes',r=>r.fulfill({json:[p]}));
 await page.route('**/partidas/solicitacoes/proposal-test/responder',r=>{const b=r.request().postDataJSON();actions.push(b);p={...p,status:b.acao==='ACEITAR'?'ACEITA':'PENDENTE',versao:p.versao+1,partida_id:b.acao==='ACEITAR'?106:undefined};return r.fulfill({json:{partidaId:p.partida_id}});});
 let read=false;
 await page.route('http://localhost:3000/notificacoes?*',r=>r.fulfill({json:{notificacoes:[{id:9001,tipo:'PARTIDA_AGENDADA',titulo:'Santos sugeriu uma alteração',corpo:'Seu clube precisa responder.',lida:read,partida_id:null,dados:{solicitacaoId:p.id,clubeId:2},criada_em:new Date().toISOString()}],totalNaoLidas:read?0:1}}));
 await page.route('http://localhost:3000/notificacoes/9001/lida',r=>{read=true;return r.fulfill({json:{ok:true}});});
 await page.goto('http://127.0.0.1:5187/dashboard');
 await page.getByRole('button',{name:'Notificações, 1 não lidas',exact:true}).click();
 await page.getByRole('button',{name:/Santos sugeriu uma alteração.*Ver solicitação/}).click();
 await page.waitForURL('**/partidas/solicitacoes?id=proposal-test');
 assert.equal(read,true);
 assert.match(await page.locator('.shared-proposal').innerText(),/Santos sugeriu novos dados/);
 assert.match(await page.locator('.shared-proposal').innerText(),/Quadra disponível neste horário/);
 await page.getByRole('button',{name:'Aceitar',exact:true}).waitFor();
 assert.match(await page.locator('.shared-proposal-title').innerText(),/SUB-7/);
 await page.getByRole('button',{name:'Aceitar',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Aceitar proposta'});await dialog.waitFor();assert.match(await dialog.innerText(),/20:00/);
 await dialog.getByRole('button',{name:'Voltar',exact:true}).click();assert.equal(actions.length,0);
 await page.getByRole('button',{name:'Sugerir alteração',exact:true}).click();await page.getByRole('dialog',{name:'Sugerir alteração'}).waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByRole('dialog').getByRole('button',{name:'Voltar',exact:true}).click();
 await page.getByRole('button',{name:'Aceitar',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirmar',exact:true}).click();
 await page.getByText('Nenhuma solicitação pendente.',{exact:true}).waitFor();
 assert.equal(actions[0].versao,1);await page.getByRole('button',{name:'Todas',exact:true}).click();await page.getByRole('link',{name:'Abrir partida'}).waitFor();
 assert.deepEqual(errors,[]);console.log(`Proposals OK ${width}px: category, confirmation data, counterproposal dialog and accepted match link`);await ctx.close();
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
