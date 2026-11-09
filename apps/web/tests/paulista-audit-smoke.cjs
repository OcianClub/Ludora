// Isolated browser regressions: no federation/API/database writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { prepare } = require('./responsive-audit.cjs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5192';
const baseline = process.env.PAULISTA_AUDIT_BASELINE === '1';
const events = [7, 8].map((n, i) => ({ id: 900 + i, ano: 2026, categoria: `Sub-${n}`, divisao: 'A2' }));
function fixture(index = 0) {
 const event = events[index];
 return {
  evento: { id: event.id, versao: 1 },
  snapshot: { ...event, titulo: 'Campeonato Paulista', fonte: 'https://example.test/official',
   equipes: [{ id: 10, nome: 'Ocian', escudo: null }, { id: 20, nome: 'Santos', escudo: null }],
   jogos: Array.from({ length: 60 }, (_, i) => ({ id: `game-${index}-${i}`, faseId: 'classificacao', fase: 'FASE DE CLASSIFICAÇÃO', sumulaId: null,
    mandanteId: 10, visitanteId: 20, golsMandante: 2, golsVisitante: 1, data: `2026-03-${String(i % 28 + 1).padStart(2, '0')}`, horario: '19:30', local: 'Ginásio', ocorrencia: null })),
   classificacao: [10, 20].map((id, i) => ({ faseId: 'classificacao', fase: 'FASE DE CLASSIFICAÇÃO', grupo: 'CHAVE ÚNICA', equipeId: id, posicao: i + 1, pontos: 30 - i, jogos: 10, vitorias: 8, empates: 2, derrotas: 0, golsPro: 20, golsContra: 10, saldo: 10 })), avisos: [], fasesExcluidas: [] },
  vinculos: [{ equipeId: 10, clubeId: 2, nome: 'Ocian', escudo: null }], jogosLocais: [], pendencias: [], retroativos: [],
 };
}
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function choose(page, label, value) {
 await page.getByRole('combobox', { name: new RegExp('^' + label) }).click();
 await page.getByRole('option', { name: value, exact: true }).click();
}
async function refresh(page) {
 await page.getByRole('button', { name: 'Opções do campeonato', exact: true }).click();
 await page.getByRole('menuitem', { name: 'Atualizar dados', exact: true }).click();
}
(async () => {
 const browser = await chromium.launch({ channel: 'msedge', headless: true });
 const results = [];
 try {
  for (const width of (process.env.PAULISTA_AUDIT_WIDTHS || '390,1440').split(',').map(Number)) {
   const { page, context } = await prepare(browser, width, 700);
   let reads = 0, failRead = false, delay = 0, hold = null;
   const errors = [], writes = [];
   page.on('pageerror', e => errors.push(e.message));
   // Count real derived-data executions in the development module, not elapsed network time.
   await page.route('**/src/utils/paulistaView.ts', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/function resumoClube\(([^)]*)\) \{/, '$&\nperformance.mark("audit:summary");');
    await route.fulfill({ response, body });
   });
   await page.route('**/paulista/**', async route => {
    const r = route.request(), url = new URL(r.url());
    if (url.origin === new URL(base).origin) return route.fallback();
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (r.method() !== 'GET') { writes.push(url.pathname); return route.abort(); }
    if (url.pathname.endsWith('/status')) return route.fulfill({ json: { ativo: true, bancoPronto: true } });
    if (url.pathname.endsWith('/eventos')) return route.fulfill({ json: events });
    reads++;
    if (hold) await hold;
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    if (failRead) return route.fulfill({ status: 503, json: { error: 'Simulated outage' } }).catch(() => {});
    return route.fulfill({ json: fixture(url.pathname.endsWith('901') ? 1 : 0) });
   });
   try {
    await page.goto(base + '/competicoes?evento=900&ano=2026&faixa=INICIACAO&aba=jogos');
    await page.locator('.paulista-fixture').first().waitFor();
    const initialReads = reads;
    await page.getByRole('button', { name: 'Mostrar mais jogos' }).click();
    assert.equal(await page.locator('.paulista-fixture').count(), 50);
    const item = page.locator('.paulista-fixture').nth(30);
    await item.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => scrollY);
    await item.locator('.match-card').focus(); await page.keyboard.press('Enter');
    await page.getByRole('dialog', { name: 'Detalhes oficiais da partida' }).waitFor();
    await frames(page);
    const open = await page.evaluate(() => scrollY);
    await page.mouse.move(2, 350); await page.mouse.wheel(0, 300); await frames(page);
    if (!baseline) assert.equal(await page.evaluate(() => scrollY), open, 'background cannot scroll while dialog is open');
    await page.keyboard.press('Escape'); await frames(page);
    const closed = await page.evaluate(() => scrollY);
    const countAfterModal = await page.locator('.paulista-fixture').count();
    // Focus a toolbar button without scrolling to it, as with keyboard/shortcut activation.
    await page.evaluate(() => document.querySelector('[aria-label="Filtrar jogos oficiais"]').click());
    const dialog = page.getByRole('dialog', { name: 'Filtrar jogos oficiais' });
    await dialog.waitFor(); await frames(page);
    const filtersOpen = await page.evaluate(() => scrollY);
    await page.evaluate(() => performance.clearMarks('audit:summary'));
    await choose(page, 'Etapa', 'Eliminatórias');
    await choose(page, 'Situação', 'Finalizadas');
    await choose(page, 'Ordenar por data', 'Mais recentes primeiro');
    const calculations = await page.evaluate(() => performance.getEntriesByName('audit:summary').length);
    await page.keyboard.press('Escape'); await frames(page);
    const filtersClosed = await page.evaluate(() => scrollY);
    const measurement = { width, initialReads, readsAfterModals: reads, before, open, closed, filtersOpen, filtersClosed, countAfterModal, draftSummaryCalculations: calculations };
    results.push(measurement); console.log(JSON.stringify(measurement));
    if (!baseline) {
     assert.equal(countAfterModal, 50, 'opening details preserves loaded rows');
     for (const value of [open, closed, filtersOpen, filtersClosed]) assert.ok(Math.abs(before - value) <= 1, 'dialogs never jump the background scroll');
     assert.equal(calculations, 0, 'draft filters do not rebuild the competition summary');
     assert.equal(reads, initialReads, 'dialogs and filters make no extra reads');
     // Dropdown keyboard navigation stays within its own listbox.
     await page.evaluate(() => document.querySelector('[aria-label="Filtrar jogos oficiais"]').click());
     await dialog.getByRole('combobox', { name: /^Período/ }).click();
     const bodyScroll = await dialog.locator('.modal-body').evaluate(e => e.scrollTop);
     await page.keyboard.press('End'); await frames(page);
     assert.equal(await page.evaluate(() => scrollY), before);
     assert.equal(await dialog.locator('.modal-body').evaluate(e => e.scrollTop), bodyScroll);
     await page.keyboard.press('Escape'); assert.equal(await dialog.count(), 1, 'first Escape closes only dropdown');
     await page.keyboard.press('Escape');
     // Applying a filter resets the limit, dismissing the dialog does not apply drafts.
     assert.equal(await page.locator('.paulista-fixture').count(), 50);
     await page.getByRole('button', { name: 'Filtrar jogos oficiais' }).click();
     await choose(page, 'Ordenar por data', 'Mais recentes primeiro');
     await dialog.getByRole('button', { name: 'Aplicar filtros' }).click();
     await page.waitForURL(/ordem=desc/);
     assert.equal(await page.locator('.paulista-fixture').count(), 25);
     assert.equal(reads, initialReads);
     failRead = true; await refresh(page);
     await page.locator('.paulista-update-notice').waitFor();
     assert.equal(await page.locator('.paulista-fixture').count(), 25, 'outage retains existing games');
     assert.equal(await page.locator('.paulista-skeleton').count(), 0, 'refresh does not flash a skeleton');
     failRead = false; await page.getByRole('button', { name: 'Tentar atualizar' }).click();
     await page.locator('.paulista-update-notice').waitFor({ state: 'detached' });
     // Delayed category request: keep selection/response associated; skeleton follows the tab.
     delay = 500;
     await page.getByRole('tab', { name: 'SUB-8', exact: true }).click();
     await page.locator('.paulista-skeleton.is-jogos').waitFor();
     assert.equal(await page.locator('.paulista-fixture').count(), 0, 'never display previous category while new one loads');
     delay = 30;
     await page.getByRole('tab', { name: 'SUB-7', exact: true }).click();
     await page.locator('.paulista-skeleton').waitFor({ state: 'detached' });
     await page.waitForTimeout(550);
     assert.equal(await page.locator('[data-game-id^="game-1-"]').count(), 0, 'late response never replaces new selection');
     delay = 500;
     for (const tab of ['visao', 'classificacao', 'chaveamento']) {
      let release; hold = new Promise(resolve => { release = resolve; });
      try {
       await page.goto(base + `/competicoes?evento=900&ano=2026&faixa=INICIACAO&aba=${tab}`);
       await page.locator(`.paulista-page .paulista-skeleton.is-${tab}`).waitFor();
       assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'skeleton has no page overflow');
       const bounds = await page.locator('.paulista-skeleton').boundingBox();
       assert.ok(bounds.x >= 10 && bounds.x + bounds.width <= width - 10, 'skeleton respects page margins');
       await page.screenshot({ path: `test-results/paulista-skeleton-${tab}-${width}.png` });
      } finally { hold = null; release(); }
      await page.locator('.paulista-skeleton').waitFor({ state: 'detached' });
     }
    }
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
    await page.screenshot({ path: `test-results/paulista-audit-${width}.png` });
   } finally { await context.close(); }
  }
 } finally { await browser.close(); fs.writeFileSync(`test-results/paulista-audit-${baseline ? 'before' : 'after'}.json`, JSON.stringify(results, null, 2)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
