const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.LUDORA_WEB_TEST_URL||'http://127.0.0.1:5188';
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    async function setup(role='ADMIN',playerCount=35){
      const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
      await context.addInitScript(role=>{localStorage.setItem('ludora_token','visual-test-only');localStorage.setItem('ludora_usuario',JSON.stringify({id:1,nome:'Alex',email:'test@example.test'}));localStorage.setItem('ludora_clube_id','2');localStorage.setItem('ludora_clube',JSON.stringify({id:2,nome:'Ocian',meuPapel:role}));},role);
      const page=await context.newPage();await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
      await require('./visual-fixture.cjs').install(page,{role,playerCount});return {context,page};
    }
    const {context,page}=await setup();let mode='slow';
    await page.route('**/jogadores?**',async r=>{
      if(mode==='error')return r.fulfill({status:503,json:{error:'Falha controlada de teste'}});
      if(mode==='empty')return r.fulfill({json:[]});
      if(mode==='old')return r.fulfill({json:[{id:1,nome:'Old API',categoria_id:1}]});
      if(mode==='slow')await new Promise(resolve=>setTimeout(resolve,400));return r.fallback();
    });
    await page.goto(base+'/jogadores');await page.getByLabel('Carregando').waitFor();await page.locator('.alunos-category').first().waitFor();
    mode='error';await page.getByLabel('Buscar aluno').fill('James');await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').innerText(),/Falha controlada/);
    mode='normal';await page.getByRole('button',{name:'Tentar novamente'}).click();await page.locator('.alunos-category').first().waitFor();
    await page.getByLabel('Buscar aluno').fill('');await page.waitForTimeout(450);
    const category=page.locator('.alunos-category').first();await category.locator('.alunos-category-toggle').tap();
    await page.waitForFunction(()=>document.querySelector('.alunos-students')?.children.length===5);
    await category.getByRole('button',{name:/Mostrar mais/}).tap();await page.waitForFunction(()=>document.querySelector('.alunos-students')?.children.length===35);
    await category.locator('.alunos-category-toggle').focus();await page.keyboard.press('Enter');assert.equal(await category.locator('[hidden]').count(),1);
    mode='old';await page.getByLabel('Buscar aluno').fill('legacy');await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/API em execução precisa ser atualizada/);
    mode='empty';await page.getByRole('button',{name:'Tentar novamente'}).click();await category.waitFor();await category.locator('.alunos-category-toggle').tap();
    await category.getByText('Nenhum aluno encontrado nesta categoria.').waitFor();
    await context.close();console.log('PASS estados: 35 jogadores, cinco iniciais, carregar restante, toque, teclado, vazio, erro, recuperação, API antiga');
    const guest=await setup('TORCEDOR',8);await guest.page.goto(base+'/jogadores/100');await guest.page.getByRole('heading',{name:'Adam Hayes',exact:true}).waitFor();
    assert.equal(await guest.page.getByText('CPF · acesso restrito').count(),0);assert.equal(await guest.page.getByRole('button',{name:'Editar jogador',exact:true}).count(),0);await guest.context.close();
    const admin=await setup('ADMIN',8);await admin.page.goto(base+'/jogadores/100');await admin.page.getByRole('button',{name:'Editar jogador',exact:true}).click();
    const dialog=admin.page.getByRole('dialog',{name:'Editar jogador',exact:true});
    const avatar=await admin.page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#087bff';ctx.fillRect(0,0,64,64);return canvas.toDataURL('image/png').split(',')[1];});
    await dialog.locator('input[type=file]').setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:Buffer.from(avatar,'base64')});
    await dialog.getByAltText('Prévia da foto').waitFor();await dialog.getByRole('button',{name:'Salvar jogador'}).click();await dialog.waitFor({state:'hidden'});
    assert.ok(await admin.page.getByAltText('Foto de Adam Hayes').isVisible());
    await admin.context.close();console.log('PASS perfil: CPF e edição restritos; foto compactada e salva');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
