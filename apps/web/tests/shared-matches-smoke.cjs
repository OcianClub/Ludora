const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
fs.mkdirSync('test-results/shared-matches',{recursive:true});
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    for(const width of [320,820,1366]) {
      const context=await browser.newContext({viewport:{width,height:950}});
      await context.addInitScript(()=>{
        localStorage.setItem('ludora_token','test');localStorage.setItem('ludora_tema','dark');
        localStorage.setItem('ludora_usuario',JSON.stringify({id:1,nome:'Alex'}));
        localStorage.setItem('ludora_clube',JSON.stringify({id:2,nome:'Ocian',meuPapel:'ADMIN'}));localStorage.setItem('ludora_clube_id','2');
      });
      const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
      await require('./visual-fixture.cjs').install(page);
      const players=Array.from({length:6},(_,i)=>({id:100+i,nome:`Atleta ${i+1}`,posicao:'Fixo',numCamisa:i+1}));
      const lineup=players.map((j,i)=>({jogador_id:j.id,numCamisa:i+1,titular:i<5,jogador:j,time_id:13}));
      let ready=false,other=false,operator=false,status='AGENDADA';
      const match=()=>({id:106,status,versao:1,titulares_necessarios:5,periodo_atual:1,sumula_clube_id:operator?2:3,organizador_id:3,data:'2026-10-29',horario:'19:30',local:'Quadra compartilhada',categoria_id:99,categoria:{id:99,nome:'sub-7'},mandante_id:14,visitante_id:13,mandante:{id:14,nome:'Santos'},visitante:{id:13,nome:'Ocian'},gols_mandante:0,gols_visitante:0});
      await page.route('**/jogadores/perfis?*',r=>r.fulfill({json:players}));
      await page.route('**/partidas/106/gestao',r=>r.fulfill({json:{partida:match(),organizador:{id:3,nome:'Santos'},podePreparar:true,podeSumula:operator,minhaEquipeId:1,eventos:[],auditoria:[],equipes:[{id:1,clube_id:2,time_id:13,categoria_id:1,categoria:{id:1,nome:'sub-7'},clube:{id:2,nome:'Ocian'},pronta:ready,publicada_em:ready?'2026-10-29':null,escalacao:lineup},{id:2,clube_id:3,time_id:14,categoria_id:99,categoria:{id:99,nome:'sub-7'},clube:{id:3,nome:'Santos'},pronta:other,publicada_em:other?'2026-10-29':null,escalacao:other?lineup.map(j=>({...j,jogador_id:j.jogador_id+100,time_id:14})):[]} ]}}));
      await page.route('**/partidas/106/preparacao',r=>{ready=true;return r.fulfill({json:{}});});
      await page.route('**/partidas/106/status',r=>{status=r.request().postDataJSON().status;return r.fulfill({json:match()});});
      async function review() { await page.getByRole('navigation', { name: 'Etapas da preparação' }).getByRole('button', { name: 'Revisão' }).click(); await page.getByRole('heading', { name: 'Tudo certo para jogar?' }).waitFor(); }
      await page.goto('http://127.0.0.1:5187/partidas/106');await review();
      assert.match(await page.locator('.match-readiness').innerText(),/Santos/);
      await page.getByRole('button',{name:'Confirmar preparação',exact:true}).click();
      await page.getByText('Aguardando a outra equipe ou o responsável iniciar.',{exact:true}).waitFor();
      assert.equal(await page.getByRole('button',{name:'Iniciar partida',exact:true}).count(),0);
      other=true;status='PREPARADA';await page.reload();await review();
      assert.equal(await page.getByRole('button',{name:'Iniciar partida',exact:true}).count(),0);
      operator=true;await page.reload();await review();
      await page.getByRole('button',{name:'Iniciar partida',exact:true}).click();
      await page.getByRole('heading',{name:'Eventos da partida',exact:true}).waitFor();
      await page.getByRole('button',{name:'Santos',exact:true}).click();
      assert.equal(await page.locator('.lineup-row').count(),6);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:`test-results/shared-matches/live-${width}.png`});
      assert.deepEqual(errors,[]);
      console.log(`Shared flow OK ${width}px: own preparation, waiting, operator permission and both published lineups`);
      await context.close();
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
