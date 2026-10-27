const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [390, 1366]) {
      async function setup(mode) {
        const context = await browser.newContext({ viewport: { width, height: 800 } });
        await context.addInitScript(() => {
          localStorage.setItem('ludora_token', 'visual-test-only');
          localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
          localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
          localStorage.setItem('ludora_clube_id', '2');
        });
        const page = await context.newPage();
        await page.route('**/*', route => {
          if (['xhr', 'fetch'].includes(route.request().resourceType())) return route.abort();
          return new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort();
        });
        await require('./visual-fixture.cjs').install(page);
        const state = { failing: true };
        if (mode === 'core') await page.route('http://localhost:3000/partidas', route => state.failing
          ? route.fulfill({ status: 503, json: { error: 'offline' } }) : route.fallback());
        if (mode === 'partial') await page.route('http://localhost:3000/competicoes', route => state.failing
          ? route.fulfill({ status: 503, json: { error: 'offline' } }) : route.fallback());
        await page.goto(base + '/partidas');
        return { context, page, state };
      }

      {
        const { context, page, state } = await setup('core');
        const error = page.getByRole('alert');
        await error.getByRole('heading', { name: 'Não foi possível carregar a agenda' }).waitFor();
        assert.ok(await error.getByText(/servidor|conexão/).count());
        state.failing = false;
        await error.getByRole('button', { name: 'Tentar novamente' }).click();
        await page.getByRole('region', { name: 'Carrossel de partidas ao vivo' }).waitFor();
        assert.equal(await error.count(), 0);
        await context.close();
      }

      {
        const { context, page, state } = await setup('partial');
        const warning = page.getByText('Algumas opções não carregaram', { exact: true });
        await warning.waitFor();
        assert.ok(await page.locator('.match-card').count(), 'Falha auxiliar preserva as partidas');
        state.failing = false;
        await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
        await warning.waitFor({ state: 'detached' });
        await context.close();
      }

      {
        const { context, page } = await setup('empty');
        const toolbarY = (await page.locator('.schedule-results-toolbar').boundingBox()).y;
        if (width <= 760) {
          await page.getByRole('button', { name: /^Filtros/ }).click();
          const dialog = page.getByRole('dialog', { name: 'Filtrar partidas' });
          await dialog.getByRole('searchbox').fill('adversário inexistente');
          await dialog.getByRole('button', { name: 'Aplicar filtros' }).click();
        } else {
          await page.getByRole('searchbox', { name: 'Buscar time, adversário ou local' }).fill('adversário inexistente');
        }
        await page.getByRole('heading', { name: 'Nenhuma partida com estes filtros' }).waitFor();
        assert.ok(Math.abs((await page.locator('.schedule-results-toolbar').boundingBox()).y - toolbarY) < 1, 'Chip não desloca a barra de resultados');
        await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
        await page.getByRole('region', { name: 'Carrossel de partidas ao vivo' }).waitFor();
        await context.close();
      }
      console.log(`PASS ${width}px: erro recuperável, carregamento parcial, vazio filtrado e layout estável`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
