const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');
const base = 'http://127.0.0.1:5187';
const output = path.resolve(__dirname, '../../../test-results/match-lineup');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  try {
    for (const width of [320, 390, 1366]) for (const theme of ['dark', 'light']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: width < 600 });
      await context.addInitScript(theme => {
        localStorage.setItem('ludora_token', 'test');
        localStorage.setItem('ludora_tema', theme);
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
        localStorage.setItem('ludora_clube_id', '2');
      }, theme);
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await require('./visual-fixture.cjs').install(page);
      const players = Array.from({ length: 7 }, (_, i) => ({ id: 100 + i, nome: `Atleta ${i + 1}`, posicao: 'Fixo', numCamisa: i + 1 }));
      let lineup = players.slice(0, 6).map((player, i) => ({ jogador_id: player.id, numCamisa: player.numCamisa, titular: i < 5, jogador: player }));
      let saved;
      await page.route('**/jogadores/perfis?*', route => route.fulfill({ json: players }));
      await page.route('**/partidas?*', route => route.fulfill({ json: [{ id: 106, status: 'PREPARADA', data: '2026-10-29', horario: '19:30', local: 'Ginasio Ocian', categoria_id: 1, categoria: { id: 1, nome: 'sub-7' }, mandante_id: 13, visitante_id: 14, emCasa: true, gols_mandante: 0, gols_visitante: 0, mandante: { id: 13, nome: 'Ocian' }, visitante: { id: 14, nome: 'Santos' } }] }));
      await page.route('**/partidas/106/escalacao', route => {
        if (route.request().method() === 'PUT') {
          saved = route.request().postDataJSON().jogadores;
          lineup = saved.map(item => ({ ...item, jogador: players.find(j => j.id === item.jogador_id) }));
        }
        return route.fulfill({ json: lineup });
      });
      await require('./shared-match-fixture.cjs').install(page, { players, lineup: () => lineup, match: () => ({status:'PREPARADA'}) });
      await page.goto(base + '/partidas/106');
      await page.getByRole('button', { name: 'Montar escalação', exact: true }).click();
      await page.locator('.lineup-row').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.getByRole('heading', { name: 'Preparação da partida' }).count(), 1);
      assert.equal(await page.locator('.lineup-starter-tag').count(), 5);
      assert.equal(await page.locator('.lineup-available').getAttribute('open'), null);
      assert.equal(await page.locator('.match-detail-facts > div').count(), 0, 'Match data stays in its own step');
      const first = page.locator('[data-lineup-id="100"]');
      const reserve = page.locator('[data-lineup-id="105"]');
      await reserve.scrollIntoViewIfNeeded();
      await first.evaluate(el => el.scrollIntoView({ block: 'start' }));
      const from = await first.locator('.lineup-swap').boundingBox();
      const to = await reserve.boundingBox();
      if (width >= 600) {
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.down();
        await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
        await page.mouse.up();
      } else {
        const client = await context.newCDPSession(page);
        const x = from.x + from.width / 2, y = from.y + from.height / 2;
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let i = 1; i <= 10; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (to.x + to.width / 2 - x) * i / 10, y: y + (to.y + to.height / 2 - y) * i / 10 }] });
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await client.detach();
      }
      await page.waitForFunction(() => document.querySelector('[data-lineup-id="105"] .lineup-starter-tag'));
      assert.equal(await page.locator('[data-lineup-id="100"] .lineup-starter-tag').count(), 0);
      assert.equal(await page.locator('.lineup-starter-tag').count(), 5);
      assert.equal(await page.getByRole('button', { name: 'Iniciar partida', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Salvar escalação', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.preparation-save-state')?.textContent.includes('Escalação salva'));
      assert.equal(saved.filter(item => item.titular).length, 5);
      assert.equal(saved.find(item => item.jogador_id === 105).titular, true);
      assert.equal(new Set(saved.map(item => item.jogador_id)).size, 6);
      await page.locator('[data-lineup-id="105"] .lineup-swap').focus();
      await page.keyboard.press('Enter');
      await page.locator('[data-lineup-id="100"] .lineup-swap').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('[data-lineup-id="100"] .lineup-starter-tag').count(), 1);
      assert.equal(await page.locator('.lineup-starter-tag').count(), 5);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(output, `lineup-${width}-${theme}.png`), fullPage: true });
      await page.reload();
      await page.getByRole('button', { name: 'Montar escalação', exact: true }).click();
      await page.locator('.lineup-row').first().waitFor();
      assert.equal(await page.locator('[data-lineup-id="105"] .lineup-starter-tag').count(), 1, 'Saved lineup survives reload');
      console.log(`Lineup OK ${width}px ${theme}: drag, keyboard, five starters, persistence, responsive header`);
      await context.close();
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
