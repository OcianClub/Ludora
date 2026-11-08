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
    for (const [width, role, theme, expanded] of [[320, 'ADMIN', 'dark', false], [390, 'TORCEDOR', 'dark', false],
      [820, 'ADMIN', 'light', true], [1440, 'TORCEDOR', 'light', false], [1920, 'ADMIN', 'dark', true]]) {
      const { page, context, data } = await prepare(browser, width, 900, theme, { role });
      await context.addInitScript(value => localStorage.setItem('ludora_sidebar_expanded', String(value)), expanded);
      let release;
      const pending = new Promise(resolve => { release = resolve; });
      await page.route('http://localhost:3000/partidas/home**', async route => { await pending; await route.fulfill({ json: data.partidas }); });
      await page.route('http://localhost:3000/publico/clubes/2/**', async route => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname.includes('/partidas')) { await pending; return route.fulfill({ json: data.partidas }); }
        return route.fulfill({ json: pathname.endsWith('/categorias') ? data.categorias : data.times });
      });
      await page.goto(base + '/dashboard', { waitUntil: 'domcontentloaded' });
      await page.getByRole('status', { name: 'Carregando visão geral' }).waitFor();
      const bounds = await page.locator('.home-skeleton').evaluate(el => {
        const outer = el.getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth,
          outside: [...el.querySelectorAll('.home-skeleton-card, .home-history-table-wrap, .home-skeleton-controls')].some(child => {
            const box = child.getBoundingClientRect(); return box.left < outer.left - 1 || box.right > outer.right + 1;
          }),
          cardHeights: [...el.querySelectorAll('.home-skeleton-card')].map(card => card.getBoundingClientRect().height),
          columns: getComputedStyle(el.querySelector('.home-skeleton-grid')).gridTemplateColumns.split(' ').length,
          motion: getComputedStyle(el.querySelector('.home-placeholder')).animationName,
        };
      });
      assert.equal(bounds.overflow, false);
      assert.equal(bounds.outside, false, 'skeleton respeita o espaçamento da página');
      assert.ok(bounds.cardHeights.every(height => height > 80 && height < 360), 'blocos refletem conteúdo, sem enormes retângulos genéricos');
      assert.equal(bounds.columns, width <= 820 ? 1 : 2);
      assert.equal(bounds.motion, 'none', 'respeita preferência por movimento reduzido');
      await page.screenshot({ path: path.join(output, `skeleton-${role}-${width}.png`), fullPage: true });
      release();
      await page.locator('.home-skeleton').waitFor({ state: 'detached' });
      await page.locator('.home-history-table').waitFor();
      assert.equal(await page.locator('.history-result-venue, .history-venue').count(), 0);
      assert.equal(await page.locator('.home-history-table thead th').last().innerText(), 'Resultado');
      console.log(`PASS skeleton ${width}px ${role}/${theme}: proporções, margens, transição e última coluna Resultado`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
