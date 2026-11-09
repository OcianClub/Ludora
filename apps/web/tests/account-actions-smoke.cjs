const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { prepare } = require('./responsive-audit.cjs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5188';
const output = path.resolve(__dirname, '../../../test-results/account-actions');

async function checkDialog(page, selector, width) {
  const dialog = page.locator(selector);
  await dialog.waitFor({ state: 'visible' });
  const dimensions = await dialog.evaluate(el => {
    const box = el.getBoundingClientRect();
    const buttons = [...el.querySelectorAll('.account-confirm-actions button')].map(button => {
      const r = button.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    });
    return { x: box.x, right: box.right, bottom: box.bottom, overflow: el.scrollWidth > el.clientWidth, buttons };
  });
  assert.ok(dimensions.x >= 0 && dimensions.right <= width && !dimensions.overflow);
  assert.ok(dimensions.bottom <= await page.evaluate(() => innerHeight));
  const [cancel, confirm] = dimensions.buttons;
  assert.ok(cancel.height >= 44 && confirm.height >= 44);
  assert.ok(Math.abs(cancel.width - confirm.width) < 1);
  if (width <= 560) {
    assert.ok(Math.abs(cancel.x - confirm.x) < 1);
    assert.ok(confirm.y >= cancel.bottom + 7);
  } else assert.ok(Math.abs(cancel.y - confirm.y) < 1);
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const [width, height, theme] of [[280, 568, 'dark'], [320, 568, 'dark'], [360, 780, 'dark'], [390, 844, 'light'], [600, 900, 'dark'], [760, 500, 'dark'], [820, 900, 'dark'], [1440, 900, 'dark']]) {
      const { context, page } = await prepare(browser, width, height, theme);
      let deletes = 0;
      let fail = true;
      let tokenAtLogout;
      await page.route(base + '/login', async route => {
        if (route.request().isNavigationRequest()) {
          const storage = await context.storageState();
          tokenAtLogout = storage.origins.flatMap(origin => origin.localStorage).find(item => item.name === 'ludora_token');
        }
        return route.continue();
      });
      await page.route('**/usuarios/me', async route => {
        if (route.request().method() !== 'DELETE') return route.fallback();
        deletes++;
        await new Promise(resolve => setTimeout(resolve, 250));
        return route.fulfill({ status: fail ? 400 : 200, json: fail ? { error: 'Não foi possível excluir a conta' } : { mensagem: 'Conta excluída com sucesso' } });
      });
      await page.goto(base + '/perfil');
      const deletion = page.locator('.perfil-exclusao');
      await deletion.waitFor();
      const tabs = await page.locator('.perfil-atalhos').evaluate(nav => ({
        overflow: nav.scrollWidth > nav.clientWidth,
        buttons: [...nav.querySelectorAll('button')].map(button => ({
          top: button.getBoundingClientRect().top,
          overflow: button.scrollWidth > button.clientWidth,
          height: button.getBoundingClientRect().height,
        })),
      }));
      assert.ok(!tabs.overflow && tabs.buttons.every(button => !button.overflow && button.height >= 44), 'Abas sem cortes e com área de toque');
      if (width >= 320) assert.ok(tabs.buttons.every(button => Math.abs(button.top - tabs.buttons[0].top) < 1), 'As três abas cabem na mesma linha');
      const summaryLayout = await deletion.locator('summary').evaluate(summary => {
        const [icon, label, chevron] = [...summary.children].map(el => {
          const rect = el.getBoundingClientRect();
          return { width: rect.width, left: rect.left, right: rect.right };
        });
        return { icon, label, chevron };
      });
      assert.equal(summaryLayout.icon.width, 18, 'Ícone não deve esticar junto com o texto');
      assert.equal(summaryLayout.chevron.width, 16);
      assert.ok(summaryLayout.label.left - summaryLayout.icon.right <= 11, 'Ícone próximo do texto');
      await deletion.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `profile-${width}-${theme}.png`), fullPage: true });
      assert.equal(await deletion.getAttribute('open'), null);
      assert.equal(await deletion.getByRole('button', { name: 'Excluir minha conta' }).isVisible(), false);
      await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
      await checkDialog(page, '.logout-dialog', width);
      await page.screenshot({ path: path.join(output, `logout-${width}-${theme}.png`) });
      await page.getByRole('button', { name: 'Continuar na conta' }).click();
      assert.equal(await page.locator('.logout-dialog').count(), 0);
      assert.equal(deletes, 0);
      await deletion.locator('summary').click();
      await deletion.getByRole('button', { name: 'Excluir minha conta' }).click();
      await checkDialog(page, '.delete-account-dialog', width);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.delete-account-dialog').count(), 0);
      assert.equal(deletes, 0);
      await deletion.getByRole('button', { name: 'Excluir minha conta' }).click();
      await page.screenshot({ path: path.join(output, `delete-${width}-${theme}.png`) });
      await page.locator('.delete-account-dialog').getByRole('button', { name: 'Manter minha conta' }).click();
      assert.equal(deletes, 0);

      if (width === 360) {
        await deletion.getByRole('button', { name: 'Excluir minha conta' }).click();
        await page.locator('.delete-account-dialog').getByRole('button', { name: 'Excluir minha conta', exact: true }).click();
        await page.getByRole('button', { name: 'Excluindo conta…' }).waitFor();
        assert.ok(await page.getByRole('button', { name: 'Excluindo conta…' }).isDisabled());
        await page.locator('.delete-account-dialog [role="alert"]').waitFor();
        assert.equal(deletes, 1);
        assert.ok(await page.evaluate(() => localStorage.getItem('ludora_token')));
        fail = false;
        await page.locator('.delete-account-dialog').getByRole('button', { name: 'Excluir minha conta', exact: true }).click();
        await page.waitForURL('**/selecionar-clube');
        await page.getByRole('heading', { name: 'Encontre o seu clube' }).waitFor();
        assert.equal(deletes, 2);
        assert.equal(tokenAtLogout, undefined);
      }
      if (width === 1440) {
        await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
        await page.getByRole('button', { name: 'Confirmar saída' }).click();
        await page.waitForURL('**/selecionar-clube');
        await page.getByRole('heading', { name: 'Encontre o seu clube' }).waitFor();
        assert.equal(deletes, 0, 'Sair da conta nunca exclui a conta');
        assert.equal(tokenAtLogout, undefined);
      }
      console.log(`OK conta: ${width}px, ${theme}`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
