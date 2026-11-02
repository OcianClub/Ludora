const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 760, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.route('**/*', route => ['fetch', 'xhr'].includes(route.request().resourceType())
        ? route.abort() : route.continue());
      for (const path of ['/login', '/registrar']) {
        await page.goto(base + path);
        const footer = page.locator('.auth-footer');
        await footer.waitFor();
        assert.equal(await footer.evaluate(el => getComputedStyle(el).position), width <= 760 ? 'fixed' : 'static');
        const button = footer.getByRole('button');
        assert.equal(await button.evaluate(el => el.form?.id), path === '/login' ? 'login-form' : 'register-form');
        if (width <= 760) {
          assert.ok(Math.abs((await footer.boundingBox()).y + (await footer.boundingBox()).height - 844) < 2);
          await page.evaluate(() => {
            Object.defineProperty(visualViewport, 'height', { value: 480, configurable: true });
            visualViewport.dispatchEvent(new Event('resize'));
          });
          await page.waitForFunction(() => document.querySelector('.auth-page').style.getPropertyValue('--auth-keyboard-inset') === '364px');
          const box = await footer.boundingBox();
          assert.ok(box.y + box.height <= 481, 'Rodapé fica acima do teclado simulado');
          await page.evaluate(() => {
            delete visualViewport.height;
            visualViewport.dispatchEvent(new Event('resize'));
          });
          await page.waitForFunction(() => document.querySelector('.auth-page').style.getPropertyValue('--auth-keyboard-inset') === '0px');
        } else {
          assert.ok((await page.locator('.access-invite').boundingBox()).y > (await footer.boundingBox()).y);
        }
        await button.click();
        await page.locator('.access-field-feedback').first().waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      await page.close();
    }
    console.log('PASS: login/cadastro, submit externo, rodapé e teclado simulado em 320/390/760/1440 px.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
