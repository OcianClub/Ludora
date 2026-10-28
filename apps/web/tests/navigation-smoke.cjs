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

  async function setup(width, { role = 'ADMIN', withoutClub = false } = {}) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(({ role, withoutClub }) => {
      if (sessionStorage.getItem('navigation-fixture-initialized')) return;
      sessionStorage.setItem('navigation-fixture-initialized', 'true');
      localStorage.setItem('ludora_token', 'visual-test-only');
      localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex Morgan', email: 'visual@example.test' }));
      if (!withoutClub) {
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: role, plano: 'DEMO' }));
        localStorage.setItem('ludora_clube_id', '2');
      }
      localStorage.setItem('ludora_tema', 'dark');
    }, { role, withoutClub });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const req = route.request();
      if (['xhr', 'fetch'].includes(req.resourceType())) return route.abort();
      if (new URL(req.url()).origin !== new URL(base).origin) return route.abort();
      return route.continue();
    });
    await require('./visual-fixture.cjs').install(page, { role });
    await page.goto(base + (withoutClub ? '/perfil' : '/dashboard'));
    await page.getByRole('heading', { name: withoutClub ? 'Meu perfil' : 'Momento da categoria', exact: true }).waitFor();
    return { context, page };
  }

  try {
    async function checkHeaderAndDrawer(page, width) {
      const trigger = page.getByRole('button', { name: /^Notificações,/ });
      assert.equal(await trigger.getAttribute('aria-haspopup'), 'dialog');
      assert.equal(await page.locator('.current-club-role').innerText(), 'Administrador');
      assert.ok(await page.locator('.current-club-role').evaluate(el => getComputedStyle(el).fontSize !== '0px'));
      assert.ok(await trigger.evaluate(el => getComputedStyle(el).color !== getComputedStyle(document.querySelector('.header-profile-link')).color));
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Notificações', exact: true });
      await dialog.waitFor();
      await dialog.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
      const box = await dialog.boundingBox();
      const viewportWidth = await page.evaluate(() => document.documentElement.getBoundingClientRect().right);
      assert.ok(Math.abs(box.x + box.width - viewportWidth) < 1, 'Painel encostado à direita');
      assert.ok(Math.abs(box.height - 900) < 1, 'Painel ocupa toda a altura');
      assert.ok(Math.abs(box.width - (width <= 760 ? viewportWidth : 480)) < 1, 'Notificações em tela inteira no celular');
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
      assert.equal(await sidebar.getByRole('button', { name: 'Menu da conta' }).isVisible(), true);
      assert.equal(await sidebar.locator('.nav-item.active').evaluate(el => getComputedStyle(el).borderWidth), '0px');
      assert.equal(await sidebar.locator('.brand > span').evaluate(el => getComputedStyle(el).visibility), 'hidden');
      await page.screenshot({ path: path.join(output, 'desktop-collapsed.png'), fullPage: true });
      await sidebar.hover();
      assert.equal((await sidebar.boundingBox()).width, 80);
      await page.getByRole('button', { name: 'Expandir navegação', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().width === 238);
      for (const width of [1920, 1366]) {
        await page.setViewportSize({ width, height: 900 });
        await checkAlignment(page);
      }
      assert.equal((await page.locator('.workspace').boundingBox()).x, 238);
      assert.ok((await page.locator('.workspace').boundingBox()).x > workspaceX);
      assert.equal(await sidebar.locator('.brand > span').evaluate(el => getComputedStyle(el).visibility), 'visible');
      assert.equal(await sidebar.getByRole('switch').count(), 0, 'Preferências concentradas no perfil');
      assert.equal(await sidebar.getByRole('button', { name: 'Sair da conta' }).count(), 0);
      await page.screenshot({ path: path.join(output, 'desktop-expanded.png'), fullPage: true });
      await sidebar.getByRole('link', { name: 'Partidas', exact: true }).click();
      await page.getByRole('button', { name: 'Recolher navegação', exact: true }).click();
      await page.mouse.move(600, 400);
      await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().width === 80);
      await page.keyboard.press('Tab');
      await sidebar.getByRole('link', { name: 'Elenco', exact: true }).focus();
      assert.equal((await sidebar.boundingBox()).width, 80);
      await page.getByRole('button', { name: 'Expandir navegação', exact: true }).press('Enter');
      await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().width === 238);
      console.log('PASS desktop: ícones, expansão manual por mouse/teclado, recolhimento e conteúdo alinhado');
    } finally { await context.close(); }

    for (const width of [320, 390, 760]) {
      const { context, page } = await setup(width);
      try {
        await checkAlignment(page);
        await checkHeaderAndDrawer(page, width);
        assert.equal(await page.locator('.sidebar').isVisible(), false);
        assert.equal(await page.locator('.header-profile-link').isVisible(), true);
        assert.equal(await page.locator('.switch-club-link').isVisible(), false);
        assert.equal(await page.locator('.current-club > .icon').count(), 0);
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
        await dialog.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
        const sheetBox = await dialog.boundingBox();
        assert.ok(Math.abs(sheetBox.y + sheetBox.height - 900) < 1, 'Menu Mais encostado à base da tela');
        assert.equal(Math.round(sheetBox.width), Math.min(await page.evaluate(() => document.documentElement.getBoundingClientRect().width), 540), 'Menu Mais ocupa a largura útil sem se esticar no tablet');
        assert.equal(await dialog.getByRole('heading', { name: 'Gestão do clube' }).isVisible(), true);
        assert.equal(await dialog.getByRole('link', { name: 'Pessoas e acessos' }).isVisible(), true);
        assert.equal(await dialog.getByRole('link', { name: 'Trocar clube' }).count(), 0);
        assert.equal(await dialog.getByRole('button', { name: 'Sair da conta' }).count(), 0);
        assert.equal(await dialog.getByRole('switch', { name: 'Tema escuro' }).count(), 0);
        await page.screenshot({ path: path.join(output, `more-${width}.png`), animations: 'disabled' });
        await dialog.getByRole('link', { name: 'Times', exact: true }).click();
        await page.waitForURL('**/times');
        assert.equal(await dialog.count(), 0);
        await page.screenshot({ path: path.join(output, `mobile-${width}.png`), fullPage: true });
        await page.locator('.header-profile-link').click();
        await page.getByRole('dialog', { name: 'Conta e aparência', exact: true }).getByRole('link', { name: 'Meu perfil', exact: true }).click();
        await page.waitForURL('**/perfil');
        assert.equal(await page.getByRole('tab', { name: 'Dados pessoais' }).getAttribute('aria-selected'), 'true');
        await page.getByRole('textbox', { name: 'Nome', exact: true }).fill('Nome em edição');
        await page.getByRole('tab', { name: 'Preferências', exact: true }).click();
        assert.equal(await page.getByRole('heading', { name: 'Preferências', exact: true }).isVisible(), true);
        assert.equal(await page.getByRole('textbox', { name: 'Nome', exact: true }).isVisible(), false);
        assert.equal(await page.getByRole('switch', { name: 'Tema escuro' }).isVisible(), true);
        const notificationPreference = page.getByRole('switch', { name: 'Receber notificações' });
        assert.equal(await notificationPreference.isVisible(), true);
        assert.equal(await notificationPreference.getAttribute('aria-checked'), 'true');
        await notificationPreference.click();
        await page.waitForFunction(() => document.querySelector('.perfil-switch')?.getAttribute('aria-checked') === 'false');
        await page.getByRole('tab', { name: 'Dados pessoais' }).click();
        assert.equal(await page.getByRole('textbox', { name: 'Nome', exact: true }).inputValue(), 'Nome em edição');
        await page.getByRole('tab', { name: 'Conta', exact: true }).click();
        await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
        const logoutDialog = page.getByRole('dialog', { name: 'Sair da conta?' });
        await logoutDialog.waitFor();
        await logoutDialog.getByRole('button', { name: 'Continuar na conta' }).click();
        assert.ok(await page.evaluate(() => Boolean(localStorage.getItem('ludora_token'))));
        if (width === 390) await page.screenshot({ path: path.join(output, 'profile-preferences-390.png'), fullPage: true });
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
    {
      const { context, page } = await setup(390);
      try {
        const writes = [];
        page.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()); });
        async function openClubDirectory() {
          await page.locator('.header-profile-link').click();
          await page.getByRole('dialog', { name: 'Conta e aparência', exact: true }).getByRole('link', { name: 'Meus clubes', exact: true }).click();
          await page.getByRole('link', { name: 'Explorar clubes', exact: true }).click();
        }
        await openClubDirectory();
        await page.getByRole('heading', { name: 'Trocar clube', exact: true }).waitFor();
        await page.getByRole('link', { name: 'Voltar ao clube' }).click();
        await page.waitForURL('**/dashboard');
        await openClubDirectory();
        await page.locator('.clube-card').filter({ hasText: 'Santos' }).getByRole('button', { name: 'Acessar clube' }).click();
        await page.waitForURL('**/dashboard');
        assert.equal(await page.locator('.current-club strong').innerText(), 'Santos');
        assert.equal(await page.locator('.current-club-role').innerText(), 'Visualização pública');
        assert.deepEqual(writes, [], 'Acessar um clube não deve seguir automaticamente');
        await page.getByRole('button', { name: 'Mais opções de navegação' }).click();
        const more = page.getByRole('dialog', { name: 'Mais opções' });
        assert.equal(await more.getByRole('link', { name: 'Pessoas e acessos' }).count(), 0);
        await page.keyboard.press('Escape');
        await page.locator('.header-profile-link').click();
        await page.getByRole('dialog', { name: 'Conta e aparência', exact: true }).getByRole('link', { name: 'Meu perfil', exact: true }).click();
        await page.getByRole('tab', { name: 'Conta', exact: true }).click();
        await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
        await page.getByRole('button', { name: 'Confirmar saída' }).click();
        await page.waitForURL('**/login');
        assert.equal(await page.evaluate(() => localStorage.getItem('ludora_token')), null);
        assert.equal(await page.evaluate(() => localStorage.getItem('ludora_clube')), null);
        console.log('PASS troca pública de clube, permissões e encerramento de sessão');
      } finally { await context.close(); }
    }
    {
      const { context, page } = await setup(390, { withoutClub: true });
      try {
        await page.getByRole('tab', { name: 'Preferências', exact: true }).click();
        await page.getByRole('switch', { name: 'Tema escuro' }).click();
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
        await page.getByRole('button', { name: 'Usar tema do dispositivo' }).click();
        assert.equal(await page.evaluate(() => localStorage.getItem('ludora_tema')), 'system');
        await page.getByRole('tab', { name: 'Conta', exact: true }).click();
        await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
        await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('dialog').count(), 0);
        console.log('PASS perfil e preferências acessíveis sem clube selecionado');
      } finally { await context.close(); }
    }
    assert.deepEqual(errors, []);
    console.log('PASS navegação com API simulada, sem alterações no banco.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
