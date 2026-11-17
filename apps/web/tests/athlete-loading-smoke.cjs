const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';
(async () => {
  fs.mkdirSync('test-results/athlete-loading', { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try { for (const width of [320, 390, 820, 1440]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(theme => {
      localStorage.setItem('ludora_token', 'isolated'); localStorage.setItem('ludora_clube_id', '2'); localStorage.setItem('ludora_tema', theme);
      localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Teste' })); localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
    }, theme);
    const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await require('./visual-fixture.cjs').install(page);
    await page.goto(base + '/jogadores/100'); await page.getByRole('button', { name: 'Ver Scout', exact: true }).waitFor();
    let release; const pending = new Promise(resolve => { release = resolve; });
    await page.route('**/jogadores/100/scout-contexto*', async route => { await pending; await route.abort().catch(() => {}); });
    try {
      await page.getByRole('button', { name: 'Ver Scout', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Ficha do atleta' });
      await dialog.locator('.athlete-loading-label .spinner').waitFor();
      const spinner = await dialog.locator('.athlete-loading-label .spinner').boundingBox(), label = await dialog.locator('.athlete-loading-label > span').boundingBox();
      assert.ok(label.y >= spinner.y + spinner.height, 'Loading text appears below the spinner');
      assert.ok(Math.abs(label.x + label.width / 2 - spinner.x - spinner.width / 2) < 2, 'Text and spinner share the horizontal center');
      assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), 'No horizontal overflow');
      await dialog.screenshot({ path: `test-results/athlete-loading/${width}-${theme}.png` });
      assert.deepEqual(errors, []); console.log(`PASS athlete loading ${width} ${theme}`);
    } finally { release(); await context.close(); }
  } } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
