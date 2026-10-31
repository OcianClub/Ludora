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
      let ready=false,other=false,operator=false,status='AGENDADA',transfers=0;
      await page.route('**/partidas/106/sumula',r=>{transfers++;return r.fulfill({json:{}});});
      const match=()=>({id:106,status,versao:1,titulares_necessarios:5,periodo_atual:1,sumula_clube_id:operator?2:3,organizador_id:3,data:'2026-10-29',horario:'19:30',local:'Quadra compartilhada',categoria_id:99,categoria:{id:99,nome:'sub-7'},mandante_id:14,visitante_id:13,mandante:{id:14,nome:'Santos'},visitante:{id:13,nome:'Ocian'},gols_mandante:0,gols_visitante:0});
      await page.route('**/jogadores/perfis?*',r=>r.fulfill({json:players}));
      await page.route('**/partidas/106/gestao',r=>r.fulfill({json:{partida:match(),organizador:{id:3,nome:'Santos'},podePreparar:true,podeSumula:operator,minhaEquipeId:1,eventos:[],auditoria:[],equipes:[{id:1,clube_id:2,time_id:13,categoria_id:1,categoria:{id:1,nome:'sub-7'},clube:{id:2,nome:'Ocian'},pronta:ready,publicada_em:ready?'2026-10-29':null,escalacao:lineup},{id:2,clube_id:3,time_id:14,categoria_id:99,categoria:{id:99,nome:'sub-7'},clube:{id:3,nome:'Santos'},pronta:other,publicada_em:other?'2026-10-29':null,escalacao:other?lineup.map(j=>({...j,jogador_id:j.jogador_id+100,time_id:14})):[]} ]}}));
      await page.route('**/partidas/106/preparacao',r=>{ready=true;return r.fulfill({json:{}});});
      await page.route('**/partidas/106/status',r=>{status=r.request().postDataJSON().status;return r.fulfill({json:match()});});
      async function review() { await page.getByRole('navigation', { name: 'Etapas da preparação' }).getByRole('button', { name: 'Revisão' }).click(); await page.getByRole('heading', { name: 'Revise sua equipe' }).waitFor(); }
      await page.goto('http://127.0.0.1:5187/partidas/106');
      const opponentButton = page.getByRole('button', {name:'Ver escalação adversária'});
      await opponentButton.click();
      const opponentDialog = page.getByRole('dialog', {name:'Escalação do Santos'});
      await opponentDialog.waitFor();
      assert.equal(await opponentDialog.locator('.lineup-row').count(),0);
      assert.match(await opponentDialog.innerText(),/rascunhos são privados/);
      await page.keyboard.press('Escape');
      assert.ok(await opponentButton.evaluate(el=>el===document.activeElement));
      assert.equal(await page.locator('.shared-published-preview').count(),0);
      await page.getByRole('button',{name:'Ações da partida'}).click();
      assert.equal(await page.getByRole('menuitem',{name:'Cancelar partida'}).count(),0);
      await page.getByRole('menuitem',{name:'Responsável pela súmula'}).click();
      const responsibleDialog=page.getByRole('dialog',{name:'Responsável pela súmula'});
      await responsibleDialog.waitFor();
      assert.match(await responsibleDialog.innerText(),/Santos/);
      assert.equal(await responsibleDialog.getByRole('button',{name:'Solicitar transferência'}).count(),0);
      await page.keyboard.press('Escape');
      await review();
      assert.match(await page.locator('.preparation-context-header').innerText(),/Santos/);
      assert.equal(await page.locator('.preparation-review-team').count(),2);
      assert.match(await page.locator('.preparation-review-team').nth(0).innerText(), /Aguardando o clube publicar/);
      assert.equal(await page.locator('.preparation-review-team').nth(0).locator('li').count(),0);
      assert.equal(await page.locator('.preparation-review-team').nth(1).locator('li').count(),6);
      await page.getByRole('button',{name:'Confirmar minha equipe',exact:true}).click();
      await page.getByText('Aguardando confirmação do Santos.',{exact:true}).waitFor();
      assert.equal(await page.getByRole('button',{name:'Iniciar partida',exact:true}).count(),0);
      other=true;status='PREPARADA';await page.reload();await review();
      await page.getByRole('navigation',{name:'Etapas da preparação'}).getByRole('button',{name:'Dados'}).click();
      await page.getByRole('button',{name:'Ver escalação adversária'}).click();
      await opponentDialog.waitFor();
      assert.equal(await opponentDialog.locator('.lineup-row').count(),6);
      assert.equal(await opponentDialog.getByRole('button',{name:/Remover|Convocar|Editar camisa/}).count(),0);
      assert.ok(await opponentDialog.evaluate(el=>el.scrollWidth<=el.clientWidth));
      await opponentDialog.screenshot({path:`test-results/shared-matches/opponent-${width}.png`});

      await page.keyboard.press('Escape');
      await review();
      for(const team of await page.locator('.preparation-review-team').all()) assert.equal(await team.locator('li').count(),6);
      const left=await page.locator('.preparation-review-team').nth(0).boundingBox();
      const right=await page.locator('.preparation-review-team').nth(1).boundingBox();
      if(width>600) assert.ok(right.x>left.x+left.width && Math.abs(left.y-right.y)<1);
      else {
        assert.ok(right.y>=left.y+left.height+40);
        assert.equal(await page.locator('.preparation-review-team').nth(1).evaluate(el=>getComputedStyle(el,'::before').borderTopStyle),'solid');
      }
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      const footer=await page.locator('.preparation-footer').boundingBox();
      assert.ok(footer.y>=Math.max(left.y+left.height,right.y+right.height), 'Footer must follow the complete rosters');
      await page.screenshot({path:`test-results/shared-matches/review-${width}.png`,fullPage:true});
      assert.equal(await page.getByRole('button',{name:'Iniciar partida',exact:true}).count(),0);
      operator=true;await page.reload();await review();
      await page.getByRole('button',{name:'Ações da partida'}).click();
      await page.getByRole('menuitem',{name:'Responsável pela súmula'}).click();
      await responsibleDialog.waitFor();
      const dialogBox = await responsibleDialog.boundingBox();
      const transferBox = await responsibleDialog.getByRole('button',{name:'Solicitar transferência'}).boundingBox();
      assert.ok(dialogBox.x + dialogBox.width - transferBox.x - transferBox.width >= 14);
      assert.ok(dialogBox.y + dialogBox.height - transferBox.y - transferBox.height >= 12);
      assert.ok(await responsibleDialog.evaluate(el=>el.scrollWidth<=el.clientWidth));
      await responsibleDialog.screenshot({path:`test-results/shared-matches/responsibility-${width}.png`});
      await responsibleDialog.getByRole('button',{name:'Solicitar transferência'}).click();
      await responsibleDialog.waitFor({state:'hidden'});
      assert.equal(transfers,1);
      assert.match(await page.locator('.preparation-inline-feedback').innerText(),/continua responsável até o aceite/);
      assert.equal(status,'PREPARADA');
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
