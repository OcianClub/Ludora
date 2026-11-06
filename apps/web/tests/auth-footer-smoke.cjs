const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';

async function checkOverlayKeyboard(page) {
  const footer = page.locator('.auth-footer');
  for (const input of await page.locator('.auth-form input:not([type="checkbox"])').all()) {
    assert.equal(await input.evaluate(el => getComputedStyle(el).fontSize), '13px', 'Texto digitado usa o tamanho comum do formulário');
    assert.equal(await input.evaluate(el => getComputedStyle(el, '::placeholder').fontSize), '13px', 'Placeholder acompanha o texto digitado');
    await input.focus();
    await page.evaluate(() => {
      Object.defineProperty(visualViewport, 'height', { value: 420, configurable: true });
      Object.defineProperty(visualViewport, 'offsetTop', { value: 0, configurable: true });
      visualViewport.dispatchEvent(new Event('resize'));
    });
    await page.waitForFunction(() => document.querySelector('.auth-page').dataset.authEditing === 'true');
    assert.equal(await footer.evaluate(el => getComputedStyle(el).position), 'static');
    await page.waitForFunction(() => {
      const rect = document.activeElement.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= 401;
    });
    const fieldBox = await input.boundingBox();
    const footerBox = await footer.boundingBox();
    assert.ok(footerBox.y >= fieldBox.y + fieldBox.height, 'Rodapé fica depois do campo, sem sobrepor');
  }
  await page.evaluate(() => {
    document.activeElement.blur();
    delete visualViewport.height;
    delete visualViewport.offsetTop;
    visualViewport.dispatchEvent(new Event('resize'));
  });
  await page.waitForFunction(() => document.querySelector('.auth-page').dataset.authEditing === 'false');
  assert.equal(await footer.evaluate(el => getComputedStyle(el).position), 'fixed');
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 760, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width <= 760, isMobile: width <= 760 });
      await page.route('**/*', route => ['fetch', 'xhr'].includes(route.request().resourceType())
        ? route.abort() : route.continue());
      for (const path of ['/login', '/registrar']) {
        await page.goto(base + path);
        await page.locator('.auth-form').waitFor();
        const footer = page.locator('.auth-footer');
        await footer.waitFor();
        assert.equal(await footer.evaluate(el => getComputedStyle(el).position), width <= 760 ? 'fixed' : 'static');
        const button = footer.getByRole('button');
        assert.equal(await button.evaluate(el => el.form?.id), path === '/login' ? 'login-form' : 'register-form');
        if (width <= 760) {
          assert.ok(Math.abs((await footer.boundingBox()).y + (await footer.boundingBox()).height - 844) < 2);
          const inputs = page.locator('.auth-form input:not([type="checkbox"])');
          const invite = page.locator('.access-invite');
          assert.equal(await invite.evaluate(el => el.parentElement.classList.contains('auth-card')), true, 'Convite fica no conteúdo, fora do rodapé');
          assert.ok((await invite.boundingBox()).y >= (await inputs.last().boundingBox()).y + (await inputs.last().boundingBox()).height, 'Convite fica abaixo dos campos');
          assert.ok(await invite.locator('small').isVisible(), 'Convite mantém descrição do app');
          assert.ok((await invite.boundingBox()).height >= 80, 'Convite usa o card completo');
          await checkOverlayKeyboard(page);
          await page.setViewportSize({ width, height: 420 });
          await inputs.last().focus();
          await page.waitForFunction(() => document.querySelector('.auth-page').dataset.authEditing === 'true');
          await page.waitForFunction(() => document.activeElement.getBoundingClientRect().bottom <= innerHeight - 19);
          assert.equal(await footer.evaluate(el => getComputedStyle(el).position), 'static');
          await page.evaluate(() => document.activeElement.blur());
          await page.setViewportSize({ width, height: 844 });
          await page.waitForFunction(() => document.querySelector('.auth-page').dataset.authEditing === 'false');
        } else {
          assert.ok((await page.locator('.access-invite').boundingBox()).y > (await footer.boundingBox()).y);
        }
        await button.click();
        await page.locator('.access-field-feedback').first().waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (path === '/registrar') {
          await page.locator('input[name="nome"]').fill('João Teste');
          await page.locator('input[name="email"]').fill('joao@example.test');
          await button.click();
          await page.getByRole('heading', { name: 'Proteja sua conta' }).waitFor();
          if (width <= 760) await checkOverlayKeyboard(page);
          await page.locator('input[name="senha"]').fill('teste1234');
          await page.locator('input[name="confirmacao"]').fill('teste1234');
          await page.route('**/auth/cadastro/solicitar-codigo', route => route.fulfill({
            json: { cadastro_id: 'a'.repeat(64) },
          }));
          await button.click();
          await page.getByRole('heading', { name: 'Confirme seu e-mail' }).waitFor();
          if (width <= 760) await checkOverlayKeyboard(page);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        }
      }
      await page.close();
    }
    console.log('PASS: login e 3 etapas do cadastro, submit externo, rodapé sem sobreposição, campos visíveis e teclado simulado (overlay e resize) em 320/390/760/1440 px.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
