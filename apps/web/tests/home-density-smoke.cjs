const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { prepare } = require('./responsive-audit.cjs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5191';
const output = path.resolve(__dirname, '../../../test-results/home-density');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 820, 960, 1100, 1440, 1920]) {
      for (const role of ['ADMIN', 'TORCEDOR']) {
        const { page, context, data } = await prepare(browser, width, 900, 'dark', { role });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        const matches = data.partidas.filter(p => !['AGENDADA', 'PREPARADA'].includes(p.status) || p.id === 107);
        await page.route('http://localhost:3000/partidas/home**', route => route.fulfill({ json: matches }));
        await page.route('http://localhost:3000/publico/clubes/2/**', route => {
          const pathname = new URL(route.request().url()).pathname;
          return route.fulfill({ json: pathname.endsWith('/categorias') ? data.categorias : pathname.includes('/partidas') ? matches : pathname.endsWith('/times') ? data.times : [] });
        });
        await page.goto(base + '/dashboard');
        await page.locator('.home-upcoming-match').waitFor();
        await page.locator('.history-summary-result').first().waitFor();
        if (role === 'TORCEDOR') await page.locator('.home-highlight-leaders').waitFor();
        const density = await page.evaluate(() => {
          const bottomGaps = [...document.querySelectorAll('.home-upcoming-card, .home-highlights-card')].map(el => ({
            card: el.className,
            gap: el.getBoundingClientRect().bottom - el.lastElementChild.getBoundingClientRect().bottom,
            padding: parseFloat(getComputedStyle(el).paddingBottom),
          }));
          const table = document.querySelector('.home-history-table');
          const order = [...table.querySelectorAll('tbody tr')].map(row => row.id);
          const summaryOrder = [...document.querySelectorAll('.history-summary-result')].map(button => button.getAttribute('aria-controls'));
          const summary = document.querySelector('.history-summary');
          const label = summary.querySelector('.history-summary-label').getBoundingClientRect();
          const hint = summary.querySelector('.history-summary-order').getBoundingClientRect();
          const results = summary.querySelector('.history-summary-results').getBoundingClientRect();
          const firstCircle = summary.querySelector('.history-summary-result strong').getBoundingClientRect();
          const totals = summary.querySelector('.history-summary-totals').getBoundingClientRect();
          const mobile = summary.parentElement.clientWidth <= 900;
          const summaryAligned = summary.parentElement.clientWidth > 900 || (
            (mobile ? hint.width === 0 && Math.abs(label.right - summary.getBoundingClientRect().right + parseFloat(getComputedStyle(summary).paddingRight)) < 1
              && Math.abs((label.top + label.bottom - results.top - results.bottom) / 2) < 2
              && Math.abs(results.top - summary.getBoundingClientRect().top - parseFloat(getComputedStyle(summary).paddingTop)) < 1
              : Math.abs((label.top + label.bottom - hint.top - hint.bottom) / 2) < 2 && Math.abs(results.left - label.left) < 1 && results.top >= label.bottom)
            && Math.abs(firstCircle.left - totals.left) < 1
            && Math.abs(totals.left - results.left) < 1 && totals.top >= results.bottom);
          return { order, summaryOrder, summaryAligned, bottomGaps, overflow: document.documentElement.scrollWidth > innerWidth,
            resultLast: [...table.querySelectorAll('tbody tr')].every(tr => tr.lastElementChild.classList.contains('history-result-cell')),
            venueCount: table.querySelectorAll('.history-venue, .history-result-venue').length,
            upcomingHeight: document.querySelector('.home-upcoming-card').getBoundingClientRect().height,
          };
        });
        for (const gap of density.bottomGaps) assert.ok(gap.gap <= gap.padding + 2, `${width}/${role}: vazio de ${gap.gap}px em ${gap.card}`);
        assert.equal(density.overflow, false);
        assert.equal(density.summaryAligned, true, 'resumo alinhado; no mobile, título à direita e sem indicação de ordem');
        assert.deepEqual(density.summaryOrder, density.order, 'cinco bolinhas na mesma ordem das cinco partidas');
        assert.equal(density.resultLast, true, 'resultado é a última coluna');
        assert.equal(density.venueCount, 0, 'sem mando no histórico');
        assert.ok(density.upcomingHeight < 190, `um compromisso não estica o card: ${density.upcomingHeight}px`);
        assert.deepEqual(errors, []);
        await page.screenshot({ path: path.join(output, `home-${role}-${width}.png`), fullPage: true });
        if (width === 1440 && role === 'ADMIN') {
          // No games and three games must also follow their actual content.
          for (const count of [0, 3]) {
            const upcoming = matches.find(p => p.id === 107);
            const rows = [...matches.filter(p => p.id !== 107), ...Array.from({ length: count }, (_, i) => ({ ...upcoming, id: 8000 + i,
              data: new Date(Date.now() + (i + 2) * 86400000).toISOString() }))];
            await page.route('http://localhost:3000/partidas/home**', route => route.fulfill({ json: rows }));
            await page.reload(); await page.locator('.home-upcoming-card').waitFor();
            await page.waitForFunction(n => document.querySelectorAll('.home-upcoming-match').length === n, count);
            const gap = await page.locator('.home-upcoming-card').evaluate(el => el.getBoundingClientRect().bottom - el.lastElementChild.getBoundingClientRect().bottom);
            assert.ok(gap <= 26);
          }
        }
        console.log(`PASS densidade ${width}px ${role}: card sem preenchimento vazio; resultado na direita, sem mando`);
        await context.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
