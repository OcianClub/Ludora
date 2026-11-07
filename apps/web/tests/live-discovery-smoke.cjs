const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { prepare } = require('./responsive-audit.cjs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5191';
const output = path.resolve(__dirname, '../../../test-results/live-discovery');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 820, 1366]) {
      const { page, context } = await prepare(browser, width, 900);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      let games = Array.from({ length: 6 }, (_, i) => ({ id: 105 + i, data: '2026-11-07T00:00:00Z', horario: '19:30', categoria: 'sub-7',
        clube_ids: [4], gols_mandante: i, gols_visitante: 1,
        mandante: { nome: i ? 'Associação de Nome Muito Extenso para Testar' : 'Ludora FC' }, visitante: { nome: 'Adversário externo' } }));
      let calls = 0;
      await page.route('http://localhost:3000/publico/partidas/ao-vivo', route => {
        calls++; return route.fulfill({ json: games });
      });
      await page.goto(base + '/selecionar-clube');
      await page.locator('.club-live-match').first().waitFor();
      assert.equal(await page.locator('.club-live-match').count(), 6);
      assert.ok((await page.locator('.club-live-match').first().getAttribute('href')).includes('/partidas/105?clube_id=4'));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const track = page.locator('.club-live-track');
      assert.equal(await track.evaluate(el => el.scrollWidth > el.clientWidth), true);
      if (width > 760) {
        assert.equal(await page.getByRole('button', { name: 'Partidas ao vivo anteriores' }).isDisabled(), true);
        await page.getByRole('button', { name: 'Próximas partidas ao vivo' }).click();
      } else {
        assert.equal(await page.getByRole('button', { name: 'Próximas partidas ao vivo' }).isVisible(), false);
        await track.focus(); await page.keyboard.press('ArrowRight');
      }
      await page.waitForFunction(() => document.querySelector('.club-live-track').scrollLeft > 10);
      await page.screenshot({ path: path.join(output, `clubes-${width}.png`), fullPage: true });
      // A refetch updates scores without adding duplicate cards or leaving the view.
      games = games.slice(0, width > 760 ? 2 : 1); games[0].gols_mandante = 9;
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      await page.waitForFunction(n => document.querySelectorAll('.club-live-match').length === n, games.length);
      assert.match(await page.locator('.club-live-match').first().getAttribute('aria-label'), /9 a 1/);
      if (width > 760) assert.equal(await page.locator('.club-live-carousel > button').count(), 0, 'sem setas quando todos os jogos cabem');
      games = [];
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      await page.locator('.club-live-section').waitFor({ state: 'detached' });
      assert.equal(calls, 3, 'uma consulta inicial e uma por atualização, sem duplicar');
      assert.deepEqual(errors, []);
      console.log(`PASS carrossel ${width}px: navegação, overflow, teclado, atualização e estado vazio`);
      await context.close();
    }
    // Verify actual navigation changes club context, even starting in another club's management mode.
    const { page, context } = await prepare(browser, 1366, 900);
    let publicMatchRequests = 0;
    await page.route('http://localhost:3000/publico/clubes/4/times', route => route.fulfill({ json: [] }));
    await page.route('http://localhost:3000/publico/partidas/105**', route => {
      publicMatchRequests++;
      const selected = new URL(route.request().url()).searchParams.get('clube_id');
      assert.equal(selected, '4');
      return route.fulfill({ json: { clube: { id: 4, nome: 'Ludora FC' }, partida: { id: 105, categoria_id: 1,
        categoria: { id: 1, nome: 'sub-7' }, data: '2026-11-07', horario: '19:30', status: 'AO_VIVO',
        mandante_id: 1, visitante_id: 2, mandante: { id: 1, nome: 'Ludora FC' }, visitante: { id: 2, nome: 'Adversário externo' },
        gols_mandante: 1, gols_visitante: 0, versao: 1, periodo_atual: 1, sumula_clube_id: 4, organizador_id: 4 },
        organizador: { id: 4, nome: 'Ludora FC' }, equipes: [], eventos: [], auditoria: [], podePreparar: false, podeSumula: false } });
    });
    await page.route('http://localhost:3000/publico/partidas/ao-vivo', route => route.fulfill({ json: [{ id: 105, data: '2026-11-07',
      categoria: 'sub-7', clube_ids: [4], gols_mandante: 1, gols_visitante: 0, mandante: { nome: 'Ludora FC' }, visitante: { nome: 'Adversário externo' } }] }));
    await page.goto(base + '/selecionar-clube');
    await page.locator('.club-live-match').click();
    await page.waitForURL('**/partidas/105?clube_id=4');
    await page.waitForFunction(() => localStorage.getItem('ludora_clube_id') === '4');
    await page.locator('.partida-detalhe').waitFor().catch(async error => {
      await page.screenshot({ path: path.join(output, 'navigation-error.png'), fullPage: true });
      console.log(await page.locator('body').innerText()); throw error;
    });
    assert.ok(publicMatchRequests > 0);
    assert.match(await page.locator('.public-current-club').innerText(), /Ludora FC$/);
    console.log('PASS clique abre a partida e seleciona um clube participante, sem herdar gestão do clube anterior');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
