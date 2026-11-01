const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { install } = require('./visual-fixture.cjs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';
const output = path.resolve(__dirname, '../../../test-results/audit-interface');
const routes = ['/dashboard', '/partidas', '/jogadores', '/elenco', '/times', '/membros', '/competicoes', '/perfil', '/clube', '/selecionar-clube'];

async function prepare(browser, width, theme) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' });
  await context.addInitScript(theme => {
    localStorage.setItem('ludora_token', 'visual-test-only');
    localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
    localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
    localStorage.setItem('ludora_clube_id', '2');
    localStorage.setItem('ludora_tema', theme);
  }, theme);
  const page = await context.newPage();
  await page.route('**/*', route => ['fetch', 'xhr'].includes(route.request().resourceType()) || new URL(route.request().url()).origin !== new URL(base).origin ? route.abort() : route.continue());
  await install(page);
  await page.route('http://localhost:3000/times/contexto', route => route.fulfill({ json: [] }));
  await page.route('http://localhost:3000/convites**', route => route.fulfill({ json: { convites: [] } }));
  await page.route('http://localhost:3000/notificacoes/preferencias', route => route.fulfill({ json: { preferencias: [] } }));
  return { context, page };
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  let screens = 0;
  try {
    for (const width of [320, 390, 820, 1440, 2560]) for (const theme of ['dark', 'light']) {
      const { context, page } = await prepare(browser, width, theme);
      page.on('pageerror', error => errors.push(`${width}/${theme}: ${error.message}`));
      for (const route of routes) {
        await page.goto(base + route);
        await page.waitForTimeout(400);
        await page.locator('.loading-skeleton').first().waitFor({ state: 'hidden' });
        assert.equal(await page.locator('.route-load-error').count(), 0, route);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow: ${route}/${width}/${theme}`);
        if (route === '/competicoes') {
          await page.getByRole('button', { name: '+ Nova competição', exact: true }).click();
          const dialog = page.getByRole('dialog');
          const trigger = dialog.locator('.choice-trigger');
          await trigger.click();
          const options = dialog.locator('.choice-options');
          assert.equal(await options.evaluate(el => getComputedStyle(el).position), 'static', 'Select cresce no fluxo do modal');
          await options.getByRole('button', { name: 'Iniciação', exact: true }).click();
          assert.match(await trigger.innerText(), /Iniciação/);
          await page.keyboard.press('Escape');
          await dialog.waitFor({ state: 'hidden' });
          assert.notEqual(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), 'hidden');
        }
        if (width === 390 && theme === 'dark' && ['/jogadores', '/elenco', '/partidas', '/membros'].includes(route)) {
          await page.screenshot({ path: path.join(output, route.slice(1) + '.png') });
        }
        screens++;
      }
      await context.close();
    }
    const { context, page } = await prepare(browser, 390, 'dark');
    await page.route('http://localhost:3000/competicoes', async route => { await new Promise(resolve => setTimeout(resolve, 1200)); await route.fulfill({ json: [] }); });
    await page.goto(base + '/competicoes');
    const skeleton = page.getByRole('status', { name: 'Carregando dados', exact: true });
    await skeleton.waitFor();
    assert.equal(await skeleton.locator('.loading-skeleton-line').first().evaluate(el => getComputedStyle(el).animationName), 'none', 'Movimento reduzido respeitado');
    await skeleton.waitFor({ state: 'hidden' });
    await context.close();
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ screens, delayedLoading: true, reducedMotion: true, modalKeyboard: true, pageErrors: errors }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
