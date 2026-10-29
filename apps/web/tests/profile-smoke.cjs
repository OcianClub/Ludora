// Executar com o Vite na porta 5187 e Playwright disponível via NODE_PATH.
// HTTP simulado: não acessa contas ou banco reais.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';
const output = path.resolve(__dirname, '../../../test-results/web-profile');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 760]) {
      const context = await browser.newContext({ viewport: { width, height: 600 } });
      try {
        await context.addInitScript(() => {
          localStorage.setItem('ludora_token', 'visual-test-only');
          localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex Morgan', email: 'visual@example.test' }));
          localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
          localStorage.setItem('ludora_clube_id', '2');
          localStorage.setItem('ludora_tema', 'dark');
        });
        const page = await context.newPage();
        await page.route('**/*', route => {
          const request = route.request();
          if (['xhr', 'fetch'].includes(request.resourceType())) return route.abort();
          if (new URL(request.url()).origin !== new URL(base).origin) return route.abort();
          return route.continue();
        });
        await require('./visual-fixture.cjs').install(page);
        await page.route('http://localhost:3000/times/contexto', route => route.fulfill({ status: 503, json: { error: 'Indisponível no teste' } }));
        await page.goto(base + '/perfil');
        await page.getByRole('textbox', { name: 'Nome', exact: true }).waitFor();

        async function checkScroll() {
          assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden', 'A página deve liberar a rolagem ao fechar o modal');
          assert.notEqual(await page.evaluate(() => document.documentElement.style.overflow), 'hidden');
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.mouse.move(width / 2, 400);
          await page.mouse.wheel(0, 500);
          await page.waitForFunction(() => window.scrollY > 0);
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          assert.ok(await page.getByRole('button', { name: 'Salvar alterações' }).evaluate(el => el.getBoundingClientRect().bottom <= document.querySelector('.bottom-nav').getBoundingClientRect().top), 'Salvar deve ficar acima da barra inferior');
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          await page.evaluate(() => window.scrollTo(0, 0));
        }

        await checkScroll();
        await page.getByRole('button', { name: 'Mais opções de navegação' }).click();
        await page.getByRole('dialog', { name: 'Mais opções' }).waitFor();
        await page.keyboard.press('Escape');
        await page.getByRole('dialog').waitFor({ state: 'detached' });
        await checkScroll();
        await page.getByRole('button', { name: 'Mais opções de navegação' }).click();
        await page.getByRole('dialog').getByRole('link', { name: 'Times', exact: true }).click();
        await page.waitForURL('**/times');
        await page.getByRole('button', { name: 'Mais opções de navegação' }).click();
        await page.getByRole('dialog', { name: 'Mais opções' }).getByRole('link', { name: 'Conta e preferências' }).click();
        await page.waitForURL('**/perfil');
        await checkScroll();
        await page.getByRole('tab', { name: 'Conta', exact: true }).click();
        await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
        await page.getByRole('button', { name: 'Continuar na conta' }).click();
        await page.getByRole('tab', { name: 'Dados pessoais' }).click();
        await checkScroll();
        for (const theme of ['dark', 'light']) {
          if (theme === 'light') {
            await page.getByRole('tab', { name: 'Preferências', exact: true }).click();
            await page.getByRole('radio', { name: 'Tema claro', exact: true }).click();
            await page.getByRole('tab', { name: 'Dados pessoais' }).click();
          }
          await page.screenshot({ path: path.join(output, `profile-${width}-${theme}.png`), fullPage: true });
        }
        console.log(`PASS perfil ${width}px: rolagem, menu Mais, troca de página, cancelar saída e temas`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
