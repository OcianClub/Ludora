const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { prepare } = require('./responsive-audit.cjs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5193';

// Todas as respostas e escritas são simuladas; nenhuma credencial ou banco real.
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [360, 1366]) {
      const { page, context } = await prepare(browser, width, 900);
      let releaseTeams, releaseCompetition;
      const teamsGate = new Promise(resolve => { releaseTeams = resolve; });
      const competitionGate = new Promise(resolve => { releaseCompetition = resolve; });
      await page.route('http://localhost:3000/times', async route => {
        await teamsGate; return route.fallback();
      });
      await page.route('http://localhost:3000/competicoes', async route => {
        await competitionGate; return route.fallback();
      });
      await page.goto(base + '/partidas');
      await page.locator('.match-card').first().waitFor();
      assert.equal(await page.locator('.loading-skeleton').count(), 0, 'agenda aparece mesmo com opções de criação pendentes');
      console.log(`PASS ${width}px: agenda não aguarda times e competições`);
      releaseTeams(); releaseCompetition();
      await page.goto(base + '/times');
      await page.getByRole('article', { name: 'Ocian', exact: true }).waitFor();
      assert.equal(await page.locator('section.teams-section').count(), 2);
      assert.equal(await page.locator('details.teams-section').getAttribute('open'), null);
      await page.locator('details.teams-section summary').press('Enter');
      assert.equal(await page.getByRole('article', { name: 'Aurora FC', exact: true }).isVisible(), true);
      await page.locator('details.teams-section summary').press('Enter');
      assert.equal(await page.getByRole('article', { name: 'Aurora FC', exact: true }).isVisible(), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      console.log(`PASS ${width}px: acordeão de externos acessível e sem overflow`);
      await page.goto(base + '/jogadores');
      await page.getByRole('heading', { name: 'Jogadores', exact: true }).waitFor();
      await page.locator('a[href="/partidas"]:visible').first().click();
      await page.locator('.match-card').first().waitFor();
      await page.goBack();
      await page.getByRole('heading', { name: 'Jogadores', exact: true }).waitFor();
      await page.goForward();
      await page.locator('.match-card').first().waitFor();
      await page.reload();
      await page.locator('.match-card').first().waitFor();
      const tab = await context.newPage();
      await require('./visual-fixture.cjs').install(tab);
      await tab.goto(base + '/partidas');
      await tab.locator('.match-card').first().waitFor();
      await tab.close();
      console.log(`PASS ${width}px: menu, voltar/avançar, atualização e URL em nova aba preservam agenda`);
      await context.close();
    }

    // Controla separadamente o download do módulo e a resposta da API.
    {
      const { page, context } = await prepare(browser, 390, 900);
      let releaseModule, releaseData;
      const moduleGate = new Promise(resolve => { releaseModule = resolve; });
      const dataGate = new Promise(resolve => { releaseData = resolve; });
      await page.route('**/src/pages/Times.tsx*', async route => { await moduleGate; return route.continue(); });
      await page.route('http://localhost:3000/times', async route => { await dataGate; return route.fallback(); });
      await page.goto(base + '/times', { waitUntil: 'domcontentloaded' });
      await page.locator('[data-skeleton-page="teams"]').waitFor();
      assert.equal(await page.locator('.route-loading').count(), 0);
      releaseModule();
      await page.locator('.teams-page--directory').waitFor();
      await page.locator('.teams-page--directory [data-skeleton-page="teams"]').waitFor();
      assert.equal(await page.locator('.loading-skeleton--rows').count(), 0);
      releaseData();
      await page.getByRole('article', { name: 'Ocian', exact: true }).waitFor();
      assert.equal(await page.locator('[data-skeleton-page="teams"]').count(), 0);
      console.log('PASS download da rota e consulta usam diretamente skeleton de times');
      await context.close();
    }

    // Testa os serviços reais do frontend com um servidor Render inteiramente falso.
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.route(base + '/audit-host', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Auditoria isolada</title>' }));
      await page.route('**/src/services/config.ts*', r => r.fulfill({ contentType: 'application/javascript', body: 'export const BASE_URL="https://audit.onrender.com";' }));
      let releaseHealth, writes = 0;
      const healthGate = new Promise(resolve => { releaseHealth = resolve; });
      await page.route('https://audit.onrender.com/**', async route => {
        if (new URL(route.request().url()).pathname === '/health') { await healthGate; return route.fulfill({ json: { status: 'ok' } }); }
        if (route.request().method() === 'POST') writes++;
        return route.fulfill({ json: { ok: true } });
      });
      await page.goto(base + '/audit-host');
      await page.evaluate(async () => {
        // Usa a mesma instância do serviço que o Vite vinculou à API, inclusive após HMR.
        const source = await (await fetch('/src/services/api.ts')).text();
        const connectionPath = source.match(/from\s+["']([^"']*\/apiConnection\.ts[^"']*)["']/)[1];
        const api = await import('/src/services/api.ts');
        const connection = await import(connectionPath);
        localStorage.setItem('ludora_token', 'audit-token');
        localStorage.setItem('ludora_clube_id', '2');
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, meuPapel: 'ADMIN' }));
        connection.configureApiConnection('https://audit.onrender.com');
        window.auditResult = api.requestJson('/partidas/10/eventos', { method: 'POST', body: '{}' }).then(() => 'sent', error => error.name);
      });
      await page.evaluate(() => { localStorage.setItem('ludora_clube_id', '3'); localStorage.setItem('ludora_clube', JSON.stringify({ id: 3, meuPapel: 'ADMIN' })); });
      releaseHealth();
      assert.equal(await page.evaluate(() => window.auditResult), 'AbortError');
      assert.equal(writes, 0, 'troca de clube durante despertar não envia escrita com contexto trocado');
      console.log('PASS troca de clube durante espera do Render cancela antes de enviar POST');
      let reads = 0;
      await page.route('https://audit.onrender.com/times', route => route.fulfill({
        json: ++reads === 1 ? { error: 'formato inesperado' } : [{ id: 10, nome: 'Time válido' }],
      }));
      const malformed = await page.evaluate(async () => {
        const api = await import('/src/services/api.ts');
        const first = await api.fetchTimes().then(() => 'accepted', error => error.message);
        const second = await api.fetchTimes();
        return { first, second };
      });
      assert.match(malformed.first, /lista inválida/);
      assert.equal(malformed.second[0].nome, 'Time válido');
      assert.equal(reads, 2, 'resposta inválida é descartada do cache e permite nova consulta');
      console.log('PASS lista malformada mostra erro e não contamina o cache da nova tentativa');
      await page.route('https://audit.onrender.com/jogadores?resumo=true', route => route.fulfill({ json: [{ categoria_id: 1, semCamisa: -5 }] }));
      assert.match(await page.evaluate(async () => {
        const api = await import('/src/services/api.ts');
        return api.fetchResumoCamisas().then(() => 'accepted', error => error.message);
      }), /confirmar as pendências/);
      console.log('PASS contagem inválida de pendências é rejeitada sem virar um total falso');
      let releaseRead, startRead;
      const readGate = new Promise(resolve => { releaseRead = resolve; });
      const reading = new Promise(resolve => { startRead = resolve; });
      await page.route('https://audit.onrender.com/contexto', async route => {
        startRead(); await readGate;
        return route.fulfill({ json: { privado: true } });
      });
      await page.evaluate(async () => {
        const api = await import('/src/services/api.ts');
        window.lateContext = api.requestJson('/contexto').then(() => 'accepted', error => error.name);
      });
      await reading;
      await page.evaluate(() => localStorage.setItem('ludora_clube', JSON.stringify({ id: 3, meuPapel: 'TECNICO', categoriasAcesso: [{ id: 5 }] })));
      releaseRead();
      assert.equal(await page.evaluate(() => window.lateContext), 'AbortError');
      console.log('PASS resposta atrasada é descartada após mudança de cargo/categorias no mesmo clube');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
