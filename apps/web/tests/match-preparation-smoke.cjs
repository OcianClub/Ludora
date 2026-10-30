const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(__dirname, '../../../test-results/match-preparation');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  try {
    for (const width of [320, 390, 820, 1366]) for (const theme of ['dark', 'light']) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      await context.addInitScript(theme => {
        localStorage.setItem('ludora_token', 'test'); localStorage.setItem('ludora_tema', theme);
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' })); localStorage.setItem('ludora_clube_id', '2');
      }, theme);
      const page = await context.newPage(); page.on('pageerror', err => errors.push(err.message));
      await require('./visual-fixture.cjs').install(page);
      const players = Array.from({ length: 7 }, (_, i) => ({ id: 100 + i, nome: `Atleta ${i + 1}`, posicao: 'Fixo', numCamisa: i === 6 ? null : i + 1 }));
      let lineup = [], status = 'AGENDADA';
      const transitions = [];
      const match = () => ({ id: 106, status, data: '2026-10-29', horario: '19:30', local: 'Ginasio Ocian', categoria_id: 1, categoria: { id: 1, nome: 'sub-7' }, mandante_id: 13, visitante_id: 14, emCasa: true, gols_mandante: 0, gols_visitante: 0, mandante: { id: 13, nome: 'Ocian', clube_representado_id: 2 }, visitante: { id: 14, nome: 'Santos', clube_representado_id: 3 } });
      await page.route('**/jogadores/perfis?*', route => route.fulfill({ json: players }));
      await page.route('**/partidas?*', route => route.fulfill({ json: [match()] }));
      await page.route('**/partidas/106/escalacao', route => {
        if (route.request().method() === 'PUT') lineup = route.request().postDataJSON().jogadores;
        return route.fulfill({ json: lineup });
      });
      await page.route('**/partidas/106/status', route => {
        const data = route.request().postDataJSON();
        assert.equal(data.status_anterior, status);
        assert.equal(lineup.filter(j => j.titular).length, 5);
        status = data.status; transitions.push(status);
        return route.fulfill({ json: match() });
      });
      await require('./shared-match-fixture.cjs').install(page, { players, lineup: () => lineup, match, confirm: () => { status = 'PREPARADA'; transitions.push(status); } });
      await page.goto('http://127.0.0.1:5187/partidas/106');
      await page.getByRole('navigation', { name: 'Etapas da preparação' }).waitFor();
      assert.equal(await page.locator('.preparation-steps [aria-current="step"]').innerText(), '1\nDados');
      assert.equal(await page.getByRole('button', { name: 'Iniciar partida', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Montar escalação', exact: true }).click();
      await page.getByRole('button', { name: 'Revisar partida', exact: true }).click();
      assert.match(await page.locator('.preparation-footer [role="alert"]').innerText(), /5 titulares/);
      await page.locator('.lineup-available summary').click();
      const search = page.getByRole('searchbox', { name: 'Buscar jogador disponível' });
      await search.fill('inexistente');
      assert.match(await page.locator('.lineup-available .lineup-empty').innerText(), /Nenhum jogador encontrado/);
      await search.fill('Atleta 7');
      await page.getByRole('button', { name: 'Definir camisa de Atleta 7', exact: true }).click();
      await page.getByRole('dialog', { name: 'Número da camisa' }).waitFor();
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      assert.equal(await page.locator('.lineup-row').count(), 0);
      await search.fill('');
      for (let i = 1; i <= 6; i++) await page.getByRole('button', { name: `Convocar Atleta ${i}`, exact: true }).click();
      assert.equal(await page.locator('.lineup-starter-tag').count(), 5);
      assert.equal(await page.locator('.lineup-row').count(), 6);
      if (width > 760) {
        const a = await page.locator('.lineup-columns > section').nth(0).boundingBox();
        const b = await page.locator('.lineup-columns > section').nth(1).boundingBox();
        assert.ok(b.x > a.x + a.width && Math.abs(a.y - b.y) < 1);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(output, `lineup-${width}-${theme}.png`), fullPage: true });
      assert.equal(await page.locator('.preparation-footer button').count(), 2);
      await page.getByRole('navigation', { name: 'Etapas da preparação' }).getByRole('button', { name: 'Dados' }).click();
      assert.equal(await page.getByRole('checkbox').count(), 0);
      await page.getByRole('button', { name: 'Montar escalação', exact: true }).click();
      assert.equal(await page.locator('.lineup-row').count(), 6);
      await page.getByRole('button', { name: 'Revisar partida', exact: true }).click();
      await page.getByRole('heading', { name: 'Tudo certo para jogar?' }).waitFor();
      assert.equal(lineup.length, 6);
      await page.reload();
      await page.getByRole('heading', { name: 'Tudo certo para jogar?' }).waitFor();
      assert.equal(await page.locator('.preparation-steps [aria-current="step"]').innerText(), '3\nRevisão');
      assert.equal(await page.locator('.preparation-review-lists li .lineup-position').count(), 6);
      assert.ok((await page.locator('.match-detail-card').boundingBox()).height < (width < 600 ? 300 : 320));
      assert.equal(await page.getByRole('button', { name: 'Iniciar partida', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Confirmar preparação', exact: true }).click();
      await page.getByRole('button', { name: 'Iniciar partida', exact: true }).waitFor();
      assert.deepEqual(transitions, ['PREPARADA']);
      await page.screenshot({ path: path.join(output, `review-${width}-${theme}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Iniciar partida', exact: true }).click();
      await page.getByRole('heading', { name: 'Detalhes da partida', exact: true }).waitFor();
      assert.equal(await page.getByRole('navigation', { name: 'Etapas da preparação' }).count(), 0);
      assert.deepEqual(transitions, ['PREPARADA', 'AO_VIVO']);
      assert.ok(await page.getByRole('heading', { name: 'Eventos da partida', exact: true }).isVisible());
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      console.log(`Preparation OK: ${width}px ${theme}; stages, back, draft, validation, preparation and explicit start`);
      await context.close();
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });

