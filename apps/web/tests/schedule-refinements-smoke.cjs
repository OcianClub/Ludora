const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [360, 390, 768, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(() => {
        localStorage.setItem('ludora_token', 'test');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
        localStorage.setItem('ludora_clube_id', '2');
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const cat = { id: 1, nome: 'sub-7', tipo: 'INICIACAO', clube_id: 2 };
      const dataFutura = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const rows = ['AO_VIVO', 'PREPARADA', 'AGENDADA', 'PREPARADA'].map((status, i) => ({ id: 500+i, status, categoria: cat, categoria_id: 1, organizador_id: i===3 ? 3 : 2, data: dataFutura, horario: i===1 ? '20:00' : '19:00', mandante_id: 13, visitante_id: 14, mandante: {nome:'Ocian'}, visitante:{nome:'Santos'}, gols_mandante:0,gols_visitante:0,emCasa:true }));
      const historico = Array.from({ length: 13 }, (_, i) => ({ ...rows[0], id: 600 + i, status: 'FINALIZADA', data: '2026-01-10' }));
      await require('./visual-fixture.cjs').install(page, { decorate: ({ partidas }) => partidas.splice(0, partidas.length, ...rows, ...historico) });
      await page.route('**/partidas/solicitacoes', route => route.fulfill({ json: [{ id:'p1', status:'PENDENTE', respondente_id:2 }, { id:'p2', status:'PENDENTE', respondente_id:3 }] }));
      await page.goto('http://127.0.0.1:5187/partidas?status=TODAS');
      await page.locator('.schedule-presentation-toolbar').waitFor({timeout:6000}).catch(async e => { console.log(errors, await page.locator('body').innerText()); throw e; });
      const badge = page.locator(width < 760 ? '.schedule-mobile-requests .schedule-request-badge' : '.schedule-header-actions .schedule-request-badge');
      assert.equal(await badge.textContent(), '1');
      const toolbar = await page.locator('.schedule-presentation-toolbar').boundingBox();
      const live = await page.locator('.schedule-status-section').first().boundingBox();
      assert.ok(toolbar.y >= live.y+live.height-1);
      const upcoming = await page.locator('.schedule-status-section').nth(1).boundingBox();
      assert.ok(upcoming.y - toolbar.y - toolbar.height <= 10, 'Contagem e visualização próximas do acordeão');
      const requestButton = page.locator(width <= 760 ? '.schedule-mobile-requests' : '.schedule-header-actions > a');
      const reference = page.locator(width <= 760 ? '.schedule-mobile-search' : '.schedule-desktop-new');
      assert.equal((await requestButton.boundingBox()).height, (await reference.boundingBox()).height, 'Solicitações com a mesma altura do controle ao lado');
      if (width <= 760) {
        const fab = page.locator('.schedule-mobile-new');
        const box = await fab.boundingBox();
        assert.ok(box.width >= 48 && box.height >= 48, 'FAB com área de toque adequada');
        await assert.doesNotReject(() => fab.locator('.icon').waitFor({ state: 'visible' }));
        await fab.click();
        await page.getByRole('dialog', { name: 'Organizar partida', exact: true }).waitFor();
        await page.keyboard.press('Escape');
      }
      await page.goto('http://127.0.0.1:5187/partidas?status=AO_VIVO');
      await page.locator('.match-card').first().waitFor();
      assert.equal(await page.getByRole('group', { name: 'Visualização das partidas' }).count(), 0, 'Ao vivo sem seletor Cards/Lista');
      await page.goto('http://127.0.0.1:5187/partidas?status=TODAS');
      await page.locator('.schedule-presentation-toolbar').waitFor();
      await page.getByRole('button', { name: width < 760 ? 'Filtros' : 'Mais filtros', exact: true }).click();
      const dialog=page.getByRole('dialog');
      await dialog.getByRole('switch', { name:'Somente partidas organizadas pelo meu clube',exact:true }).click();
      await dialog.getByRole('radio', { name:'Preparadas',exact:true }).check();
      await dialog.getByRole('button', { name:'Aplicar filtros',exact:true }).click();
      await dialog.waitFor({state:'detached'});
      assert.match(page.url(), /organizadas=clube/);
      assert.match(page.url(), /status=PREPARADA/);
      await page.locator('.match-card').first().waitFor({timeout:5000}).catch(async e => { console.log(page.url(), await page.locator('body').innerText()); throw e; });
      assert.equal(await page.locator('.match-card').count(),1);
      await page.goto('http://127.0.0.1:5187/partidas?status=FINALIZADA');
      await page.getByRole('button', { name:'Mostrar mais partidas (1)', exact:true }).waitFor();
      assert.equal(await page.locator('.match-card').count(),12);
      const consultaPagina = page.waitForRequest(r => new URL(r.url()).searchParams.get('apos') === '12');
      await page.getByRole('button', { name:'Mostrar mais partidas (1)', exact:true }).click();
      await consultaPagina;
      await page.getByRole('button', { name:'Mostrar mais partidas (1)', exact:true }).waitFor({ state: 'hidden' });
      assert.equal(await page.locator('.match-card').count(),13);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors,[]);
      console.log(`Schedule OK ${width}px: badge, toolbar placement, organizer and preparation filters, overflow`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
