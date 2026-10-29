const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(__dirname, '../../../test-results/club-picker');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  try {
    for (const { width, theme } of [320, 390, 820, 1366].flatMap(width => ['dark', 'light'].map(theme => ({ width, theme })))) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(theme => {
        localStorage.setItem('ludora_tema', theme);
        localStorage.setItem('ludora_token', 'test');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex', email: 'alex@example.test' }));
        localStorage.setItem('ludora_clube_id', '2');
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
      }, theme);
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await require('./visual-fixture.cjs').install(page);
      let rows = [
        { id: 2, nome: 'Ocian', meuPapel: 'ADMIN', isSeguindo: true, seguidores: 2, cidade: 'Praia Grande', estado: 'SP', acessoTodasCategorias: true, partidasAoVivo: 1 },
        { id: 3, nome: 'Santos', meuPapel: 'TORCEDOR', isSeguindo: true, seguidores: 1, partidasAoVivo: 1 },
        { id: 4, nome: 'Aurora', meuPapel: null, isSeguindo: false, seguidores: 0 },
        { id: 5, nome: 'Clube Base', meuPapel: 'TECNICO', categoriasAcesso: [{ id: 7, nome: 'sub-7' }, { id: 8, nome: 'sub-8' }] },
      ];
      await page.route('**/clubes', route => route.fulfill({ json: rows }));
      await page.route('**/clubes/4/seguir', route => route.fulfill({ json: route.request().method() === 'DELETE' ? { ok: true, seguidores: 0 } : { papel: 'TORCEDOR', seguidores: 12 } }));
      await page.goto('http://127.0.0.1:5187/selecionar-clube');
      await page.getByRole('heading', { name: 'Descobrir', exact: true }).waitFor();
      const sections = page.locator('.club-picker-section');
      assert.match(await sections.nth(0).innerText(), /Com cargo/i);
      assert.match(await sections.nth(1).innerText(), /Que você segue/i);
      assert.match(await sections.nth(2).innerText(), /Descobrir/i);
      assert.equal(await page.locator('.club-picker-card').count(), 4);
      for (const id of [2, 3, 4, 5]) assert.equal(await page.locator(`[data-club-id="${id}"]`).count(), 1, 'Each club appears once');
      assert.equal(await sections.first().locator('.club-picker-card').first().getAttribute('data-club-id'), '2');
      assert.equal(await page.locator('.club-picker-live').count(), 2);
      assert.match(await sections.first().innerText(), /Todas as categorias/);
      assert.match(await sections.first().innerText(), /SUB-7, SUB-8/);
      assert.equal(await page.locator('.club-picker-shortcut').count(), 0);
      assert.equal(await page.locator('[data-club-id="2"] .club-picker-follow, [data-club-id="2"] .club-picker-favorite').count(), 0);
      await page.getByRole('button', { name: 'Acessar Ocian', exact: true }).focus();
      assert.ok(await page.getByRole('button', { name: 'Acessar Ocian', exact: true }).evaluate(el => el === document.activeElement));
      await page.getByRole('button', { name: 'Seguir Aurora', exact: true }).click();
      await sections.nth(1).getByRole('button', { name: 'Deixar de seguir Aurora' }).waitFor();
      assert.equal(await page.locator('[data-club-id="4"]').count(), 1);
      assert.match(await sections.nth(1).innerText(), /12 seguidores/);
      const search = page.getByRole('searchbox', { name: 'Buscar clube' });
      await search.fill('Aurora');
      assert.equal(await sections.count(), 1);
      assert.equal(await page.locator('.club-picker-card').count(), 1);
      assert.match(await page.getByRole('button', { name: 'Deixar de seguir Aurora' }).innerText(), /Seguindo/);
      await page.getByRole('button', { name: 'Deixar de seguir Aurora' }).click();
      if (width <= 760) {
        const confirmation = page.getByRole('dialog', { name: 'Deixar de seguir?' });
        await confirmation.getByRole('button', { name: 'Cancelar' }).click();
        assert.equal(await page.getByRole('button', { name: 'Deixar de seguir Aurora' }).count(), 1);
        await page.getByRole('button', { name: 'Deixar de seguir Aurora' }).click();
        await confirmation.getByRole('button', { name: 'Deixar de seguir', exact: true }).click();
      }
      await page.getByRole('button', { name: 'Seguir Aurora', exact: true }).waitFor();
      assert.equal(new URL(page.url()).pathname, '/selecionar-clube', 'Follow action does not enter club');
      assert.match(await page.locator('[data-club-id="4"]').innerText(), /0 seguidores/);
      await search.fill('Clube Base');
      assert.match(await page.locator('.club-picker-card').innerText(), /Técnico/);
      await search.fill('inexistente');
      assert.match(await page.locator('.club-picker-empty').innerText(), /Nenhum clube encontrado/);
      await page.getByRole('button', { name: 'Limpar busca' }).click();
      assert.equal(await page.locator('.club-picker-card').count(), 4);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(output, `club-picker-${width}-${theme}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Menu da conta' }).click();
      assert.ok(await page.getByRole('dialog', { name: 'Conta e aparência' }).isVisible());
      await page.keyboard.press('Escape');
      rows = [];
      await page.reload();
      await page.locator('.club-picker-empty').waitFor();
      assert.match(await page.locator('.club-picker-empty').innerText(), /Ainda não há clubes cadastrados/);
      await context.close();
      console.log(`Clubes OK: ${width}px ${theme}; unique relations, search, follow/unfollow, live status and empty state`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
