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
    async function checkHeaderAndDrawer(page, width) {
      const trigger = page.getByRole('button', { name: /^Notificações,/ });
      assert.equal(await trigger.getAttribute('aria-haspopup'), 'dialog');
      assert.equal(await page.locator('.current-club-role').innerText(), 'Administrador');
      assert.ok(await page.locator('.current-club-role').evaluate(el => getComputedStyle(el).fontSize !== '0px'));
      assert.ok(await trigger.evaluate(el => getComputedStyle(el).color !== getComputedStyle(document.querySelector('.profile-link[aria-label="Meu perfil"]')).color));
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Notificações', exact: true });
      await dialog.waitFor();
      await dialog.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
      const box = await dialog.boundingBox();
      assert.ok(Math.abs(box.x + box.width - width) < 1, 'Painel encostado à direita');
      assert.ok(Math.abs(box.height - 900) < 1, 'Painel ocupa toda a altura');
      assert.ok(Math.abs(box.width - (width <= 760 ? width : 480)) < 1, 'Notificações em tela inteira no celular');
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
      assert.equal(await dialog.locator('.notification-row').count(), 1);
      await dialog.getByRole('button').last().focus();
      await page.keyboard.press('Tab');
      assert.ok(await dialog.evaluate(el => el.contains(document.activeElement)), 'Foco não escapa do painel');
      await page.screenshot({ path: path.join(output, `notifications-${width}.png`), animations: 'disabled' });
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      assert.ok(await trigger.evaluate(el => document.activeElement === el), 'Foco retorna ao sino');
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
      await page.route('**/notificacoes/lidas', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
      await trigger.click();
      await dialog.getByRole('button', { name: 'Marcar todas como lidas' }).click();
      await page.waitForFunction(() => document.querySelector('.notifications-trigger').getAttribute('aria-label') === 'Notificações, 0 não lidas');
      assert.equal(await page.locator('.notification-dot').count(), 0);
      assert.equal(await dialog.locator('.notification-row.unread').count(), 0);
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
    }
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
      await checkHeaderAndDrawer(page, 1366);
      assert.equal(await page.locator('.header-profile-link').isVisible(), false);
      assert.equal(await sidebar.getByRole('link', { name: 'Meu perfil' }).isVisible(), true);
      assert.equal(await sidebar.locator('.nav-item.active').evaluate(el => getComputedStyle(el).borderWidth), '0px');
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
      assert.equal(await sidebar.getByRole('switch', { name: 'Tema escuro' }).evaluate(el => getComputedStyle(el).borderRadius), '10px');
      assert.equal(await sidebar.locator('.theme-switch-thumb').evaluate(el => getComputedStyle(el).borderRadius), '7px');
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
        await checkHeaderAndDrawer(page, width);
        assert.equal(await page.locator('.sidebar').isVisible(), false);
        assert.equal(await page.locator('.header-profile-link').isVisible(), true);
        const nav = page.getByRole('navigation', { name: 'Navegação principal no celular' });
        const box = await nav.boundingBox();
        assert.equal(Math.round(box.y + box.height), 900);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.equal(await nav.locator('.bottom-nav-item.active').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
        assert.notEqual(await nav.locator('.bottom-nav-item.active .nav-icon').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
        assert.equal(await nav.locator('.bottom-nav-item.active').evaluate(el => getComputedStyle(el).borderWidth), '0px');
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
    for (const width of [320, 1366]) {
      const { context, page } = await setup(width);
      try {
        await page.evaluate(() => {
          localStorage.setItem('ludora_tema', 'light');
          window.dispatchEvent(new Event('ludora:theme-change'));
        });
        await checkHeaderAndDrawer(page, width);
        await page.locator('.current-club strong').evaluate(el => { el.textContent = 'Associação Esportiva de Desenvolvimento de Atletas da Baixada Santista'; });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Nome longo não deve empurrar as ações do header');
        await checkAlignment(page);
        await page.screenshot({ path: path.join(output, `header-light-long-${width}.png`), animations: 'disabled' });
        console.log(`PASS ${width}px: tema claro, nome longo, sino neutro, painel e leitura de avisos`);
      } finally { await context.close(); }
    }
    assert.deepEqual(errors, []);
    console.log('PASS navegação com API simulada, sem alterações no banco.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
