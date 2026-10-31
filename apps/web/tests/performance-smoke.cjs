const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';
const output = path.resolve(__dirname, '../../../test-results/web-performance');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  fs.mkdirSync(output, { recursive: true });
  const results = [];
  try {
    for (const width of [360, 820, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await context.addInitScript(() => {
        localStorage.setItem('ludora_token', 'performance-test');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex Morgan', email: 'visual@example.test' }));
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN', plano: 'DEMO' }));
        localStorage.setItem('ludora_clube_id', '2');
        localStorage.setItem('ludora_tema', 'dark');
      });
      const page = await context.newPage();
      const errors = [], requests = [];
      let homeCalls = 0, fail = false;
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => requests.push(request.url()));
      await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      await require('./visual-fixture.cjs').install(page, { playerCount: 120 });
      await page.route('http://localhost:3000/**', async route => {
        if (route.request().method() === 'GET') await new Promise(resolve => setTimeout(resolve, 300));
        if (new URL(route.request().url()).pathname === '/partidas/home') {
          homeCalls++;
          if (fail) return route.fulfill({ status: 503, json: {} });
        }
        return route.fallback();
      });
      async function navigate(route) {
        await page.evaluate(route => { history.pushState({}, '', route); window.dispatchEvent(new PopStateEvent('popstate')); }, route);
      }
      const cold = Date.now();
      await page.goto(base + '/dashboard');
      await page.locator('.category-moment').waitFor();
      const initialLoadMs = Date.now() - cold;
      assert.equal(homeCalls, 1, 'StrictMode não deve duplicar a consulta da Home');
      assert.equal(requests.filter(url => url.includes('/packages/icons/')).length, 0, 'Ícones devem estar no código, sem carregar SVG por SVG');
      assert.ok(!requests.some(url => /pages\/(PartidaDetalhe|Membros)\.tsx/.test(url)), 'A Home não deve importar telas que não serão usadas');
      await navigate('/elenco');
      await page.locator('.scout-player').first().waitFor();
      assert.equal(requests.filter(url => new URL(url).pathname === '/jogadores/perfis').length, 1, 'Pendências e Scout compartilham a consulta de perfis');
      await page.evaluate(() => {
        window.skeletonFrames = 0;
        window.skeletonObserver = new MutationObserver(() => { if (document.querySelector('.home-skeleton')) window.skeletonFrames++; });
        window.skeletonObserver.observe(document.body, { subtree: true, childList: true });
      });
      const warm = Date.now();
      await navigate('/dashboard');
      await page.locator('.category-moment').waitFor();
      const warmLoadMs = Date.now() - warm;
      assert.equal(homeCalls, 1, 'Retorno com cache recente não precisa de outra consulta');
      assert.equal(await page.evaluate(() => window.skeletonFrames), 0, 'Retorno não deve piscar skeleton');
      await navigate('/elenco');
      await page.locator('.scout-player').first().waitFor();
      await page.evaluate(async () => {
        const { invalidateApiReads } = await import('/src/services/api.ts');
        const original = Date.now;
        Date.now = () => original() + 6000;
        invalidateApiReads('/unused');
      });
      fail = true;
      await navigate('/dashboard');
      await page.getByRole('alert').filter({ hasText: 'Seus dados continuam aqui' }).waitFor();
      assert.ok(await page.locator('.category-moment').isVisible(), 'Falha de atualização mantém o conteúdo');
      assert.equal(await page.evaluate(() => window.skeletonFrames), 0, 'Cache expirado mantém tela enquanto atualiza');
      fail = false;
      await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
      await page.getByRole('alert').waitFor({ state: 'detached' });
      assert.equal(homeCalls, 3, 'Retry deve buscar dados novos, sem repetir sozinho');
      await navigate('/partidas');
      await page.locator('.schedule-card, .match-card').first().waitFor();
      await navigate('/jogadores');
      await page.locator('.alunos-page').waitFor();
      await page.waitForFunction(() => /\d+ jogadores/.test(document.querySelector('.alunos-results-bar')?.textContent || ''));
      assert.equal(await page.locator('.route-load-error').count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Sem overflow horizontal na página');
      await page.screenshot({ path: path.join(output, `players-${width}.png`), fullPage: true });
      await navigate('/dashboard');
      await page.locator('.category-moment').waitFor();
      await page.screenshot({ path: path.join(output, `home-${width}.png`), fullPage: true });
      if (width === 1440) {
        const changed = await page.evaluate(async () => {
          const { requestJson } = await import('/src/services/api.ts');
          const before = await requestJson('/jogadores?categoria_id=1');
          await requestJson('/jogadores/101', { method: 'PATCH', body: JSON.stringify({ nome: 'Atleta atualizado' }) });
          const after = await requestJson('/jogadores?categoria_id=1');
          return { before: before.find(row => row.id === 101).nome, after: after.find(row => row.id === 101).nome };
        });
        assert.notEqual(changed.before, changed.after);
        assert.equal(changed.after, 'Atleta atualizado', 'Salvar jogador invalida consultas anteriores');
        await page.route('**/categorias', route => route.request().headers()['x-clube-id'] === '3'
          ? route.fulfill({ json: [{ id: 77, nome: 'sub-7', tipo: 'INICIACAO', clube_id: 3 }] }) : route.fallback());
        await page.route('**/partidas/home?**', route => route.request().headers()['x-clube-id'] === '3'
          ? route.fulfill({ json: [] }) : route.fallback());
        await navigate('/selecionar-clube');
        await page.getByRole('button', { name: 'Acessar Santos', exact: true }).click();
        await page.getByRole('heading', { name: 'Seu próximo jogo aparece aqui' }).waitFor();
        assert.equal(await page.locator('.home-main-match').count(), 0, 'Novo clube não pode mostrar o placar do anterior');
        assert.equal(await page.locator('.sidebar .current-club-copy strong').textContent(), 'Santos');
        const clubScope = await page.evaluate(async () => {
          const { cachedJson, getClubeId } = await import('/src/services/api.ts');
          return { club: getClubeId(), categories: cachedJson('/categorias').map(row => row.clube_id) };
        });
        assert.deepEqual(clubScope, { club: 3, categories: [3] });
      }
      assert.deepEqual(errors, [], 'Sem erros de renderização');
      results.push({ width, initialLoadMs, warmLoadMs, homeCalls });
      await context.close();
    }
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
