const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5189';
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const output = path.resolve('../../test-results/invite-composer'); fs.mkdirSync(output, { recursive: true });
  try {
    for (const width of [320, 390, 768, 1366]) for (const theme of ['dark', 'light']) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
      await context.addInitScript(theme => {
        localStorage.setItem('ludora_token', 'members-test');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
        localStorage.setItem('ludora_clube_id', '2');
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
        localStorage.setItem('ludora_tema', theme);
      }, theme);
      const page = await context.newPage();
      await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
      await require('./visual-fixture.cjs').install(page);
      let posted;
      await page.route('http://localhost:3000/convites*', route => {
        if (route.request().method() === 'POST') {
          posted = route.request().postDataJSON();
          return route.fulfill({ json: { convite: { id: 'invite-1', email: posted.email, expira_em: '2030-11-01T12:00:00Z' }, codigo: 'ABCD-2345', email_enviado: posted.entrega === 'email' } });
        }
        return route.fulfill({ json: { convites: [] } });
      });
      await page.goto(base + '/membros');
      await page.locator('.members-person').first().waitFor();
      assert.equal(await page.locator('.members-table').evaluate(el => getComputedStyle(el).display), 'table');
      assert.ok(await page.locator('.members-table thead').isVisible());
      await page.getByRole('button', { name: /Convidar pessoa/ }).first().click();
      let dialog = page.getByRole('dialog', { name: 'Convidar pessoa' });
      if (width <= 760) {
        await page.waitForTimeout(220);
        const bounds = await dialog.boundingBox();
        assert.ok(Math.abs(bounds.x) <= 1 && Math.abs(bounds.width - width) <= 1);
        assert.ok(Math.abs(bounds.y + bounds.height - 844) <= 1);
      }
      await dialog.getByRole('button', { name: 'Enviar convite' }).click();
      await dialog.getByRole('alert').waitFor();
      await dialog.getByRole('radio', { name: 'Gerar código', exact: true }).check();
      await dialog.getByRole('button', { name: 'Gerar código' }).click();
      await dialog.getByRole('alert').getByText('Escolha ao menos uma categoria para o técnico.').waitFor();
      await dialog.getByRole('button', { name: 'SUB-7', exact: true }).click();
      await dialog.getByRole('button', { name: 'Gerar código' }).click();
      dialog = page.getByRole('dialog', { name: 'Convite criado' });
      await dialog.getByLabel('Código de uso único', { exact: true }).waitFor();
      assert.equal(posted.email, ''); assert.equal(posted.entrega, 'codigo'); assert.deepEqual(posted.categoria_ids, [1]);
      await dialog.getByRole('button', { name: 'Copiar código' }).click();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'ABCD-2345');
      await dialog.getByRole('button', { name: 'Copiar link' }).click();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), base + '/convite/ABCD-2345?entrar=1');
      assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      await dialog.screenshot({ path: path.join(output, `success-${width}-${theme}.png`) });
      await dialog.getByRole('button', { name: 'Gerar outro' }).click();
      dialog = page.getByRole('dialog', { name: 'Convidar pessoa' });
      assert.equal(await dialog.getByLabel('E-mail da pessoa').inputValue(), '');
      await dialog.getByRole('radio', { name: /Administrador/ }).check();
      assert.equal(await dialog.locator('.invite-categories').count(), 0);
      await dialog.getByRole('radio', { name: /Olheiro/ }).check();
      assert.equal(await dialog.locator('.invite-categories').count(), 0);
      await dialog.getByRole('radio', { name: /Técnico/ }).check();
      await dialog.getByRole('button', { name: 'SUB-8', exact: true }).click();
      await dialog.getByLabel('E-mail da pessoa').fill('teste@example.com');
      await dialog.screenshot({ path: path.join(output, `form-${width}-${theme}.png`) });
      await dialog.getByRole('button', { name: 'Enviar convite' }).click();
      dialog = page.getByRole('dialog', { name: 'Convite criado' });
      await dialog.getByText(/Convite enviado para teste@example.com/).waitFor();
      assert.equal(await dialog.getByLabel('Código de uso único', { exact: true }).inputValue(), 'ABCD-2345');
      assert.ok(await dialog.getByRole('button', { name: 'Copiar código' }).isVisible());
      assert.ok(await dialog.getByRole('button', { name: 'Copiar link' }).isVisible());
      await dialog.getByRole('button', { name: /Convites pendentes/ }).click();
      assert.equal(await dialog.count(), 0);
      assert.equal(posted.entrega, 'email'); assert.equal(posted.email, 'teste@example.com');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await context.close();
      console.log(`${width}px ${theme}: cargo, categorias, e-mail, código aberto e cópia do link OK`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
