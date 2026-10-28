const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5189';

async function swipe(page, locator) {
  const box = await locator.boundingBox();
  const startX = box.x + box.width * .75;
  const y = box.y + Math.min(box.height / 2, 25);
  const before = await page.locator('.home-sub-indicator').evaluate(el => el.style.transform);
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX - Math.min(160, box.width * .55), y, { steps: 8 });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const moving = await page.locator('.home-pager-track').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m41);
  assert.ok(moving < -20, 'O conteúdo deve acompanhar o dedo antes de soltar');
  assert.notEqual(await page.locator('.home-sub-indicator').evaluate(el => el.style.transform), before, 'O seletor deve acompanhar o conteúdo');
  assert.ok(await page.evaluate(() => {
    const current = document.querySelector('.home-pager-current').getBoundingClientRect();
    const next = document.querySelector('.home-pager-preview[data-offset="1"]').getBoundingClientRect();
    return next.x - current.right >= 19;
  }), 'As páginas devem manter um espaço durante o arraste');
  await page.mouse.up();
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [390, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width === 390, hasTouch: width === 390 });
      await context.addInitScript(() => {
        localStorage.setItem('ludora_token', 'swipe-test');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
        localStorage.setItem('ludora_clube_id', '2');
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      await require('./visual-fixture.cjs').install(page, { playerCount: 32 });
      await page.goto(base + '/jogadores?categoria=1&visualizacao=tabela');
      await page.locator('.home-pager-current .alunos-table').waitFor();
      await page.waitForFunction(() => !!document.querySelector('.home-pager-preview[data-offset="1"] .alunos-player-link'));
      await swipe(page, page.locator('.alunos-results-bar p'));
      await page.waitForFunction(() => document.querySelector('.home-sub-strip button[aria-pressed="true"]')?.textContent === 'SUB-8');
      await page.waitForFunction(() => [...document.querySelectorAll('.home-pager-current .alunos-player-link')].every(link => {
        const id = Number(link.getAttribute('href').split('/').pop());
        return id >= 200 && id < 300;
      }));
      if (width === 390) {
        const scroll = page.locator('.home-pager-current .alunos-table-scroll');
        const bounds = await scroll.boundingBox();
        const session = await context.newCDPSession(page);
        const x = bounds.x + bounds.width - 25, y = bounds.y + 80;
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let step = 1; step <= 8; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - step * 20, y }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForFunction(() => document.querySelector('.home-pager-current .alunos-table-scroll').scrollLeft > 30);
        assert.equal(await page.getByRole('button', { name: 'SUB-8', exact: true }).getAttribute('aria-pressed'), 'true');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      await page.getByRole('button', { name: 'Lista', exact: true }).click();
      await page.locator('.home-pager-current .alunos-sub-toggle').first().waitFor();
      await page.getByRole('button', { name: 'SUB-8', exact: true }).click();
      await page.locator('.home-pager-current .alunos-list:visible li').first().waitFor();
      await page.evaluate(() => window.scrollTo(0, 0));
      await swipe(page, page.locator('.home-pager-current .alunos-list:visible li').first());
      await page.waitForFunction(() => document.querySelector('.home-sub-strip button[aria-pressed="true"]')?.textContent === 'SUB-9');
      assert.ok(new URL(page.url()).pathname === '/jogadores', 'Arrastar sobre o jogador não deve abrir a ficha');
      if (width === 390) {
        for (const [route, selector] of [
          ['/jogadores', '.alunos-filter-toggle'],
          ['/partidas', '.schedule-mobile-filter-button'],
          ['/elenco', '.scout-controls .compact-filter-button'],
        ]) {
          await page.goto(base + route);
          const button = page.locator(selector);
          await button.waitFor();
          const box = await button.boundingBox();
          assert.ok(box.width <= 40 && box.height <= 40);
          assert.equal((await button.innerText()).trim(), '');
          const toggle = page.locator('.compact-view-toggle:visible').first();
          await toggle.waitFor();
          for (const item of await toggle.locator('button').all()) {
            assert.equal((await item.innerText()).trim(), '');
            assert.ok((await item.boundingBox()).width <= 36);
          }
        }
      }
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${width}px: arraste sincronizado, páginas espaçadas, tabela preservada e controles compactos`);
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
