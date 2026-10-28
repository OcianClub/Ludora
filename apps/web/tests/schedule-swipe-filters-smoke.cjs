const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5189';
const output = path.resolve(__dirname, '../../../test-results/web-filter-flow');

async function swipe(page, locator) {
  const bounds = await locator.boundingBox();
  const x = bounds.x + bounds.width * .75;
  const y = bounds.y + Math.min(20, bounds.height / 2);
  const before = await page.locator('.home-sub-indicator').evaluate(element => element.style.transform);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - Math.min(170, bounds.width * .6), y, { steps: 10 });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  assert.ok(await page.locator('.home-pager-track').evaluate(element => new DOMMatrix(getComputedStyle(element).transform).m41 < -20));
  assert.notEqual(await page.locator('.home-sub-indicator').evaluate(element => element.style.transform), before);
  assert.ok(await page.evaluate(() => {
    const current = document.querySelector('.home-pager-current').getBoundingClientRect();
    const next = document.querySelector('.home-pager-preview[data-offset="1"]').getBoundingClientRect();
    return next.x - current.right >= 19;
  }), 'Espaço entre páginas durante o arraste');
  await page.mouse.up();
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 820, 1366]) {
      const mobile = width <= 760;
      const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: mobile, isMobile: mobile });
      await context.addInitScript(() => {
        localStorage.setItem('ludora_token', 'filter-flow-test');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
        localStorage.setItem('ludora_clube_id', '2');
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
        if (!localStorage.getItem('ludora_tema')) localStorage.setItem('ludora_tema', 'dark');
      });
      const page = await context.newPage();
      const errors = [];
      let requests = 0;
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (new URL(request.url()).pathname === '/partidas') requests++; });
      await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      await require('./visual-fixture.cjs').install(page);
      const games = [7, 8, 9, 10, 12, 14, 16, 18].flatMap((sub, categoryIndex) => Array.from({ length: 5 }, (_, index) => ({
        id: categoryIndex * 100 + index + 1,
        categoria_id: categoryIndex + 1,
        categoria: { id: categoryIndex + 1, nome: `sub-${sub}`, tipo: sub <= 10 ? 'INICIACAO' : 'BASE' },
        mandante_id: 1, visitante_id: 2,
        mandante: { id: 1, nome: 'Ocian' }, visitante: { id: 2, nome: 'Santos' },
        gols_mandante: 1, gols_visitante: 0,
        data: new Date().toISOString(), horario: '18:30', emCasa: true, status: 'AO_VIVO',
      })));
      await page.route('http://localhost:3000/partidas?*', route => route.fulfill({ json: games }));
      await page.goto(base + '/partidas');
      const current = page.locator('.home-pager-current');
      await current.locator('.match-card').first().waitFor();
      const initialRequests = requests;
      await swipe(page, current.locator('.schedule-live-heading > div').first());
      await page.waitForFunction(() => document.querySelector('.home-sub-strip button[aria-pressed="true"]')?.textContent === 'SUB-8');
      assert.ok((await current.locator('.match-card-header > span:first-child').allTextContents()).every(text => text === 'sub-8'));
      assert.equal(requests, initialRequests, 'Trocar sub reutiliza os dados já carregados');
      const live = current.getByRole('region', { name: 'Carrossel de partidas ao vivo' });
      const liveBounds = await live.boundingBox();
      if (mobile) {
        const session = await context.newCDPSession(page);
        const x = liveBounds.x + liveBounds.width * .8;
        const y = liveBounds.y + 75;
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let step = 1; step <= 10; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - step * 13, y }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(liveBounds.x + liveBounds.width * .6, liveBounds.y + 75);
        await page.mouse.down();
        await page.mouse.move(liveBounds.x + liveBounds.width * .6 - 150, liveBounds.y + 75, { steps: 10 });
        await page.mouse.up();
      }
      assert.ok(await live.evaluate(element => element.scrollLeft > 30), 'Carrossel ao vivo mantém arraste próprio');
      assert.equal(await page.getByRole('button', { name: 'SUB-8', exact: true }).getAttribute('aria-pressed'), 'true');
      const open = page.getByRole('button', { name: mobile ? 'Filtros' : 'Mais filtros', exact: true });
      await open.click();
      const filters = page.getByRole('dialog', { name: mobile ? 'Filtrar partidas' : 'Mais filtros', exact: true });
      assert.equal(await filters.getByRole('group', { name: /^(Categoria|Sub)$/ }).count(), 0);
      assert.equal(await filters.getByRole('button', { name: 'Cancelar', exact: true }).count(), 0);
      if (mobile) {
        const search = filters.getByRole('searchbox', { name: 'Buscar time, adversário ou local' });
        assert.equal(await search.locator('..').locator('.icon').count(), 1);
        assert.ok(await search.locator('..').locator('label').evaluate(element => element.offsetWidth <= 1 && element.offsetHeight <= 1));
        await search.fill('rascunho');
        await filters.getByRole('button', { name: 'Fechar janela', exact: true }).click();
        assert.equal(new URL(page.url()).searchParams.get('busca'), null);
        await open.click();
        assert.equal(await search.inputValue(), '');
        await page.evaluate(() => {
          Object.defineProperty(visualViewport, 'height', { configurable: true, value: 360 });
          visualViewport.dispatchEvent(new Event('resize'));
        });
        const applyBounds = await filters.getByRole('button', { name: 'Aplicar filtros', exact: true }).boundingBox();
        assert.ok(applyBounds.y + applyBounds.height <= 361, 'Aplicar continua acessível com teclado simulado');
        await page.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
      }
      for (const theme of ['dark', 'light']) {
        await page.evaluate(value => localStorage.setItem('ludora_tema', value), theme);
        await page.reload();
        await current.locator('.match-card').first().waitFor();
        await open.click();
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        await page.screenshot({ path: path.join(output, `partidas-${width}-${theme}.png`) });
      }
      await filters.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
      await filters.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'SUB-8', exact: true }).getAttribute('aria-pressed'), 'true', 'Limpar filtros mantém o sub');

      await page.goto(base + '/elenco');
      await current.locator('.scout-player').first().waitFor();
      if (mobile) await page.setViewportSize({ width, height: 520 });
      await page.getByRole('button', { name: 'Mais filtros', exact: true }).click();
      const scout = page.getByRole('dialog', { name: 'Filtrar elenco', exact: true });
      const order = scout.getByRole('combobox', { name: 'Ordenar por', exact: true });
      await order.click();
      const last = scout.getByRole('option', { name: 'Camisa', exact: true });
      await last.scrollIntoViewIfNeeded();
      const optionBounds = await last.boundingBox();
      const bodyBounds = await scout.locator('.modal-body').boundingBox();
      assert.ok(optionBounds.y >= bodyBounds.y && optionBounds.y + optionBounds.height <= bodyBounds.y + bodyBounds.height + 1, 'Última opção visível dentro do corpo rolável');
      const footer = await scout.locator('.modal-footer').boundingBox();
      assert.ok(footer.y + footer.height <= (mobile ? 521 : 845), 'Rodapé não é empurrado pelo dropdown');
      await page.screenshot({ path: path.join(output, `elenco-order-${width}.png`) });
      await last.click();
      await scout.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
      assert.equal(new URL(page.url()).searchParams.get('ordem'), 'shirt');
      await page.getByRole('button', { name: 'Mais filtros', exact: true }).click();
      await order.press('ArrowDown');
      await order.press('End');
      await order.press('Enter');
      await scout.getByRole('button', { name: 'Fechar janela', exact: true }).click();
      if (mobile) await page.setViewportSize({ width, height: 844 });

      if (width <= 820) {
        await page.goto(base + '/jogadores');
        await current.locator('.alunos-directory').waitFor();
        await page.getByRole('button', { name: 'Filtros', exact: true }).click();
        const players = page.getByRole('dialog', { name: 'Filtrar jogadores', exact: true });
        await players.getByRole('button', { name: 'Sem número', exact: true }).click();
        await players.getByRole('button', { name: 'Fechar janela', exact: true }).click();
        assert.equal(new URL(page.url()).searchParams.get('camisa'), null, 'Fechar não aplica rascunhos em Jogadores');
        await page.getByRole('button', { name: 'Filtros', exact: true }).click();
        assert.equal(await players.getByRole('group', { name: 'Direção', exact: true }).count(), 0);
        await players.getByRole('group', { name: 'Ordenar por', exact: true }).getByRole('button', { name: 'Idade', exact: true }).click();
        await players.getByRole('button', { name: 'Decrescente', exact: true }).click();
        await players.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
        assert.equal(new URL(page.url()).searchParams.get('ordenar_por'), 'idade');
        assert.equal(new URL(page.url()).searchParams.get('ordem'), 'desc');
      }
      assert.deepEqual(errors, []);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      console.log(`PASS fluxo de filtros ${width}px: arraste sincronizado, rascunhos, opções completas e aplicação`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
