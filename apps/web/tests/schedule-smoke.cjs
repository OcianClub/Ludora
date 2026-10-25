const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';
const output = path.resolve(__dirname, '../../../test-results/web-schedule');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  try {
    for (const width of [320, 390, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      try {
        await context.addInitScript(() => {
          localStorage.setItem('ludora_token', 'visual-test-only');
          localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex', email: 'visual@example.test' }));
          localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
          localStorage.setItem('ludora_clube_id', '2');
          localStorage.setItem('ludora_tema', 'dark');
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
        await require('./visual-fixture.cjs').install(page);
        let matches = Array.from({ length: 55 }, (_, index) => ({
          id: index + 1,
          categoria_id: index % 2 + 1,
          categoria: { id: index % 2 + 1, nome: index % 2 ? 'sub-8' : 'sub-7', tipo: 'INICIACAO', clube_id: 2 },
          mandante_id: 13, visitante_id: 14,
          mandante: { id: 13, nome: 'Ocian sub-7' },
          visitante: { id: 14, nome: index % 2 ? 'União Esportiva sub-7' : 'Santos sub-7' },
          gols_mandante: 2, gols_visitante: 1,
          data: `${index >= 34 ? '2025' : '2026'}-10-${String(index % 28 + 1).padStart(2, '0')}T12:00:00Z`,
          horario: '19:30', local: 'Quadra principal', emCasa: true,
          status: index < 24 ? 'AO_VIVO' : index < 34 ? 'AGENDADA' : index < 54 ? 'FINALIZADA' : 'CANCELADA',
          somente_leitura: index === 1,
        }));
        await page.route('**/partidas?*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(matches) }));
        await page.goto(base + '/partidas');
        await page.locator('.match-card').first().waitFor();
        const live = page.locator('.schedule-section').filter({ has: page.getByRole('button', { name: /^Ao vivo/ }) });
        const history = page.locator('.schedule-section').filter({ has: page.getByRole('button', { name: /^Finalizados/ }) });
        assert.equal(await live.locator('.match-card').count(), 12);
        assert.equal(await history.locator('.match-card').count(), 0, 'Histórico fechado não monta os cards');
        await live.getByRole('button', { name: /Mostrar mais partidas/ }).click();
        assert.equal(await live.locator('.match-card').count(), 24);
        await live.getByRole('button', { name: /^Ao vivo/ }).click();
        assert.equal(await live.locator('.match-card').count(), 0);
        await live.getByRole('button', { name: /^Ao vivo/ }).press('Enter');
        assert.equal(await live.locator('.match-card').count(), 24);
        assert.equal(await page.getByRole('button', { name: /Excluir partida/ }).count(), 0);
        assert.equal(await page.locator('.match-card-live').first().evaluate(el => getComputedStyle(el).backgroundImage), 'none');
        assert.equal(await page.locator('.match-team .club-badge').first().evaluate(el => getComputedStyle(el).borderWidth), '0px');
        await page.getByRole('button', { name: /^Filtros/ }).click();
        const year = page.getByRole('combobox', { name: 'Ano', exact: true });
        await year.focus();
        await year.press('ArrowDown');
        await year.press('End');
        await year.press('Enter');
        assert.equal(await year.getAttribute('data-value'), '2025');
        assert.equal(await page.locator('.match-card-live').count(), 0);
        assert.equal(await history.locator('.match-card').count(), 12);
        await page.getByRole('combobox', { name: 'Situação' }).click();
        await page.getByRole('option', { name: 'Finalizada', exact: true }).click();
        await page.getByRole('combobox', { name: 'Mês', exact: true }).click();
        await page.getByRole('option', { name: 'outubro', exact: true }).click();
        await page.getByRole('searchbox', { name: 'Buscar adversário' }).fill('uniao');
        assert.ok(await page.locator('.match-card').count() > 0, 'Busca ignora acentos');
        await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
        assert.equal(await page.getByRole('combobox', { name: 'Ano', exact: true }).getAttribute('data-value'), '');
        assert.equal(await history.locator('.match-card').count(), 0);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.getByRole('button', { name: /^Filtros/ }).click();
        for (const theme of ['dark', 'light']) {
          await page.evaluate(value => { localStorage.setItem('ludora_tema', value); window.dispatchEvent(new Event('ludora:theme-change')); }, theme);
          await page.screenshot({ path: path.join(output, `schedule-${width}-${theme}.png`), fullPage: true, animations: 'disabled' });
        }
        await live.locator('a[href="/partidas/1"]').click();
        await page.getByRole('button', { name: 'Excluir partida', exact: true }).waitFor();
        let failDelete = true;
        await page.route('**/partidas/1', async route => {
          assert.equal(route.request().method(), 'DELETE');
          if (failDelete) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Tente novamente em instantes."}' });
          matches = matches.filter(match => match.id !== 1);
          return route.fulfill({ contentType: 'application/json', body: '{}' });
        });
        await page.getByRole('button', { name: 'Excluir partida', exact: true }).click();
        const confirmation = page.getByRole('dialog', { name: 'Confirmar exclusão' });
        await confirmation.getByRole('button', { name: 'Confirmar exclusão', exact: true }).click();
        await confirmation.getByRole('alert').waitFor();
        assert.ok(matches.some(match => match.id === 1));
        failDelete = false;
        await confirmation.getByRole('button', { name: 'Confirmar exclusão', exact: true }).click();
        await page.waitForURL('**/partidas');
        assert.equal(matches.some(match => match.id === 1), false);
        await page.goto(base + '/partidas/2');
        await page.getByText(/Histórico compartilhado:/).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Excluir partida', exact: true }).count(), 0);
        console.log(`PASS ${width}px: acordeões, limite de cards, filtros, acessibilidade e exclusão simulada`);
      } finally { await context.close(); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
