const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5189';
const output = path.resolve(__dirname, '../../../test-results/club-workspace');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 760, 820, 1366, 1920]) {
      for (const theme of ['dark', 'light']) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        await context.addInitScript(theme => {
          localStorage.setItem('ludora_token', 'workspace-test');
          localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
          localStorage.setItem('ludora_clube_id', '2');
          localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
          localStorage.setItem('ludora_tema', theme);
        }, theme);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
        await require('./visual-fixture.cjs').install(page);
        async function fit(name) {
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: sem overflow em ${width}`);
          await page.screenshot({ path: path.join(output, `${name}-${width}-${theme}.png`), fullPage: true });
        }
        async function navigate(route) {
          await page.evaluate(route => { history.pushState({}, '', route); window.dispatchEvent(new PopStateEvent('popstate')); }, route);
        }
        await page.goto(base + '/dashboard');
        await page.getByRole('heading', { name: 'Histórico de partidas', exact: true }).waitFor();
        assert.equal(await page.locator('.home-live').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
        assert.equal(await page.locator('.home-live').evaluate(el => getComputedStyle(el).borderTopWidth), '0px');
        assert.equal(await page.locator('.home-category-arrow').count(), 0);
        assert.equal(await page.locator('.home-pager').count(), 0);
        await page.getByRole('tab', { name: 'SUB-8', exact: true }).click();
        assert.equal(await page.getByRole('tab', { name: 'SUB-8', exact: true }).getAttribute('aria-selected'), 'true');
        await fit('home');
        if (width <= 760) {
          await page.getByRole('button', { name: 'Mais opções de navegação' }).click();
          const more = page.getByRole('dialog', { name: 'Mais opções', exact: true });
          assert.equal(await more.getByRole('button', { name: 'Menu da conta', exact: true }).count(), 0);
          await more.getByRole('link', { name: 'Conta e preferências', exact: true }).click();
          await page.getByRole('heading', { name: 'Meu perfil', exact: true }).waitFor();
          assert.equal(await more.count(), 0);
          assert.ok(page.url().endsWith('/perfil'));
          await navigate('/dashboard');
          await page.locator('.home-live').waitFor();
        }

        assert.equal(await page.locator('.workspace-header').isVisible(), width <= 760);
        assert.equal(await page.locator('.notifications-trigger:visible').count(), 1);
        assert.ok(await page.locator('.notification-dot:visible').count() > 0);
        await page.locator('.notifications-trigger:visible').click();
        await page.getByRole('dialog', { name: 'Notificações', exact: true }).waitFor();
        await page.keyboard.press('Escape');

        await navigate('/elenco');
        await page.locator('.scout-player').first().waitFor();
        assert.equal(await page.getByRole('tab', { name: 'SUB-8', exact: true }).getAttribute('aria-selected'), 'true', 'Categoria persiste entre telas');
        assert.ok(await page.locator('.scout-overview').evaluate(el => el.getBoundingClientRect().top < document.querySelector('.scout-controls').getBoundingClientRect().top));
        await page.getByRole('button', { name: 'Gols', exact: true }).click();
        assert.equal(await page.locator('.scout-rating > span').first().textContent(), 'Gols');
        const goalsDescending = await page.locator('.scout-rating strong').allTextContents();
        await page.getByRole('button', { name: 'Gols, decrescente', exact: true }).click();
        await page.getByRole('button', { name: 'Gols, crescente', exact: true }).waitFor();
        const goalsAscending = await page.locator('.scout-rating strong').allTextContents();
        assert.notDeepEqual(goalsDescending, goalsAscending);
        await page.getByRole('tab', { name: 'Base', exact: true }).click();
        assert.equal(await page.getByRole('tab', { name: 'SUB-12', exact: true }).getAttribute('aria-selected'), 'true');
        await page.getByRole('tab', { name: 'Iniciação', exact: true }).click();
        assert.equal(await page.getByRole('tab', { name: 'SUB-7', exact: true }).getAttribute('aria-selected'), 'true');
        await fit('scout');

        await navigate('/partidas');
        await page.locator('.match-card').first().waitFor();
        assert.equal(await page.getByRole('tab', { name: /Ao vivo/ }).getAttribute('aria-selected'), 'true');
        assert.equal(await page.locator('.schedule-live-carousel, .schedule-section').count(), 0);
        await page.getByRole('tab', { name: /Próximas/ }).click();
        await page.locator('.match-card').first().waitFor();
        assert.equal(await page.locator('.match-card-live').count(), 0);
        assert.equal(await page.locator('.match-card').count(), 2);
        await page.getByRole('tab', { name: /Finalizadas/ }).click();
        assert.equal(await page.locator('.match-card').count(), 5);
        if (width <= 760) {
          assert.equal(await page.locator('.schedule-view-toggle:visible').count(), 0);
          const tabRows = await page.locator('.schedule-status-summary button').evaluateAll(items => new Set(items.map(item => item.offsetTop)).size);
          assert.equal(tabRows, 1, 'Abas não quebram para outra linha');
        }
        await fit('matches');
        await page.getByRole('tab', { name: /Finalizadas/ }).press('Home');
        assert.equal(await page.getByRole('tab', { name: /Todos/ }).getAttribute('aria-selected'), 'true');
        assert.equal(await page.locator('.schedule-status-section').count(), 3);
        assert.equal(await page.locator('.match-card').count(), 3, 'Somente ao vivo e próximas começam abertos');
        const finishedToggle = page.locator('.schedule-section-toggle').filter({ hasText: 'Finalizadas' });
        await finishedToggle.click();
        assert.equal(await page.locator('.match-card').count(), 8);
        const links = await page.locator('.match-card-actions a').evaluateAll(items => items.map(item => item.getAttribute('href')));
        assert.equal(new Set(links).size, 8, 'Sem duplicação entre grupos');
        await finishedToggle.click();
        assert.equal(await page.locator('.match-card').count(), 3, 'Fechar o grupo libera os cards');
        await fit('matches-all');

        await navigate('/jogadores?camisa=missing');
        await page.locator('.alunos-results-bar').getByText('1 jogador', { exact: true }).waitFor();
        if (width <= 760) {
          await page.locator('.alunos-list li').first().waitFor();
          assert.equal(await page.locator('.alunos-sub-toggle:visible').count(), 0);
          assert.equal(await page.locator('.alunos-add').evaluate(el => getComputedStyle(el).position), 'fixed');
        } else {
          assert.equal(await page.getByRole('columnheader', { name: /Categoria/ }).count(), 0);
          assert.equal(await page.getByRole('button', { name: /Sem camisa/ }).first().getAttribute('aria-pressed'), 'true');
        }
        await fit('players');
        assert.deepEqual(errors, []);
        console.log(`PASS workspace ${width}px ${theme}`);
        await context.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
