const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = 'http://127.0.0.1:5192';
(async () => {
 const browser = await chromium.launch({ channel: 'msedge', headless: true });
 try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await page.addInitScript(() => {
   localStorage.setItem('ludora_token', 'visual-test-only'); localStorage.setItem('ludora_clube_id', '2');
   localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Teste' }));
   localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
  });
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await require('./visual-fixture.cjs').install(page, { playerCount: 32 });
  let requests = 0;
  await page.route('**/jogadores?*', async route => {
   requests++; const summary = new URL(route.request().url()).searchParams.has('resumo');
   await new Promise(resolve => setTimeout(resolve, summary ? 250 : 350));
   await route.fallback();
  });
  const started = performance.now();
  await page.goto(base + '/jogadores?categoria=1');
  await page.waitForFunction(() => document.querySelectorAll('.alunos-player-link').length === 20);
  const firstLoadMs = Math.round(performance.now() - started);
  const before = requests, resize = performance.now();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelectorAll('.is-simple .alunos-player-link').length === 20);
  const resizeMs = Math.round(performance.now() - resize);
  await page.waitForTimeout(450);
  const extraRequests = requests - before;
  console.log(JSON.stringify({ simulatedLatency: { summary: 250, players: 350 }, firstLoadMs, resizeMs, resizeRequests: extraRequests }));
  if (!process.env.MEASURE_BASELINE) {
   assert.equal(extraRequests, 0, 'Redimensionar não consulta novamente os jogadores');
   await page.getByRole('button', { name: /Carregar mais jogadores/ }).click();
   await page.waitForFunction(() => document.querySelectorAll('.alunos-player-link').length === 32);
   const beforeReturn = requests;
   await page.setViewportSize({ width: 1440, height: 950 });
   await page.waitForFunction(() => document.querySelectorAll('.alunos-table tbody tr').length === 32);
   await page.waitForTimeout(450);
   assert.equal(requests, beforeReturn, 'Mantém também as páginas já carregadas');
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
