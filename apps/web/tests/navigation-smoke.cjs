const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';
const output = path.resolve(__dirname, '../../../test-results/web-navigation');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];

  async function setup(width) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(() => {
      localStorage.setItem('ludora_token', 'visual-test-only');
      localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex Morgan', email: 'visual@example.test' }));
      localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN', plano: 'DEMO' }));
      localStorage.setItem('ludora_clube_id', '2');
      localStorage.setItem('ludora_tema', 'dark');
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const req = route.request();
      if (['xhr', 'fetch'].includes(req.resourceType())) return route.abort();
      if (new URL(req.url()).origin !== new URL(base).origin) return route.abort();
      return route.continue();
    });
    await require('./visual-fixture.cjs').install(page);
    await page.goto(base + '/dashboard');
    await page.getByRole('heading', { name: 'Momento da categoria' }).waitFor();
    return { context, page };
  }

  try {
    async function checkAlignment(page) {
      const edges = await page.evaluate(() => {
        const content = document.querySelector('.content');
        const box = content.getBoundingClientRect();
        const style = getComputedStyle(content);
        return {
          left: box.left + parseFloat(style.paddingLeft),
          right: box.right - parseFloat(style.paddingRight),
          headerLeft: document.querySelector('.current-club').getBoundingClientRect().left,
          headerRight: document.querySelector('.workspace-actions').getBoundingClientRect().right,
        };
      });
      assert.ok(Math.abs(edges.left - edges.headerLeft) < 1, 'Clube alinhado ao início do conteúdo');
      assert.ok(Math.abs(edges.right - edges.headerRight) < 1, 'Ações alinhadas ao fim do conteúdo');
    }
    const { context, page } = await setup(1366);
    try {
      const sidebar = page.locator('.sidebar');
      await page.mouse.move(600, 400);
      await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().width === 80);
      const workspaceX = (await page.locator('.workspace').boundingBox()).x;
      await checkAlignment(page);
      assert.equal(await sidebar.locator('.brand > span').evaluate(el => getComputedStyle(el).visibility), 'hidden');
      await page.screenshot({ path: path.join(output, 'desktop-collapsed.png'), fullPage: true });
      await sidebar.hover();
      await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().width === 238);
      for (const width of [1920, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        await checkAlignment(page);
      }
      assert.equal((await page.locator('.workspace').boundingBox()).x, workspaceX);
      assert.equal(await sidebar.locator('.brand > span').evaluate(el => getComputedStyle(el).visibility), 'visible');
      await page.screenshot({ path: path.join(output, 'desktop-expanded.png'), fullPage: true });
      await sidebar.getByRole('link', { name: 'Partidas', exact: true }).click();
      await page.mouse.move(600, 400);
      await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().width === 80);
      await page.keyboard.press('Tab');
      await sidebar.getByRole('link', { name: 'Elenco', exact: true }).focus();
      await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().width === 238);
      console.log('PASS desktop: ícones, expansão por mouse/teclado, recolhimento e conteúdo sem deslocamento');
    } finally { await context.close(); }

    for (const width of [320, 390, 760]) {
      const { context, page } = await setup(width);
      try {
        await checkAlignment(page);
        assert.equal(await page.locator('.sidebar').isVisible(), false);
        const nav = page.getByRole('navigation', { name: 'Navegação principal no celular' });
        const box = await nav.boundingBox();
        assert.equal(Math.round(box.y + box.height), 900);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.getByRole('button', { name: 'Mais opções de navegação' }).click();
        const dialog = page.getByRole('dialog', { name: 'Mais opções' });
        await dialog.waitFor();
        assert.equal(await dialog.getByRole('link', { name: 'Pessoas e acessos' }).isVisible(), true);
        assert.equal(await dialog.getByRole('switch', { name: 'Tema escuro' }).isVisible(), true);
        await dialog.getByRole('link', { name: 'Times', exact: true }).click();
        await page.waitForURL('**/times');
        assert.equal(await dialog.count(), 0);
        await page.screenshot({ path: path.join(output, `mobile-${width}.png`), fullPage: true });
        await page.getByRole('button', { name: 'Mais opções de navegação' }).click();
        await page.setViewportSize({ width: 1024, height: 900 });
        assert.equal(await page.getByRole('dialog').count(), 0);
        assert.equal(await page.locator('.sidebar').isVisible(), true);
        console.log(`PASS ${width}px: barra inferior, menu Mais, permissões e mudança para desktop`);
      } finally { await context.close(); }
    }
    assert.deepEqual(errors, []);
    console.log('PASS navegação com API simulada, sem alterações no banco.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
