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
      const players = Array.from({ length: 7 }, (_, i) => ({ id: 100 + i, nome: `Atleta ${i + 1}`, categoria_id: 1, posicao: i === 0 ? 'Goleiro' : 'Fixo', numCamisa: i === 6 ? null : i + 1 }));
      let lineup = [], status = 'AGENDADA';
      const transitions = [];
      const match = () => ({ id: 106, status, data: '2026-10-29', horario: '19:30', local: 'Ginasio Ocian', categoria_id: 1, categoria: { id: 1, nome: 'sub-7' }, mandante_id: 13, visitante_id: 14, emCasa: true, gols_mandante: 0, gols_visitante: 0, mandante: { id: 13, nome: 'Ocian', clube_representado_id: 2 }, visitante: { id: 14, nome: 'Santos', clube_representado_id: 3 } });
      await page.route('**/jogadores/perfis?*', route => route.fulfill({ json: players }));
      await page.route('**/jogadores?*', route => route.fulfill({ json: players }));
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
      await page.goto(`${process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187'}/partidas/106`);
      await page.getByRole('navigation', { name: 'Etapas da preparação' }).waitFor();
      assert.equal(await page.locator('.preparation-steps [aria-current="step"]').innerText(), '1\nDados');
      assert.equal(await page.getByRole('button', { name: 'Iniciar partida', exact: true }).count(), 0);
      if (width <= 760) assert.equal(await page.locator('.workspace-header').isVisible(), false);
      else assert.ok(await page.locator('.sidebar').isVisible());
      assert.match(await page.locator('.preparation-context-header').innerText(), /19:30/);
      assert.match(await page.locator('.preparation-context-header').innerText(), /Organizador/);
      if (width < 600) {
        const edit = page.getByRole('button', { name: 'Editar partida', exact: true });
        assert.ok((await edit.boundingBox()).width <= 40);
        assert.equal(await edit.locator('span:not(.icon)').isVisible(), false);
        const steps = await page.locator('.preparation-steps button').all();
        for (let i = 1; i < steps.length; i++) {
          const previous = await steps[i - 1].boundingBox(), current = await steps[i].boundingBox();
          assert.ok(current.x >= previous.x + previous.width);
        }
      }

      await page.getByRole('button', { name: 'Montar escalação', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Salvar e revisar', exact: true }).isDisabled(), true);
      assert.equal(await page.getByRole('navigation', { name: 'Etapas da preparação' }).getByRole('button', { name: 'Revisão' }).isDisabled(), true);
      const search = page.getByRole('searchbox', { name: 'Buscar jogador disponível' });
      const help = page.getByRole('button', { name: 'Como trocar', exact: true });
      await help.click();
      assert.equal(await help.getAttribute('aria-expanded'), 'true');
      await page.getByRole('heading', { name: 'Monte sua equipe', exact: true }).click();
      assert.equal(await help.getAttribute('aria-expanded'), 'false');
      await help.click();
      await page.keyboard.press('Escape');
      assert.equal(await help.getAttribute('aria-expanded'), 'false');
      assert.ok(await help.evaluate(el => el === document.activeElement));

      await search.fill('inexistente');
      assert.match(await page.locator('.lineup-roster .lineup-empty').innerText(), /Nenhum jogador encontrado/);
      await search.fill('Atleta 7');
      const missingShirt = page.getByRole('button', { name: 'Definir camisa de Atleta 7', exact: true });
      assert.equal(await missingShirt.evaluate(el => getComputedStyle(el).borderStyle), 'dashed');
      assert.equal(await page.locator('.available-player-info small').count(), 0);
      await page.getByRole('button', { name: 'Definir camisa de Atleta 7', exact: true }).click();
      await page.getByRole('dialog', { name: 'Número da camisa' }).waitFor();
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      assert.equal(await page.locator('.lineup-row').count(), 0);
      assert.equal(await page.locator('.lineup-empty-slot:not(.lineup-empty-reserve)').count(), 5);
      await search.fill('');
      for (let i = 1; i <= 4; i++) await page.getByRole('button', { name: `Convocar Atleta ${i}`, exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Salvar e revisar', exact: true }).isDisabled(), true);
      await page.getByRole('button', { name: 'Convocar Atleta 5', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Salvar e revisar', exact: true }).isEnabled(), true);
      assert.match(await page.locator('.lineup-reserve-tip').innerText(), /Recomendamos convocar alguns reservas/);
      await page.getByRole('button', { name: /Adicionar reserva/ }).click();
      assert.ok(await search.evaluate(el => el === document.activeElement));
      assert.equal(await page.locator('.lineup-row').count(), 5);

      await page.getByRole('button', { name: 'Convocar Atleta 6', exact: true }).click();
      assert.equal(await page.locator('.lineup-selected .lineup-starter-tag').count(), 0);
      assert.equal(await page.locator('.lineup-row').count(), 6);
      assert.equal(await page.locator('.lineup-empty-reserve').count(), 0);
      const selectedBox = await page.locator('.lineup-selected').boundingBox();
      const rosterBox = await page.locator('.lineup-roster').boundingBox();
      if (width > 900) assert.ok(rosterBox.x > selectedBox.x + selectedBox.width && Math.abs(selectedBox.y - rosterBox.y) < 1);
      else assert.ok(rosterBox.y >= selectedBox.y + selectedBox.height);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(output, `lineup-${width}-${theme}.png`), fullPage: true });
      assert.equal(await page.locator('.preparation-footer button').count(), 2);
      await page.getByRole('navigation', { name: 'Etapas da preparação' }).getByRole('button', { name: 'Dados' }).click();
      assert.equal(await page.getByRole('checkbox').count(), 0);
      await page.getByRole('button', { name: 'Montar escalação', exact: true }).click();
      assert.equal(await page.locator('.lineup-row').count(), 6);
      await page.getByRole('button', { name: 'Salvar e revisar', exact: true }).click();
      await page.getByRole('heading', { name: 'Revise sua equipe' }).waitFor();
      assert.equal(lineup.length, 6);
      await page.reload();
      await page.getByRole('heading', { name: 'Revise sua equipe' }).waitFor();
      assert.equal(await page.locator('.preparation-steps [aria-current="step"]').innerText(), '3\nRevisão');
      assert.equal(await page.locator('.preparation-review-lists li .lineup-position').count(), 6);
      assert.match(await page.locator('.preparation-review-lists h4').first().innerText(), /5\/5/);
      assert.ok((await page.locator('.preparation-context-header').boundingBox()).height < 280);
      assert.match(await page.locator('.preparation-header-location').innerText(), /Ginasio Ocian/);
      assert.equal(await page.locator('.preparation-context-header').count(), 1);
      assert.equal(await page.locator('.preparation-header-center .icon').count(), 0);
      assert.ok((await page.locator('.preparation-header-team .club-badge').first().boundingBox()).width >= (width < 600 ? 52 : 64));
      await page.evaluate(() => window.scrollTo(0, 500));
      const pinned = await page.locator('.preparation-context-header').boundingBox();
      assert.ok(pinned.y < 0, `Cabeçalho não rolou junto com a página: ${pinned.y}`);
      await page.evaluate(() => window.scrollTo(0, 0));
      assert.equal(await page.getByRole('button', { name: 'Iniciar partida', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Confirmar minha equipe', exact: true }).click();
      await page.getByRole('button', { name: 'Iniciar partida', exact: true }).waitFor();
      assert.deepEqual(transitions, ['PREPARADA']);
      await page.screenshot({ path: path.join(output, `review-${width}-${theme}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Iniciar partida', exact: true }).click();
      await page.locator('.partida-detalhe:not([data-preparation])').waitFor();
      if (width <= 760) assert.equal(await page.locator('.workspace-header').isVisible(), false);
      assert.equal(await page.getByRole('navigation', { name: 'Etapas da preparação' }).count(), 0);
      assert.deepEqual(transitions, ['PREPARADA', 'AO_VIVO']);
      assert.ok(await page.getByRole('heading', { name: 'Acontecimentos', exact: true }).isVisible());
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      console.log(`Preparation OK: ${width}px ${theme}; stages, back, draft, validation, preparation and explicit start`);
      await context.close();
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });

