const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';
const output = path.resolve(__dirname, '../../../test-results/home-overview');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  try {
    for (const width of [320, 390, 820, 1440]) for (const theme of ['dark', 'light']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
      try {
        await context.addInitScript(theme => {
          localStorage.setItem('ludora_token', 'visual-test-only');
          localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex Morgan' }));
          localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
          localStorage.setItem('ludora_clube_id', '2');
          localStorage.setItem('ludora_tema', theme);
        }, theme);
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => {
          if (['xhr', 'fetch'].includes(route.request().resourceType())) return route.abort();
          return new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort();
        });
        await require('./visual-fixture.cjs').install(page);
        const category = { id: 1, nome: 'sub-7', tipo: 'INICIACAO', clube_id: 2 };
        const match = (id, status, data, extra = {}) => ({ id, status, data, horario: '19:30', emCasa: true,
          mandante: { id: 1, nome: 'Ocian' }, visitante: { id: 2, nome: 'Sociedade Esportiva e Recreativa de São Vicente' },
          gols_mandante: 2, gols_visitante: 1, categoria: category, ...extra });
        const history = Array.from({ length: 5 }, (_, i) => match(100 + i, 'FINALIZADA', `2026-10-${25 - i}`));
        const live = match(90, 'AO_VIVO', '2026-10-31');
        const upcoming = [match(12, 'PREPARADA', '2099-11-06', { horario: '20:00' }),
          match(11, 'AGENDADA', '2099-11-06', { horario: '10:00' }), match(13, 'AGENDADA', '2099-11-07')];
        const state = { rows: [live, ...history, ...upcoming], fail: false };
        await page.route('**/partidas/home?**', route => route.fulfill({ status: state.fail ? 503 : 200, json: state.fail ? { error: 'offline' } : state.rows }));
        const open = async () => { await page.goto(base + '/dashboard'); await page.locator('.home-upcoming-card').waitFor(); };
        await open();
        assert.equal(await page.locator('.home-upcoming-match').count(), 3);
        assert.deepEqual(await page.locator('.home-upcoming-match').evaluateAll(rows => rows.map(row => row.getAttribute('href'))), ['/partidas/11', '/partidas/12', '/partidas/13']);
        assert.equal(await page.locator('.home-upcoming-day').count(), 2, 'Data agrupada sem repetição');
        for (const time of await page.locator('.home-upcoming-time').all()) {
          assert.equal(await time.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
        }
        const row = page.locator('.home-upcoming-match').first();
        await row.focus();
        assert.ok(await row.evaluate(el => document.activeElement === el));
        const parts = await row.evaluate(el => [...el.children].map(child => ({ y: child.getBoundingClientRect().y, height: child.getBoundingClientRect().height })));
        const centers = parts.map(part => part.y + part.height / 2);
        assert.ok(Math.max(...centers) - Math.min(...centers) < 2, 'Horário, escudo, nome e chevron centralizados');
        const headerColor = await page.locator('.home-history-table th').first().evaluate(el => getComputedStyle(el).backgroundColor);
        assert.equal(await page.locator('.home-history-table tbody tr').count(), 5);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await row.evaluate(el => el.blur());
        await page.screenshot({ path: path.join(output, `${width}-${theme}.png`), fullPage: true, animations: 'disabled' });
        if (width >= 820) {
          await page.goto(base + '/jogadores');
          await page.locator('.alunos-table th').first().waitFor();
          assert.equal(await page.locator('.alunos-table th').first().evaluate(el => getComputedStyle(el).backgroundColor), headerColor, 'Cabeçalhos usam o mesmo tom');
        }
        state.rows = [upcoming[0]];
        await open();
        await page.getByRole('heading', { name: 'A próxima partida está em destaque acima' }).waitFor();
        assert.equal(await page.locator('.home-upcoming-match').count(), 0);
        state.rows = [match(303, 'AGENDADA', '2099-11-06', { categoria: { ...category, id: 2, nome: 'sub-8' } })];
        await open();
        await page.getByRole('heading', { name: 'Nenhuma partida futura no SUB-7' }).waitFor();
        await page.getByText('Há jogos agendados em SUB-8. Troque a categoria para consultar.').waitFor();
        state.fail = true;
        await page.goto(base + '/dashboard');
        await page.getByRole('alert').getByText('A visão geral não carregou').waitFor();
        assert.equal(await page.locator('.home-upcoming-empty').count(), 0, 'Erro não é apresentado como ausência de jogos');
        state.fail = false;
        state.rows = [live, ...upcoming];
        await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
        await page.locator('.home-upcoming-match').first().waitFor();
        console.log(`PASS ${width}px ${theme}: tabela, alinhamentos, ordem, estados vazios e recuperação de erro`);
      } finally { await context.close(); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
