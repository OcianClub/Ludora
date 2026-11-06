const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { prepare } = require('./responsive-audit.cjs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 360, 430, 768, 820, 960, 1024, 1100, 1110, 1200, 1366, 1600, 1920]) {
      for (const expanded of width > 760 ? [false, true] : [false]) {
        const { page, context } = await prepare(browser, width, 900);
        try {
          await context.addInitScript(value => localStorage.setItem('ludora_sidebar_expanded', String(value)), expanded);
          await page.goto(base + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 45000 });
          const table = page.locator('.home-history-table');
          await table.waitFor();
          const snapshot = () => table.evaluate(t => {
            const problems = [];
            const visible = el => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
            const contained = (el, cell, label) => {
              if (!visible(el)) return;
              const a = el.getBoundingClientRect(), b = cell.getBoundingClientRect();
              if (a.left < b.left - 1 || a.right > b.right + 1) problems.push(label);
            };
            for (const th of t.querySelectorAll('th:not(.history-action-cell)')) {
              if (!visible(th)) continue;
              const range = document.createRange(); range.selectNodeContents(th);
              const text = range.getBoundingClientRect(), cell = th.getBoundingClientRect();
              if (text.left < cell.left - 1 || text.right > cell.right + 1) problems.push('cabeçalho ' + th.textContent);
            }
            for (const tr of t.querySelectorAll('tbody tr')) {
              for (const el of tr.querySelectorAll('.history-result-summary > span, .history-venue > span, .history-table-score')) {
                contained(el, el.closest('td'), el.className);
              }
              if (!visible(tr.querySelector('.history-venue')) && !visible(tr.querySelector('.history-result-venue'))) problems.push('mando desapareceu');
              for (const badge of tr.querySelectorAll('.history-result-summary .home-result-tag')) {
                const venue = tr.querySelector('.history-result-venue');
                if (visible(venue) && badge.getBoundingClientRect().bottom > venue.getBoundingClientRect().top) problems.push('resultado cobre mando');
              }
            }
            const score = t.querySelector('.history-score-cell').getBoundingClientRect();
            return { problems, score: score.left, overflow: document.documentElement.scrollWidth > innerWidth };
          });
          const normal = await snapshot();
          assert.deepEqual(normal.problems, [], `${width}px sidebar ${expanded}`);
          assert.equal(normal.overflow, false);
          await table.locator('.history-table-teams > span > span:not(.club-badge)').evaluateAll(nodes => nodes.forEach(node => {
            node.textContent = 'Associação Esportiva de Nome Extenso para Conferir o Placar';
          }));
          const long = await snapshot();
          assert.deepEqual(long.problems, []);
          assert.equal(long.score, normal.score, 'nomes longos não deslocam o placar');
          assert.equal(long.overflow, false);
          if ([430, 1110, 1366].includes(width)) await table.screenshot({ path: path.resolve(__dirname, `../../../test-results/web-home/venue-${width}-${expanded}.png`) });
          console.log(`PASS histórico ${width}px; sidebar ${expanded ? 'expandida' : 'contraída'}; mando visível, sem sobreposição`);
        } finally { await context.close(); }
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
