const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { prepare, inspect } = require('./responsive-audit.cjs');

const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5188';
const output = path.resolve(
  __dirname,
  '../../../test-results/responsive-audit',
);
const results = [];
const failures = [];

async function check(page, name, extra) {
  await page.waitForTimeout(100);
  const layout = await inspect(page);
  const details = extra ? await extra() : {};
  const result = { name, ...page.viewportSize(), ...layout, ...details };
  results.push(result);
  await page.screenshot({
    path: path.join(output, `state-${page.viewportSize().width}-${name}.png`),
  });
  if (
    layout.overflow ||
    layout.outside.length ||
    layout.modalOutside ||
    details.overlap ||
    details.clipped
  )
    failures.push(result);
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const [width, height] of [
      [320, 740],
      [390, 480],
      [600, 900],
      [820, 600],
      [1024, 768],
      [1366, 620],
      [844, 390],
    ]) {
      const { page, context } = await prepare(browser, width, height, 'dark', {
        longContent: true,
      });
      const goto = async (route) => {
        await page.goto(base + route, { waitUntil: 'domcontentloaded' });
        await page.locator('.route-loading').waitFor({ state: 'hidden' });
        await page.waitForTimeout(160);
      };
      try {
        await goto('/dashboard');
        if (width > 760) {
          const toggle = page.getByRole('button', {
            name: 'Expandir navegação',
            exact: true,
          });
          if (await toggle.count()) await toggle.click();
          await check(page, 'sidebar-expanded', async () =>
            page.evaluate(() => {
              const side = document
                .querySelector('.sidebar')
                .getBoundingClientRect();
              const main = document
                .querySelector('.workspace')
                .getBoundingClientRect();
              return { overlap: side.right > main.left + 1 };
            }),
          );
        }
        if (width <= 760) await goto('/selecionar-clube');
        await page
          .getByRole('button', { name: 'Menu da conta', exact: true })
          .filter({ visible: true })
          .first()
          .click();
        await check(page, 'account-menu');
        await page.keyboard.press('Escape');
        if (width <= 760) {
          await goto('/dashboard');
          await page
            .getByRole('button', {
              name: 'Mais opções de navegação',
              exact: true,
            })
            .click();
          await check(page, 'mobile-navigation');
          await page.keyboard.press('Escape');
        }
        await page
          .getByRole('button', { name: /^Notificações,/ })
          .filter({ visible: true })
          .first()
          .click();
        await page
          .getByRole('dialog', { name: 'Notificações', exact: true })
          .waitFor();
        await check(page, 'notifications');
        await page.getByRole('combobox', { name: /tipo/i }).first().click();
        await check(page, 'notification-options');
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        for (const section of ['preferencias', 'clubes']) {
          await goto(`/perfil?secao=${section}`);
          await check(page, `profile-${section}`);
        }
        await goto('/membros');
        await page
          .getByRole('button', { name: 'Convidar pessoa', exact: true })
          .first()
          .click();
        await check(page, 'invite');
        await page.keyboard.press('Escape');
        await goto('/jogadores');
        await page
          .getByRole('button', { name: '+ Adicionar aluno', exact: true })
          .click();
        await check(page, 'player-create');
        await page
          .getByRole('dialog')
          .getByRole('button', { name: /^Mês/ })
          .click();
        await check(page, 'birth-month');
        await goto('/times');
        await page
          .getByRole('button', { name: /^Ver time / })
          .first()
          .click();
        await page.getByRole('dialog').last().waitFor();
        await check(page, 'team-panel');
        await page.keyboard.press('Escape');
        await goto('/partidas');
        await page
          .getByRole('button', { name: 'Nova partida', exact: true })
          .filter({ visible: true })
          .first()
          .click();
        await page
          .getByRole('dialog')
          .getByRole('button', {
            name: 'Selecionar categoria da partida',
            exact: true,
          })
          .click();
        await page
          .getByRole('dialog', { name: 'Categoria da partida', exact: true })
          .waitFor();
        await check(page, 'match-category');
        await page.keyboard.press('Escape');
        await page
          .getByRole('dialog')
          .getByRole('button', { name: /^Selecionar adversário/ })
          .click();
        await page
          .getByRole('dialog', { name: 'Selecionar adversário', exact: true })
          .waitFor();
        await check(page, 'match-opponent');
        await goto('/partidas/106');
        const dataStep = page.locator('.preparation-steps button').first();
        if (await dataStep.count()) await dataStep.click();
        await check(page, 'match-data');
        const lineup = page
          .getByRole('button', {
            name: /Montar escalação|Continuar para escalação/,
          })
          .first();
        if (await lineup.count()) {
          await lineup.click();
          await check(page, 'match-lineup');
          const review = page.getByRole('button', { name: 'Salvar e revisar' });
          if ((await review.count()) && (await review.isEnabled())) {
            await review.click();
            await check(page, 'match-review');
          }
        }
        await goto('/competicoes');
        await page
          .getByRole('button', { name: '+ Nova competição', exact: true })
          .click();
        await page
          .getByLabel('Nome', { exact: true })
          .fill('Copa' + 'Regional'.repeat(18));
        await check(page, 'competition-create');
        await page
          .getByRole('dialog')
          .locator('.choice-trigger')
          .first()
          .click();
        await check(page, 'competition-options');
      } catch (error) {
        failures.push({ width, height, error: error.message });
      }
      await context.close();
      console.log(`STATES ${width}x${height}`);
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(
    path.join(output, process.env.AUDIT_REPORT || 'states.json'),
    JSON.stringify({ results, failures }, null, 2),
  );
  console.log(
    JSON.stringify({ checks: results.length, failures: failures.length }),
  );
  assert.equal(
    failures.length,
    0,
    JSON.stringify(failures.slice(0, 4), null, 2),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
