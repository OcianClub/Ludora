const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');

const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5189';
const output = path.resolve(__dirname, '../../../test-results/web-players-responsive');
fs.mkdirSync(output, { recursive: true });

async function settled(page) {
  await page.waitForFunction(() => document.querySelector('.home-pager-current .alunos-directory')?.getAttribute('aria-busy') === 'false');
}

async function checkGeometry(page, width) {
  await page.waitForFunction(() => {
    const strip = document.querySelector('.home-sub-strip');
    const active = strip?.querySelector('button[aria-pressed="true"]');
    const indicator = strip?.querySelector('.home-sub-indicator');
    if (!active || !indicator) return false;
    const a = active.getBoundingClientRect(), i = indicator.getBoundingClientRect(), s = strip.getBoundingClientRect();
    return Math.abs(a.x - i.x) < 1.5 && Math.abs(a.width - i.width) < 1.5 && Math.abs(a.x + a.width / 2 - s.x - s.width / 2) < 1.5;
  });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'A rolagem horizontal deve ficar apenas na tabela');
  if (width <= 760) {
    const nav = await page.locator('.bottom-nav').boundingBox();
    const viewportHeight = await page.evaluate(() => visualViewport.height + visualViewport.offsetTop);
    assert.ok(Math.abs(nav.y + nav.height - viewportHeight) < 2, 'Navbar deve estar no rodapé visível');
    assert.ok(nav.y >= 0);
  }
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const [width, height] of [[320, 568], [390, 844], [600, 900], [760, 844], [768, 1024], [820, 1180], [1024, 768], [1366, 768], [1920, 1080]]) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: width <= 760, hasTouch: width <= 820 });
      await context.addInitScript(() => {
        localStorage.setItem('ludora_token', 'responsive-test');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
        localStorage.setItem('ludora_clube_id', '2');
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
        localStorage.setItem('ludora_tema', 'dark');
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      await require('./visual-fixture.cjs').install(page, { playerCount: 32 });
      await page.goto(base + '/jogadores?visualizacao=lista&categoria=1');
      await page.locator('.home-pager-current .alunos-sub-toggle').first().waitFor();
      await settled(page);
      await checkGeometry(page, width);
      await page.locator('.home-pager-current .alunos-sub-toggle').first().click();
      await page.locator('.home-pager-current .alunos-list li').first().waitFor();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await checkGeometry(page, width);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.getByRole('button', { name: 'Tabela', exact: true }).click();
      await page.locator('.home-pager-current .alunos-table').waitFor();
      await settled(page);
      await page.locator('.home-pager-current .alunos-player-link').first().evaluate(element => { element.textContent = 'João Pedro de Albuquerque e Silva com nome extenso para conferir a leitura'; });
      await page.locator('.home-pager-current .alunos-table-scroll').evaluate(element => { element.scrollLeft = element.scrollWidth; });
      await checkGeometry(page, width);
      await page.getByRole('button', { name: 'Próxima categoria', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.home-sub-strip button[aria-pressed="true"]')?.textContent === 'SUB-8');
      await settled(page);
      await checkGeometry(page, width);
      if (width <= 820) {
        await page.getByRole('button', { name: 'Filtros', exact: true }).click();
        const filters = page.getByRole('dialog', { name: 'Filtrar jogadores' });
        const action = await filters.getByRole('button', { name: 'Ver jogadores' }).boundingBox();
        assert.ok(action.y + action.height <= height);
        await filters.getByRole('button', { name: 'Ver jogadores' }).click();
        await checkGeometry(page, width);
      }
      if (width === 390) {
        for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
          await page.setViewportSize(viewport);
          await checkGeometry(page, viewport.width);
        }
        await page.getByRole('button', { name: 'Base', exact: true }).click();
        await page.getByRole('button', { name: 'SUB-12', exact: true }).waitFor();
        await page.getByRole('button', { name: 'SUB-12', exact: true }).focus();
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => document.querySelector('.home-sub-strip button[aria-pressed="true"]')?.textContent === 'SUB-14');
        await checkGeometry(page, width);
        await page.getByRole('button', { name: 'Iniciação', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.home-sub-strip button[aria-pressed="true"]')?.textContent === 'SUB-7');
        await checkGeometry(page, width);
        const strip = await page.locator('.home-sub-strip').boundingBox();
        const item = await page.getByRole('button', { name: 'SUB-7', exact: true }).boundingBox();
        await page.mouse.move(strip.x + strip.width * .65, strip.y + strip.height / 2);
        await page.mouse.down();
        await page.mouse.move(strip.x + strip.width * .65 - item.width - 6, strip.y + strip.height / 2, { steps: 8 });
        await page.mouse.up();
        await page.waitForFunction(() => document.querySelector('.home-sub-strip button[aria-pressed="true"]')?.textContent === 'SUB-8');
        await checkGeometry(page, width);
        await page.getByRole('button', { name: 'Mais opções de navegação', exact: true }).click();
        const more = page.getByRole('dialog', { name: 'Mais opções', exact: true });
        await more.waitFor();
        await more.getByRole('button', { name: 'Fechar janela' }).click();
        await more.waitFor({ state: 'hidden' });
        await checkGeometry(page, width);
        await page.getByRole('button', { name: '+ Adicionar aluno', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Adicionar aluno', exact: true });
        await dialog.waitFor();
        await dialog.getByLabel('Nome completo').fill('João Pedro');
        await page.evaluate(() => {
          Object.defineProperty(visualViewport, 'height', { configurable: true, value: 390 });
          visualViewport.dispatchEvent(new Event('resize'));
        });
        const save = await dialog.getByRole('button', { name: 'Salvar aluno' }).boundingBox();
        assert.ok(save.y + save.height <= 391, 'Rodapé deve acompanhar o teclado simulado');
        assert.ok((await dialog.boundingBox()).height <= 391);
        await page.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
        assert.ok((await dialog.boundingBox()).height >= 840, 'Fechar o teclado deve restaurar a altura');
        await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
        await checkGeometry(page, width);
      }
      await settled(page);
      await page.screenshot({ path: path.join(output, `players-${width}.png`) });
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS responsividade ${width}x${height}: navegação fixa, seletor alinhado, tabela e lista sem overflow`);
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
