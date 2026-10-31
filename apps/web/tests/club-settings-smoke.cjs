const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';
const output = path.resolve(__dirname, '../../../test-results/club-settings');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  async function setup(width, theme, role = 'ADMIN') {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
    await context.addInitScript(({ theme, role }) => {
      localStorage.setItem('ludora_token', 'visual-test-only');
      localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex Morgan' }));
      localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: role }));
      localStorage.setItem('ludora_clube_id', '2');
      localStorage.setItem('ludora_tema', theme);
    }, { theme, role });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      if (['xhr', 'fetch'].includes(route.request().resourceType())) return route.abort();
      return new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort();
    });
    await require('./visual-fixture.cjs').install(page, { role });
    const state = { profile: { id: 2, nome: 'Ocian', escudo: null, endereco: null }, writes: [], fail: false, failLoad: false };
    await page.route('**/clube/perfil', route => {
      if (route.request().method() === 'GET') return route.fulfill({ status: state.failLoad ? 503 : 200, json: state.failLoad ? { error: 'offline' } : state.profile });
      const payload = route.request().postDataJSON();
      state.writes.push(payload);
      if (state.fail) return route.fulfill({ status: 503, json: { error: 'Não foi possível salvar. Tente novamente.' } });
      state.profile = { ...state.profile, ...payload };
      return route.fulfill({ json: state.profile });
    });
    await page.goto(base + '/clube');
    await page.getByRole('heading', { name: role === 'ADMIN' ? 'Configurações do clube' : 'Sobre o clube', exact: true }).waitFor();
    await page.getByLabel('Nome do clube', { exact: true }).waitFor();
    return { page, context, state };
  }

  try {
    for (const width of [320, 390, 820, 1440]) {
      for (const theme of ['dark', 'light']) {
        const { page, context, state } = await setup(width, theme);
        try {
          const save = page.getByRole('button', { name: 'Salvar alterações', exact: true });
          assert.ok(await save.isDisabled());
          assert.equal(await page.locator('.club-crest-preview img').count(), 0);
          const png = await page.evaluate(() => {
            const canvas = document.createElement('canvas');
            canvas.width = 960; canvas.height = 480;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#0E78FF'; ctx.fillRect(200, 80, 560, 320);
            return canvas.toDataURL('image/png').split(',')[1];
          });
          await page.getByLabel('Selecionar escudo do clube').setInputFiles({ name: 'escudo-teste.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
          await page.getByText('Selecionado: escudo-teste.png').waitFor();
          const crest = page.locator('.club-crest-preview img');
          await crest.evaluate(image => image.decode());
          const image = await crest.evaluate(image => {
            const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
            const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
            return { width: canvas.width, height: canvas.height, alpha: ctx.getImageData(0, 0, 1, 1).data[3], src: image.src };
          });
          assert.equal(image.width, 512);
          assert.equal(image.height, 256);
          assert.equal(image.alpha, 0, 'Transparência preservada');
          assert.ok(image.src.length <= 180000);
          await page.getByLabel('Selecionar escudo do clube').setInputFiles({ name: 'invalid.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
          await page.getByRole('alert').getByText('Escolha uma imagem PNG, JPG ou WebP.').waitFor();
          assert.equal(await crest.getAttribute('src'), image.src, 'Arquivo inválido preserva a imagem anterior');
          await page.getByLabel('Nome do clube', { exact: true }).fill('Ocian Praia Clube');
          await save.click();
          await page.getByText('As alterações do clube foram salvas.', { exact: true }).waitFor();
          assert.equal(state.profile.escudo, image.src);
          assert.equal(state.profile.nome, 'Ocian Praia Clube');
          assert.ok(await save.isDisabled());
          await page.getByRole('button', { name: 'Remover', exact: true }).click();
          await page.getByLabel('CEP', { exact: true }).fill('11704890');
          assert.equal(await page.getByLabel('CEP', { exact: true }).inputValue(), '11704-890');
          const writes = state.writes.length;
          await save.click();
          await page.getByText('Informe a rua ou avenida da sede.').waitFor();
          assert.equal(state.writes.length, writes, 'Endereço incompleto não é enviado');
          await page.getByLabel('Logradouro', { exact: true }).fill('Av. Presidente Kennedy');
          await page.getByLabel('Cidade', { exact: true }).fill('Praia Grande');
          await page.getByRole('combobox', { name: 'UF', exact: true }).selectOption('SP');
          state.fail = true;
          await save.click();
          await page.getByRole('alert').getByText('Não foi possível salvar. Tente novamente.').waitFor();
          assert.equal(await page.getByLabel('Cidade', { exact: true }).inputValue(), 'Praia Grande');
          state.fail = false;
          await save.click();
          await page.waitForFunction(() => document.querySelector('.club-settings-actions button').disabled);
          assert.equal(state.profile.escudo, null);
          assert.equal(state.profile.endereco.cep, '11704890');
          await page.locator('.club-settings-heading').scrollIntoViewIfNeeded();
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Sem overflow horizontal');
          for (const name of ['logradouro', 'numero', 'cidade', 'estado']) {
            const bounds = await page.locator(`[name="${name}"]`).boundingBox();
            assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, `${name} cabe na tela`);
          }
          await page.screenshot({ path: path.join(output, `${width}-${theme}.png`), fullPage: true, animations: 'disabled' });
          await page.reload();
          await page.getByLabel('Nome do clube', { exact: true }).waitFor();
          assert.equal(await page.getByLabel('Nome do clube', { exact: true }).inputValue(), 'Ocian Praia Clube');
          assert.equal(await page.getByLabel('Cidade', { exact: true }).inputValue(), 'Praia Grande');
          if (width < 761) {
            await page.getByRole('button', { name: 'Mais opções de navegação' }).click();
            const menu = page.getByRole('dialog', { name: 'Mais opções', exact: true });
            await menu.getByRole('link', { name: 'Configurações do clube', exact: true }).waitFor();
            assert.equal(await menu.locator('.mobile-more-links a').last().getAttribute('href'), '/clube');
          } else {
            await page.getByRole('button', { name: 'Expandir navegação', exact: true }).click();
            await page.locator('.sidebar').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
            const settings = page.locator('.sidebar-nav a').last();
            assert.equal(await settings.getAttribute('href'), '/clube', 'Configurações fica depois de Pessoas e acessos');
            const item = await settings.boundingBox();
            const label = await settings.locator('.nav-label').boundingBox();
            assert.ok(label.x + label.width <= item.x + item.width - 5, 'Texto completo cabe no item da sidebar');
            await page.screenshot({ path: path.join(output, `sidebar-${width}-${theme}.png`), animations: 'disabled' });
          }
          console.log(`PASS ${width}px ${theme}: upload, transparência, erros, endereço, persistência e navegação`);
        } finally { await context.close(); }
      }
    }
    for (const role of ['TECNICO', 'TORCEDOR']) {
      const { page, context } = await setup(390, 'dark', role);
      assert.ok(await page.getByLabel('Nome do clube', { exact: true }).getAttribute('readonly') !== null);
      assert.equal(await page.getByRole('button', { name: 'Salvar alterações', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Enviar escudo', exact: true }).count(), 0);
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS permissões de consulta e ausência de erros de execução. Testes sem serviços externos ou banco real.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
