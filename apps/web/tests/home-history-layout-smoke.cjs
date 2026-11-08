const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { prepare } = require('./responsive-audit.cjs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 353, 360, 430, 669, 768, 820, 960, 1024, 1100, 1110, 1200, 1366, 1600, 1920]) {
      for (const expanded of width > 760 ? [false, true] : [false]) {
        const { page, context, data } = await prepare(browser, width, 900);
        data.partidas.forEach(p => { p.competicao = { id: 1, nome: 'Copa Regional de Futsal', ano: 2026 }; });
        try {
          await context.addInitScript(value => localStorage.setItem('ludora_sidebar_expanded', String(value)), expanded);
          await page.goto(base + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 45000 });
          const table = page.locator('.home-history-table[aria-label]');
          await table.waitFor();
          const snapshot = () => table.evaluate(t => {
            const problems = [];
            const visible = el => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
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
              for (const el of tr.querySelectorAll('.history-result-summary > span, .history-table-link, .history-table-score')) {
                contained(el, el.closest('td'), el.className);
              }
              if (tr.querySelector('.history-venue, .history-result-venue')) problems.push('mando ainda aparece');
              if (!tr.lastElementChild.classList.contains('history-result-cell')) problems.push('resultado não é última coluna');
              for (const el of tr.querySelectorAll('.history-table-teams > span > span:not(.club-badge), time, .history-competition')) {
                if (visible(el) && getComputedStyle(el).whiteSpace !== 'nowrap') problems.push('texto pode quebrar linha');
              }
              const teams = tr.querySelector('.history-table-teams'), score = tr.querySelector('.history-table-score');
              if (getComputedStyle(score).display === 'flex') {
                const name = teams.firstElementChild.lastElementChild, opponent = teams.lastElementChild;
                if (score.getBoundingClientRect().left - name.getBoundingClientRect().right > 14) problems.push('vazio antes do placar');
                if (opponent.getBoundingClientRect().left - score.getBoundingClientRect().right > 14) problems.push('vazio depois do placar');
              }
            }
            const score = t.querySelector('.history-score-cell').getBoundingClientRect();
            return { problems, score: score.left, overflow: document.documentElement.scrollWidth > innerWidth };
          });
          const normal = await snapshot();
          assert.deepEqual(normal.problems, [], `${width}px sidebar ${expanded}`);
          assert.equal(normal.overflow, false);
          const alignment = await table.evaluate(t => {
            const head = [...t.querySelectorAll('thead th')], width = t.getBoundingClientRect().width;
            const desktop = getComputedStyle(t.querySelector('.history-table-score')).display === 'flex';
            const expected = width <= 900 ? [.12, .25, .45, .18] : [.12, .29, .43, .16];
            return [...t.querySelectorAll('tbody tr')].flatMap(tr => {
              const errors = [];
              [...tr.children].forEach((td, index) => {
                const cell = td.getBoundingClientRect(), th = head[index].getBoundingClientRect();
                if (!cell.width) return;
                if (Math.abs(cell.left - th.left) > 1 || Math.abs(cell.width - th.width) > 1) errors.push('cabeçalho e célula desalinhados');
                if (desktop && Math.abs(cell.width / width - expected[index]) > .005) errors.push('proporção da coluna incorreta');
              });
              const match = tr.querySelector('.history-confrontation').getBoundingClientRect(), score = tr.querySelector('.history-table-score').getBoundingClientRect();
              if (desktop && Math.abs((match.left + match.right - score.left - score.right) / 2) > 1) errors.push('placar fora do centro');
              if (!desktop) {
                const competition = tr.querySelector('.history-competition').getBoundingClientRect();
                const share = width <= 340 ? .25 : width <= 480 ? .30 : .40;
                if (Math.abs(competition.width / width - share) > .005) errors.push('competição mobile sem a proporção ampliada');
                if (getComputedStyle(tr.querySelector('.history-competition')).display === 'none') errors.push('competição mobile oculta');
                if (getComputedStyle(tr.querySelector('.history-date-compact')).display !== 'grid') errors.push('data mobile não está empilhada');
                const teams = [...tr.querySelectorAll('.history-table-teams > span')], numbers = [...tr.querySelectorAll('.history-table-score strong')];
                teams.forEach((team, index) => {
                  const a = team.getBoundingClientRect(), b = numbers[index].getBoundingClientRect();
                  if (Math.abs((a.top + a.bottom - b.top - b.bottom) / 2) > 1) errors.push('time e placar mobile desalinhados');
                });
              }
              return errors;
            });
          });
          assert.deepEqual(alignment, [], `${width}px: proporções e alinhamento`);
          await table.locator('.history-table-teams > span > span:not(.club-badge)').evaluateAll(nodes => nodes.forEach(node => {
            node.textContent = 'Associação Esportiva de Nome Extenso para Conferir o Placar';
          }));
          const long = await snapshot();
          assert.deepEqual(long.problems, []);
          assert.equal(long.score, normal.score, 'nomes longos não deslocam o placar');
          assert.equal(long.overflow, false);
          const competition = table.locator('tbody .history-competition').first();
          if (await competition.isVisible()) {
            const label = 'Campeonato Regional de Futsal das Categorias de Formação com Nome Muito Extenso';
            await competition.evaluate((el, text) => { el.textContent = text; el.dataset.tooltip = text; }, label);
            const clipped = await competition.evaluate(el => el.scrollWidth > el.clientWidth && getComputedStyle(el).textOverflow === 'ellipsis');
            assert.equal(clipped, true, 'competição longa recebe reticências');
            assert.equal((await snapshot()).score, normal.score, 'competição longa não desloca o placar');
            if (width === 1366 && expanded) {
              await competition.scrollIntoViewIfNeeded();
              await page.mouse.move(0, 0);
              await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
              await competition.hover();
              await page.getByRole('tooltip', { name: label }).waitFor();
              await page.mouse.move(0, 0);
            }
          }
          if ([430, 1110, 1366].includes(width)) await table.screenshot({ path: path.resolve(__dirname, `../../../test-results/web-home/venue-${width}-${expanded}.png`) });
          console.log(`PASS histórico ${width}px; sidebar ${expanded ? 'expandida' : 'contraída'}; resultado na direita, sem mando ou sobreposição`);
        } finally { await context.close(); }
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
