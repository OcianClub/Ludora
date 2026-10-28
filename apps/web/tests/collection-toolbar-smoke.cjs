const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5189';
const output = path.resolve(__dirname, '../../../test-results/web-collection-toolbar');
const pages = [
  { route: '/jogadores', title: 'Filtrar jogadores', filter: '.alunos-filter-toggle', search: '.alunos-search', ready: '.home-pager-current .alunos-directory' },
  { route: '/elenco', title: 'Filtrar elenco', filter: '.scout-controls .collection-filter-button', search: '.scout-search', ready: '.home-pager-current .scout-player' },
  { route: '/partidas', title: 'Filtrar partidas', filter: '.schedule-mobile-filter-button', search: '.schedule-search', ready: '.home-pager-current .match-card' },
];

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 820, 1366]) for (const theme of ['dark', 'light']) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      await context.addInitScript(theme => {
        localStorage.setItem('ludora_token', 'toolbar-test');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
        localStorage.setItem('ludora_clube_id', '2');
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
        localStorage.setItem('ludora_tema', theme);
      }, theme);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      await require('./visual-fixture.cjs').install(page);
      const unordered = [10, 7, 8, 9, 18, 12, 16, 14].map(number => ({
        id: [7, 8, 9, 10, 12, 14, 16, 18].indexOf(number) + 1,
        nome: `sub-${number}`, tipo: number <= 10 ? 'INICIACAO' : 'BASE', faixaIdade: number,
      }));
      await page.route('http://localhost:3000/categorias', route => route.fulfill({ json: unordered }));
      let dialogStyle;
      for (const screen of pages) {
        await page.goto(base + screen.route);
        await page.locator(screen.ready).first().waitFor();
        const expected = width <= 760 ? 40 : 44;
        const search = page.locator(screen.search);
        if (await search.isVisible()) assert.equal((await search.boundingBox()).height, expected, `${screen.route}: altura da busca`);
        const toggle = page.locator('.collection-mode-toggle:visible').first();
        assert.equal((await toggle.boundingBox()).height, expected, `${screen.route}: altura do seletor`);
        if (width <= 760) {
          for (const button of await toggle.locator('button').all()) assert.equal((await button.innerText()).trim(), '');
        }
        {
          assert.deepEqual(await page.locator('.home-sub-strip button').allTextContents(), ['SUB-7', 'SUB-8', 'SUB-9', 'SUB-10']);
          const phase = page.getByRole('group', { name: 'Fase', exact: true });
          await phase.getByRole('button', { name: 'Base', exact: true }).click();
          assert.deepEqual(await page.locator('.home-sub-strip button').allTextContents(), ['SUB-12', 'SUB-14', 'SUB-16', 'SUB-18']);
          await page.waitForFunction(() => document.querySelector('.home-sub-strip button[aria-pressed="true"]')?.textContent === 'SUB-12');
          await page.getByRole('button', { name: 'Próxima categoria', exact: true }).click();
          await page.waitForFunction(() => document.querySelector('.home-sub-strip button[aria-pressed="true"]')?.textContent === 'SUB-14');
        }
        const filter = screen.route === '/partidas' && width > 760 ? page.getByRole('button', { name: 'Mais filtros', exact: true }) : page.locator(screen.filter);
        if (await filter.isVisible()) {
          const box = await filter.boundingBox();
          assert.equal(box.height, expected, `${screen.route}: altura de filtros`);
          assert.equal(box.width, expected, `${screen.route}: botão quadrado`);
          if (screen.route === '/elenco' && width === 1366) assert.equal((await page.locator('.scout-desktop-position .schedule-select-trigger').boundingBox()).height, box.height);
          await filter.click();
          const dialog = page.getByRole('dialog', { name: screen.route === '/partidas' && width > 760 ? 'Mais filtros' : screen.title, exact: true });
          await dialog.waitFor();
          await page.waitForFunction(() => !!document.querySelector('dialog[open]'));
          const style = await dialog.evaluate(element => {
            const css = getComputedStyle(element);
            return { background: css.backgroundColor, header: getComputedStyle(element.querySelector('.modal-header')).padding, body: getComputedStyle(element.querySelector('.modal-body')).padding, footer: getComputedStyle(element.querySelector('.modal-footer')).padding, radius: css.borderRadius };
          });
          if (dialogStyle) assert.deepEqual(style, dialogStyle, 'Modais devem compartilhar aparência e espaçamento');
          dialogStyle = style;
          for (const button of await dialog.locator('.modal-footer button').all()) {
            const bounds = await button.boundingBox();
            assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= 844, 'Ações visíveis e sem corte');
          }
          if (width === 320 || width === 1366) await page.screenshot({ path: path.join(output, `${screen.route.slice(1)}-${width}-${theme}.png`) });
          await dialog.getByRole('button', { name: 'Fechar janela', exact: true }).press('Escape');
          await dialog.waitFor({ state: 'hidden' });
          assert.ok(await filter.evaluate(element => element === document.activeElement), 'Foco retorna ao botão que abriu o modal');
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${screen.route}: sem overflow horizontal`);
      }
      assert.deepEqual(errors, []);
      console.log(`PASS controles compartilhados ${width}px ${theme}: dimensões, alinhamento, modais e ordem numérica dos subs`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
