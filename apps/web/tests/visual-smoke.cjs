// Executar com Playwright disponível via NODE_PATH ou instalado no workspace.
// Usa somente contas demo da seed. Capturas ficam em test-results/ (ignoradas).
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root=path.resolve(__dirname,'../../..');
const fixture=process.argv.includes('--fixture');
const account=fixture?{email:'visual@example.test',senha:'test-only'}:JSON.parse(fs.readFileSync(path.join(root,'.local-demo/contas.json'),'utf8')).find(a=>a.clube==='Ocian'&&a.cargo==='ADMIN');
const output=path.join(root,'test-results',fixture?'fixture':'real-api');fs.mkdirSync(output,{recursive:true});
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  if(fixture)await require('./visual-fixture.cjs').install(page);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto('http://localhost:5173/login');
    await page.getByRole('switch',{name:'Tema escuro'}).setChecked(true);
    const theme=await page.locator('.appearance-control').boundingBox();assert.ok(theme.width<260,'Tema precisa ser compacto');
    await page.screenshot({path:path.join(output,'login-dark.png')});
    await page.getByLabel('E-mail',{exact:true}).fill(account.email);
    await page.getByLabel('Senha',{exact:true}).fill(account.senha);
    await page.getByRole('button',{name:'Entrar',exact:true}).click();
    await page.getByRole('button',{name:'Ocian',exact:true}).click();
    await page.getByRole('heading',{name:'Momento da categoria',exact:true}).waitFor();
    await page.screenshot({path:path.join(output,'home-dark.png')});
    await page.getByRole('button',{name:'Base',exact:true}).click();
    await page.getByRole('button',{name:'SUB-14',exact:true}).click();
    assert.equal(await page.locator('.category-tabs [aria-pressed="true"]').innerText(),'SUB-14');
    assert.ok(await page.locator('.moment-result').count()<=5);
    await page.getByRole('link',{name:'Times',exact:true}).click();
    await page.locator('.team-heading').first().waitFor();
    assert.equal(await page.locator('.team-heading strong').filter({hasText:/^Estrela Azul$/}).count(),1,'Subs legados devem formar um grupo');
    const columns=page.locator('.block-column');assert.ok(await columns.count()>=2);
    assert.equal(Math.round((await columns.first().locator('.team-group').first().boundingBox()).width),Math.round((await columns.first().boundingBox()).width),'Cartão precisa ocupar a largura da própria coluna');
    const neighbor=columns.nth(1).locator('.team-group').nth(1);
    const before=await neighbor.boundingBox();
    await columns.first().locator('.team-heading').first().click();
    const after=await neighbor.boundingBox();assert.equal(after.y,before.y,'Expandir esquerda não pode deslocar direita');
    await page.screenshot({path:path.join(output,'times-expanded.png')});
    const santos=page.locator('.team-group').filter({has:page.locator('strong',{hasText:/^Santos$/})});
    await santos.locator('.team-heading').click();
    await santos.getByRole('button',{name:'Ver clube'}).click();
    await page.getByRole('button',{name:'Cancelar',exact:true}).click();
    await page.getByRole('link',{name:'Jogadores',exact:true}).click();
    await page.locator('.alunos-category').first().waitFor();
    assert.equal(await page.locator('.alunos-category header').first().evaluate(el=>getComputedStyle(el).paddingLeft),'20px');
    assert.equal(await page.locator('.alunos-category').first().locator('li').count(),5);
    const nextColumn=page.locator('.block-column').nth(1).locator('.alunos-category');
    const neighboringBefore=await nextColumn.nth(1).boundingBox();
    await page.locator('.alunos-category').first().getByRole('button',{name:/Ver mais/}).click();
    assert.ok(await page.locator('.alunos-category').first().locator('li').count()>5);
    assert.equal((await nextColumn.nth(1).boundingBox()).y,neighboringBefore.y);
    assert.equal(await nextColumn.first().locator('li').count(),5);
    await page.screenshot({path:path.join(output,'players-expanded.png')});
    await page.locator('.alunos-category').first().getByRole('button',{name:/Recolher/}).click();
    await page.getByRole('link',{name:'Elenco',exact:true}).click();
    await page.locator('.scout-player').first().waitFor();
    await page.screenshot({path:path.join(output,'scout-dark.png')});
    await page.getByRole('link',{name:'Partidas',exact:true}).click();
    await page.locator('.match-card').first().waitFor();
    if(fixture) {
      await page.locator('a[href="/partidas/106"]').first().click();
      await page.getByText(/Histórico compartilhado:/).waitFor();
      assert.equal(await page.getByRole('button',{name:'Editar partida',exact:true}).count(),0);
      await page.getByRole('button',{name:/Eventos/}).click();
      await page.locator('.evento-description').filter({hasText:'James Walker'}).waitFor();
      await page.screenshot({path:path.join(output,'shared-match-readonly.png')});
      await page.getByRole('link',{name:'Partidas',exact:true}).click();
      await page.locator('.match-card').first().waitFor();
    }
    const opponentChoice=page.locator('.choice').filter({hasText:'Adversário'});
    await opponentChoice.locator('.choice-trigger').click();
    await opponentChoice.getByRole('button',{name:'Santos',exact:true}).click();
    const cards=await page.locator('.match-teams').allTextContents();assert.ok(cards.length>0&&cards.every(text=>text.includes('Santos')));
    await page.screenshot({path:path.join(output,'matches-filtered.png')});
    await page.getByRole('link',{name:'Competições',exact:true}).click();
    await page.locator('.competition-card').first().waitFor();
    await page.locator('.competition-card').first().getByRole('button',{name:'Excluir',exact:true}).click();
    await page.getByRole('heading',{name:'Confirmar exclusão',exact:true}).waitFor();
    await page.getByRole('button',{name:'Cancelar',exact:true}).click();
    await page.getByRole('button',{name:'Lista',exact:true}).click();
    assert.equal(await page.locator('.block-column').count(),1);
    await page.screenshot({path:path.join(output,'competitions.png')});
    await page.getByRole('link',{name:'Pessoas e acessos',exact:true}).click();
    await page.locator('.member-row').first().waitFor();
    await page.screenshot({path:path.join(output,'members.png')});
    await page.getByRole('button',{name:/Notificações,/}).click();
    await page.locator('.notification-row').first().waitFor();
    await page.screenshot({path:path.join(output,'notifications.png')});
    await page.getByRole('button',{name:'Fechar janela'}).click();
    await page.locator('.sidebar').hover();
    await page.getByRole('switch',{name:'Tema escuro'}).setChecked(false);
    await page.getByRole('link',{name:'Visão geral',exact:true}).click();
    await page.getByRole('heading',{name:'Momento da categoria',exact:true}).waitFor();
    await page.screenshot({path:path.join(output,'home-light.png')});
    await page.setViewportSize({width:390,height:844});
    for(const nav of ['Visão geral','Times','Jogadores','Elenco','Partidas','Competições']) {
      if (['Times', 'Competições'].includes(nav)) {
        await page.getByRole('button', { name: 'Mais opções de navegação' }).click();
      }
      await page.getByRole('link',{name:nav,exact:true}).click();
      await page.locator('.spinner').waitFor({state:'detached'});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`Overflow em ${nav}`);
      await page.screenshot({path:path.join(output,`narrow-${nav.replace(/ /g,'-')}.png`)});
    }
    assert.deepEqual(errors,[]); console.log(`PASS (${fixture?'dados controlados, sem banco':'API real'}): tema compacto, Home por sub, grupos legados, colunas independentes, limite de cinco, navegação, filtros, notificações, confirmação interna e seis telas a 390px.`);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
