const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5189';
const output = path.resolve(__dirname, '../../../test-results/web-account-navigation');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 760, 768, 820, 1024, 1366, 1920]) {
      const mobile = width <= 760;
      const compact = width <= 1050;
      const context = await browser.newContext({ viewport: { width, height: 844 }, colorScheme: 'light', reducedMotion: 'reduce', hasTouch: compact });
      await context.addInitScript(() => {
        if (sessionStorage.getItem('account-fixture')) return;
        sessionStorage.setItem('account-fixture', 'true');
        localStorage.setItem('ludora_token', 'account-menu-test');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex Morgan', email: 'visual@example.test' }));
        localStorage.setItem('ludora_clube_id', '2');
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
        localStorage.setItem('ludora_tema', 'system');
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      await require('./visual-fixture.cjs').install(page);
      await page.goto(base + '/dashboard');
      await page.getByRole('heading', { name: 'Momento da categoria', exact: true }).waitFor();
      const sidebar = page.locator('.sidebar');
      const trigger = page.getByRole('button', { name: 'Menu da conta', exact: true });
      if (!mobile) {
        assert.equal((await sidebar.boundingBox()).width, 80);
        await sidebar.hover();
        assert.equal((await sidebar.boundingBox()).width, 80, 'Passar o mouse não altera uma escolha manual');
        const toggle = page.getByRole('button', { name: 'Expandir navegação', exact: true });
        await toggle.click();
        assert.equal((await sidebar.boundingBox()).width, 238);
        assert.equal((await page.locator('.workspace').boundingBox()).x, compact ? 80 : 238);
        assert.equal(await sidebar.locator('.brand > span').evaluate(element => getComputedStyle(element).visibility), 'visible');
        await sidebar.getByRole('link', { name: 'Partidas', exact: true }).click();
        assert.equal((await sidebar.boundingBox()).width, compact ? 80 : 238, 'Tablet recolhe ao navegar; desktop mantém a preferência');
        if (!compact) {
          await page.reload();
          assert.equal((await sidebar.boundingBox()).width, 238, 'Expansão persiste ao recarregar');
        } else await page.getByRole('button', { name: 'Expandir navegação', exact: true }).click();
        await page.screenshot({ path: path.join(output, `sidebar-expanded-${width}.png`) });
        await trigger.click();
        const expandedMenu = page.getByRole('dialog', { name: 'Conta e aparência', exact: true });
        await page.screenshot({ path: path.join(output, `account-expanded-${width}.png`) });
        const expandedBounds = await expandedMenu.boundingBox();
        assert.ok(expandedBounds.x >= 0 && expandedBounds.y >= 0 && expandedBounds.x + expandedBounds.width <= width);
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Recolher navegação', exact: true }).click();
        await sidebar.getByRole('link', { name: 'Elenco', exact: true }).focus();
        assert.equal((await sidebar.boundingBox()).width, 80, 'Foco não expande a lateral sozinho');
      } else {
        assert.equal(await sidebar.isVisible(), false);
        assert.equal(await page.getByRole('button', { name: 'Expandir navegação', exact: true }).count(), 0);
        const nav = await page.locator('.bottom-nav').boundingBox();
        assert.equal(nav.y + nav.height, 844);
      }

      await trigger.click();
      const popup = page.getByRole('dialog', { name: 'Conta e aparência', exact: true });
      await popup.waitFor();
      const bounds = await popup.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0 && bounds.y + bounds.height <= 844);
      assert.equal(await popup.getByRole('radio').count(), 3);
      assert.equal(await popup.getByRole('radio', { name: 'Tema do sistema', exact: true }).getAttribute('aria-checked'), 'true');
      assert.equal(await popup.getByRole('radio', { name: 'Tema do sistema', exact: true }).locator('rect').getAttribute('x'), mobile ? '6' : '3', 'Ícone do sistema acompanha o tipo de tela');
      await popup.getByRole('radio', { name: 'Tema escuro', exact: true }).click();
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      assert.equal(await page.evaluate(() => localStorage.getItem('ludora_tema')), 'dark');
      await page.evaluate(() => new Promise(requestAnimationFrame));
      assert.equal(await popup.evaluate(element => getComputedStyle(element).color), await page.locator('html').evaluate(element => getComputedStyle(element).color));
      await page.screenshot({ path: path.join(output, `account-${width}-dark.png`) });
      await popup.getByRole('radio', { name: 'Tema claro', exact: true }).click();
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
      await page.screenshot({ path: path.join(output, `account-${width}-light.png`) });
      await popup.getByRole('radio', { name: 'Tema claro', exact: true }).press('Home');
      assert.equal(await popup.getByRole('radio', { name: 'Tema do sistema', exact: true }).getAttribute('aria-checked'), 'true');
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      await page.keyboard.press('Escape');
      await popup.waitFor({ state: 'hidden' });
      assert.ok(await trigger.evaluate(element => element === document.activeElement));
      await trigger.click();
      await page.locator('.current-club').click();
      await popup.waitFor({ state: 'hidden' });
      await trigger.click();
      await popup.getByRole('link', { name: 'Preferências', exact: true }).click();
      await page.waitForURL('**/perfil?secao=preferencias');
      assert.equal(await page.getByRole('tab', { name: 'Preferências', exact: true }).getAttribute('aria-selected'), 'true');
      await trigger.click();
      await popup.getByRole('link', { name: 'Meu perfil', exact: true }).click();
      await page.waitForURL('**/perfil');
      assert.equal(await page.getByRole('tab', { name: 'Dados pessoais', exact: true }).getAttribute('aria-selected'), 'true');
      await trigger.click();
      await popup.getByRole('button', { name: 'Sair da conta', exact: true }).click();
      const logout = page.getByRole('dialog', { name: 'Sair da conta?', exact: true });
      await logout.waitFor();
      await logout.getByRole('button', { name: 'Continuar na conta', exact: true }).click();
      assert.ok(await page.evaluate(() => Boolean(localStorage.getItem('ludora_token'))));
      assert.ok(await trigger.evaluate(element => element === document.activeElement));
      await trigger.click();
      await popup.getByRole('button', { name: 'Sair da conta', exact: true }).focus();
      await page.keyboard.press('Tab');
      await popup.waitFor({ state: 'hidden' });
      if (width === 390) {
        await page.setViewportSize({ width: 844, height: 390 });
        await page.getByRole('button', { name: 'Menu da conta', exact: true }).click();
        const smallBounds = await popup.boundingBox();
        assert.ok(smallBounds.y >= 0 && smallBounds.y + smallBounds.height <= 390, 'Menu cabe em paisagem');
        await page.setViewportSize({ width: 390, height: 568 });
        await popup.waitFor({ state: 'hidden' });
        await trigger.click();
        await popup.getByRole('button', { name: 'Sair da conta', exact: true }).click();
        await logout.getByRole('button', { name: 'Confirmar saída', exact: true }).click();
        await page.waitForURL('**/login');
        assert.equal(await page.evaluate(() => localStorage.getItem('ludora_token')), null);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      console.log(`PASS navegação ${width}px: lateral manual, menu da conta, temas, teclado e confirmação de saída`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
