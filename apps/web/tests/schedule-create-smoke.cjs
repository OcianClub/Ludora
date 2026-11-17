const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5188';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const { width, theme } of [320, 390, 760, 820, 1366].filter(width=>!process.env.SCHEDULE_TEST_WIDTH||width===Number(process.env.SCHEDULE_TEST_WIDTH)).flatMap(width => ['dark', 'light'].map(theme => ({ width, theme })))) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(theme => {
        localStorage.setItem('ludora_token', 'visual-test-only');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex', email: 'visual@example.test' }));
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
        localStorage.setItem('ludora_clube_id', '2');
        localStorage.setItem('ludora_tema', theme);
      }, theme);
      const page = await context.newPage();
      await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      await require('./visual-fixture.cjs').install(page);
      await page.route('**/partidas/organizacao/contexto?*', route => route.fulfill({json:{recentes:[{timeId:14,clubeId:3,nome:'Santos',data:'2026-11-15'}],ultimoLocalCasa:{partidaId:100,local:'Ginásio do clube'}}}));
      await page.route('**/partidas/organizacao/conflitos?*', route => {
        const query=new URL(route.request().url()).searchParams;
        const conflito=query.get('horario')==='18:30';
        return route.fulfill({json:{conflito,mensagem:conflito?'Seu clube já tem uma partida nesta categoria e horário.':'Nenhum conflito encontrado neste horário.',partidaId:conflito?100:null,propostaId:null}});
      });
      const crest = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="royalblue"/></svg>');
      await page.route('**/times', route => route.fulfill({ json: [
        { id: 13, nome: 'Ocian', categoria_id: 1, escudo: crest, clube_representado_id: 2 },
        { id: 14, nome: 'Santos', categoria_id: 1, clube_representado_id: 3 },
        { id: 15, nome: 'Abelhas', categoria_id: 1, clube_representado_id: null },
        { id: 16, nome: 'Zebra', categoria_id: 1, clube_representado_id: null },
        ...Array.from({length:20},(_,i)=>({id:100+i,nome:`ZZ Time ${String(i+1).padStart(2,'0')}`,escudo:i===0?crest:i===1?'https://fixture.invalid/missing.png':undefined,categoria_id:1,clube_representado_id:null})),
      ] }));
      let posts = 0;
      let failSave = width === 320;
      await page.route('**/partidas', route => {
        if (route.request().method() !== 'POST') return route.fallback();
        posts++;
        if (failSave) return route.fulfill({ status: 503, json: { error: 'Database unavailable' } });
        const body = route.request().postDataJSON();
        assert.equal(body.competicao_id, undefined);
        assert.equal(body.mandante_id, width === 1366 ? 14 : 13);
        assert.equal(body.visitante_id, width === 1366 ? 13 : 14);
        assert.equal(body.emCasa, width !== 1366);
        return route.fulfill({ json: { solicitacao: { id: 'created-proposal', dados: body } } });
      });
      await page.goto(base + '/partidas');
      await page.getByRole('button', { name: 'Nova partida', exact: true }).filter({ visible: true }).click();
      const form = page.getByRole('dialog', { name: 'Organizar partida', exact: true });
      assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).overflow), 'hidden');
      if (width < 600) {
        const bounds = await form.boundingBox();
        assert.equal(bounds.y, 0);
        assert.equal(bounds.height, 900, 'Modal cobre também a área da navegação inferior');
      }
      const background = await form.evaluate(el => getComputedStyle(el).backgroundColor);
      assert.equal(background, await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor));
      await form.getByRole('button', { name: 'Selecionar categoria da partida' }).click();
      const categories = page.getByRole('dialog', { name: 'Categoria da partida', exact: true });
      assert.equal(await categories.getByRole('heading', { name: 'Iniciação', exact: true }).count(), 1);
      assert.equal(await categories.getByRole('heading', { name: 'Base', exact: true }).count(), 1);
      assert.ok(await categories.evaluate(el=>el.scrollWidth<=el.clientWidth),'Category grid fits narrow screens');
      await categories.screenshot({path:path.resolve(__dirname,`../../../test-results/web-schedule/categories-${width}-${theme}.png`)});
      await categories.getByRole('radio', { name: 'SUB-7', exact: true }).click();
      await categories.waitFor({state:'hidden'});
      assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).overflow), 'hidden', 'Fechar um modal filho mantém o fundo bloqueado');
      assert.equal(await form.getByRole('button', { name: 'Selecionar categoria da partida' }).evaluate(el => el === document.activeElement), true);
      if (width < 600) {
        await page.setViewportSize({ width, height: 520 });
        await page.waitForFunction(() => Math.abs(document.querySelector('.schedule-create-dialog').getBoundingClientRect().height - innerHeight) < 2);
        const action = await form.getByRole('button', { name: 'Organizar partida', exact: true }).boundingBox();
        assert.ok(action.y >= 0 && action.y + action.height <= 520);
        await page.setViewportSize({ width, height: 900 });
      }
      if (width === 320) {
        await form.getByRole('button', { name: 'Selecionar categoria da partida' }).click();
        await categories.getByRole('radio', { name: 'SUB-8', exact: true }).click();
        await categories.waitFor({state:'hidden'});
        assert.ok(await form.getByText('Time do clube indisponível', { exact: true }).isVisible());
        await form.getByRole('button', { name: 'Selecionar adversário', exact: true }).click();
        assert.equal(await page.getByRole('dialog', { name: 'Selecionar adversário', exact: true }).count(), 0);
        assert.equal(posts, 0, 'Categoria sem time próprio bloqueia a criação');
        await form.getByRole('button', { name: 'Selecionar categoria da partida' }).click();
        await categories.getByRole('radio', { name: 'SUB-7', exact: true }).click();
        await categories.waitFor({state:'hidden'});
        assert.ok(await form.locator('.schedule-fixed-team').getByText('Ocian', { exact: true }).isVisible());
      }
      await form.getByRole('button', { name: 'Selecionar competição', exact: true }).click();
      const competitionPanel=page.getByRole('dialog',{name:'Selecionar competição',exact:true});
      if(width>760){
        const trigger=await form.getByRole('button',{name:'Selecionar competição',exact:true}).boundingBox(),panel=await competitionPanel.boundingBox();
        assert.ok(Math.abs(trigger.width-panel.width)<2,'Competition options span the trigger width');
        assert.ok(Math.abs(trigger.x-panel.x)<2,'Competition options align with the trigger');
        if(900-trigger.y-trigger.height>200)assert.ok(panel.y>=trigger.y+trigger.height,'Prefer opening below when there is room');
      }
      assert.equal(await form.locator('.schedule-create-category > span').count(),0,'No repeated category heading');
      await competitionPanel.getByRole('button', { name: /Amistoso/ }).click();
      assert.equal(await form.locator('.schedule-fixed-team').getByText('Ocian', { exact: true }).count(), 1);
      assert.equal(await form.locator('.schedule-fixed-team button').count(), 0, 'O time do clube é fixo');
      assert.equal(await form.getByRole('button', { name: /Selecionar mandante/ }).count(), 0);
      await form.getByRole('button', { name: 'Selecionar adversário', exact: true }).click();
      const away = page.getByRole('dialog', { name: 'Selecionar adversário', exact: true });
      assert.equal(await form.locator('.schedule-create-sub').innerText(),'SUB-7');
      if(width===320){
        await page.evaluate(()=>{Object.defineProperty(window.visualViewport,'height',{configurable:true,value:420});window.visualViewport.dispatchEvent(new Event('resize'));});
        await page.waitForFunction(()=>{const box=document.querySelector('.schedule-selection-visitante').getBoundingClientRect();return box.y+box.height<=421;});
        assert.ok((await away.getByRole('searchbox').boundingBox()).y<420,'Search remains above the simulated keyboard');
        await page.evaluate(()=>{delete window.visualViewport.height;window.visualViewport.dispatchEvent(new Event('resize'));});
        await page.waitForFunction(()=>{const box=document.querySelector('.schedule-selection-visitante').getBoundingClientRect();return box.y+box.height>=899;});
      }

      assert.deepEqual(await away.locator('.match-opponent-group-heading h3').allTextContents(),['Ludora','Outros times']);
      assert.deepEqual((await away.locator('.match-opponent-option > strong').allTextContents()).slice(0,3),['Santos','Abelhas','Zebra']);
      assert.equal(await away.locator('.match-opponent-option small').count(),0,'Category and membership are not repeated on each row');
      assert.ok(await away.evaluate(el=>el.scrollWidth<=el.clientWidth),'Selector never overflows horizontally');
      const validCrest=away.getByRole('radio',{name:'ZZ Time 01',exact:true});
      await validCrest.scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>{const img=document.querySelector('[aria-label="ZZ Time 01"] img');return img?.complete&&img.naturalWidth>0&&getComputedStyle(img).visibility==='visible';});
      const failedCrest=away.getByRole('radio',{name:'ZZ Time 02',exact:true});
      await failedCrest.scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>document.querySelector('[aria-label="ZZ Time 02"] .club-badge')?.textContent==='Z');
      await away.locator('.match-opponent-list').evaluate(el=>el.scrollTop=0);
      const searchY=(await away.getByRole('searchbox').boundingBox()).y;
      await away.locator('.match-opponent-list').evaluate(el=>el.scrollTop=el.scrollHeight);
      assert.equal((await away.getByRole('searchbox').boundingBox()).y,searchY,'Search remains fixed while the list scrolls');
      await away.locator('.match-opponent-list').evaluate(el=>el.scrollTop=0);
      if(width>760){const box=await away.boundingBox();assert.ok(box.width>=550,'Desktop selector uses a larger dialog');assert.ok(await away.evaluate(el=>el.matches(':modal')),'Opponent selection uses a modal');}
      else {const box=await away.boundingBox();assert.ok(box.y+box.height>=899,'Mobile selector is attached to bottom');}
      assert.equal(await away.getByRole('radio', { name: /Ocian/ }).count(), 0, 'Seu clube não pode ser escolhido como adversário');
      await away.getByRole('button',{name:'Recentes',exact:true}).click();
      assert.deepEqual(await away.locator('.match-opponent-option > strong').allTextContents(),['Santos']);
      await away.getByRole('button',{name:'Todos',exact:true}).click();
      await away.getByRole('radio', { name: 'Santos', exact:true }).hover();
      const hover = await away.getByRole('radio', { name: 'Santos', exact:true }).evaluate(el => ({ row: getComputedStyle(el).backgroundColor, badge: getComputedStyle(el.querySelector('.club-badge')).backgroundColor, radius: parseFloat(getComputedStyle(el).borderRadius) }));
      assert.notEqual(hover.row, hover.badge);
      assert.ok(hover.radius > 0);
      await away.screenshot({path:path.resolve(__dirname,`../../../test-results/web-schedule/opponents-list-${width}-${theme}.png`)});
      await away.getByRole('searchbox').fill('Não existe');
      assert.ok(await away.getByText(/Nenhum adversário encontrado/).isVisible());
      await away.screenshot({path:path.resolve(__dirname,`../../../test-results/web-schedule/opponents-${width}-${theme}.png`)});
      await away.locator('.modal-close').click();
      assert.equal(await form.getByRole('button', { name: 'Selecionar adversário', exact: true }).evaluate(el => el === document.activeElement), true);
      await form.getByRole('button', { name: 'Selecionar adversário', exact: true }).click();
      assert.equal(await away.getByRole('searchbox').inputValue(), '');
      await away.getByRole('radio', { name: 'Santos', exact:true }).click();
      await form.getByRole('button', { name: 'Fora', exact: true }).click();
      assert.ok(await form.locator('.schedule-fixed-team').getByText('Visitante · fixo', { exact: true }).isVisible());
      await form.getByRole('button', { name: 'Em casa', exact: true }).click();
      const cards = form.locator('.schedule-create-team');
      assert.equal(await cards.count(), 2);
      assert.equal(await cards.nth(0).locator('.club-badge img').getAttribute('src'), crest);
      assert.equal(await cards.nth(1).locator('.club-badge').textContent(), 'S');
      const first = await cards.nth(0).boundingBox();
      const second = await cards.nth(1).boundingBox();
      assert.equal(first.y, second.y);
      assert.ok(second.x > first.x + first.width);
      await form.getByLabel('Horário', { exact: true }).fill('19:30');
      await form.getByRole('button', { name: 'Organizar partida', exact: true }).click();
      assert.ok(await form.getByText('Informe a data da partida.', { exact: true }).isVisible());
      assert.equal(posts, 0);
      await form.getByRole('button',{name:/^Amanhã/}).click();
      assert.equal(await form.getByRole('button',{name:/^Amanhã/}).getAttribute('aria-pressed'),'true');
      await form.getByRole('button',{name:/Usar local do último jogo em casa/}).click();
      assert.equal(await form.getByLabel('Local · opcional',{exact:true}).inputValue(),'Ginásio do clube');
      await form.getByLabel('Horário',{exact:true}).fill('18:30');
      await form.locator('.schedule-availability[data-conflict="true"]').filter({hasText:'Seu clube já tem uma partida nesta categoria e horário.'}).waitFor();
      assert.ok(await form.getByRole('button',{name:'Organizar partida',exact:true}).isDisabled());
      await form.getByLabel('Horário',{exact:true}).fill('19:30');
      await page.waitForFunction(()=>!document.querySelector('.schedule-availability'));
      assert.ok(await form.getByRole('button',{name:'Organizar partida',exact:true}).isEnabled());
      await form.getByRole('button', { name: 'Data', exact: true }).click();
      const calendar = page.getByRole('dialog', { name: 'Data da partida', exact: true });
      assert.ok(await calendar.getByRole('button', { name: 'Mês anterior', exact: true }).isDisabled(), 'Calendário impede voltar a um mês anterior ao atual');
      await calendar.getByRole('button', { name: /^Ano / }).click();
      await calendar.getByRole('button', { name: '2027', exact: true }).click();
      await calendar.getByRole('button', { name: /^Mês (?!anterior)/ }).click();
      await calendar.getByRole('button', { name: 'dezembro', exact: true }).click();
      await calendar.getByRole('button', { name: /21 de dezembro de 2027/ }).click();
      await form.getByLabel('Horário', { exact: true }).fill('25:80');
      await form.getByRole('button', { name: 'Organizar partida', exact: true }).click();
      assert.equal(posts, 0);
      assert.ok(await form.getByText('Informe um horário válido entre 00:00 e 23:59.', { exact: true }).isVisible());
      await form.getByLabel('Horário', { exact: true }).fill('19:30');
      assert.equal(await form.locator('[aria-invalid="true"]').count(), 0);

      await form.getByLabel('Local · opcional',{exact:true}).fill('Ginásio da apresentação');
      await form.getByRole('button',{name:'Fora',exact:true}).click();
      const dateBefore=await form.getByRole('button',{name:'Data',exact:true}).innerText();
      await form.getByRole('button',{name:'Selecionar categoria da partida',exact:true}).click();
      await categories.getByRole('radio',{name:'SUB-8',exact:true}).click();
      await categories.getByRole('button',{name:'Trocar para SUB-8',exact:true}).waitFor();
      assert.equal(await form.getByRole('button',{name:'Selecionar adversário: Santos',exact:true}).count(),1,'Draft category does not clear chosen opponent before confirmation');
      await categories.getByRole('button',{name:'Fechar janela',exact:true}).click();
      await form.getByRole('button',{name:'Selecionar categoria da partida',exact:true}).click();
      await categories.getByRole('radio',{name:'SUB-8',exact:true}).click();
      await categories.getByRole('button',{name:'Trocar para SUB-8',exact:true}).click();
      await categories.waitFor({state:'hidden'});
      assert.equal(await form.getByRole('button',{name:'Data',exact:true}).innerText(),dateBefore);
      assert.equal(await form.getByLabel('Horário',{exact:true}).inputValue(),'19:30');
      assert.equal(await form.getByLabel('Local · opcional',{exact:true}).inputValue(),'Ginásio da apresentação');
      assert.equal(await form.getByRole('button',{name:'Fora',exact:true}).getAttribute('aria-pressed'),'true');
      assert.equal(await form.getByRole('button',{name:'Selecionar adversário',exact:true}).count(),1);
      await form.getByRole('button',{name:'Selecionar competição',exact:true}).waitFor();
      await form.getByRole('button',{name:'Selecionar categoria da partida',exact:true}).click();
      await categories.getByRole('radio',{name:'SUB-7',exact:true}).click();
      await categories.waitFor({state:'hidden'});
      await form.getByRole('button',{name:'Selecionar adversário',exact:true}).click();
      await away.getByRole('radio',{name:'Santos',exact:true}).click();
      assert.equal(await form.getByRole('button',{name:'Fora',exact:true}).getAttribute('aria-pressed'),'true','Opponent selection preserves away venue');
      await form.getByRole('button',{name:'Selecionar adversário: Santos',exact:true}).click();
      assert.equal(await away.getByRole('radio',{name:'Santos',exact:true}).isChecked(),true,'Reopening identifies the selected opponent');
      await away.getByRole('radio',{name:'Santos',exact:true}).press('End');
      assert.match(await away.evaluate(()=>document.activeElement.getAttribute('aria-label')),/ZZ Time 20/,'Keyboard reaches last opponent');
      await away.getByRole('radio',{name:'ZZ Time 20',exact:true}).press('Home');
      await away.getByRole('radio',{name:'Santos',exact:true}).press('Escape');
      await form.getByRole('button',{name:'Em casa',exact:true}).click();

      await form.screenshot({ path: path.resolve(__dirname, `../../../test-results/web-schedule/create-${width}-${theme}.png`) });
      assert.ok(await form.evaluate(el => el.scrollWidth <= el.clientWidth));
      if (width === 1366) await form.getByRole('button', { name: 'Fora', exact: true }).click();
      await form.getByRole('button', { name: 'Organizar partida', exact: true }).click();
      const review = page.getByRole('dialog', { name: 'Revisar partida', exact: true });
      await review.waitFor();
      assert.equal(await review.getByText('SUB-7',{exact:true}).count(),1,'Review category is uppercase');
      assert.equal(await review.locator('.match-review-team').count(),2);
      assert.ok(await review.getByRole('button',{name:'Enviar proposta ao Santos',exact:true}).isVisible());
      assert.ok(await review.evaluate(el=>el.scrollWidth<=el.clientWidth),'Review fits the viewport');
      const footerY=(await review.locator('.modal-footer').boundingBox()).y;
      await review.locator('.modal-body').evaluate(el=>el.scrollTop=el.scrollHeight);
      assert.equal((await review.locator('.modal-footer').boundingBox()).y,footerY,'Review actions remain fixed while content scrolls');
      await review.screenshot({path:path.resolve(__dirname,`../../../test-results/web-schedule/review-${width}-${theme}.png`)});
      if(width===320){
        await page.setViewportSize({width,height:520});
        const actions=await review.locator('.modal-footer').boundingBox();
        assert.ok(actions.y>=0 && actions.y+actions.height<=521,'Actions remain on screen in a short mobile viewport');
        assert.ok(await review.locator('.modal-body').evaluate(el=>el.scrollHeight>el.clientHeight),'Only the summary scrolls when space is limited');
        await page.setViewportSize({width,height:900});
      }
      assert.equal(posts, 0);
      await review.getByRole('button', { name: 'Voltar e editar' }).click();
      assert.ok((await form.getByRole('button', { name: 'Data', exact: true }).textContent()).includes('21/12/2027'));
      await form.getByRole('button', { name: 'Organizar partida', exact: true }).click();
      await review.getByRole('button', { name: 'Enviar proposta' }).click();
      if (failSave) {
        await review.getByRole('alert').waitFor();
        assert.ok(await review.getByRole('alert').textContent().then(text => text.includes('Seus dados foram mantidos')));
        failSave = false;
        await review.getByRole('button', { name: 'Enviar proposta' }).click();
      }
      await review.waitFor({ state: 'hidden' });
      await page.waitForURL('**/partidas/solicitacoes?id=created-proposal');
      assert.notEqual(await page.locator('html').evaluate(el => getComputedStyle(el).overflow), 'hidden');
      assert.equal(posts, width === 320 ? 2 : 1);
      console.log(`PASS ${width}px ${theme}: contraste, cards, seleção, validação, revisão e ${width === 320 ? 'falha e recuperação' : 'confirmação'} simulada`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
