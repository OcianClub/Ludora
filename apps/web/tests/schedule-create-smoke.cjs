const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5188';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const { width, theme } of [320, 390, 1366].flatMap(width => ['dark', 'light'].map(theme => ({ width, theme })))) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(theme => {
        localStorage.setItem('ludora_token', 'visual-test-only');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex', email: 'visual@example.test' }));
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
        localStorage.setItem('ludora_clube_id', '2');
        localStorage.setItem('ludora_tema', theme);
      }, theme);
      const page = await context.newPage();
      await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      await require('./visual-fixture.cjs').install(page);
      const crest = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="royalblue"/></svg>');
      await page.route('**/times', route => route.fulfill({ json: [
        { id: 13, nome: 'Ocian', categoria_id: 1, escudo: crest, clube_representado_id: 2 },
        { id: 14, nome: 'Santos', categoria_id: 1, clube_representado_id: 3 },
      ] }));
      let posts = 0;
      let failSave = width === 320;
      await page.route('**/partidas', route => {
        if (route.request().method() !== 'POST') return route.fallback();
        posts++;
        if (failSave) return route.fulfill({ status: 503, json: { error: 'Database unavailable' } });
        const body = route.request().postDataJSON();
        assert.equal(body.competicao_id, undefined);
        assert.equal(body.mandante_id, 13);
        assert.equal(body.visitante_id, 14);
        return route.fulfill({ json: { id: 999, ...body } });
      });
      await page.goto(base + '/partidas');
      await page.getByRole('button', { name: 'Nova partida', exact: true }).filter({ visible: true }).click();
      const form = page.getByRole('dialog', { name: 'Organizar partida', exact: true });
      assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).position), 'fixed');
      if (width < 600) {
        const bounds = await form.boundingBox();
        assert.equal(bounds.y, 0);
        assert.equal(bounds.height, 900, 'Modal cobre também a área da navegação inferior');
      }
      const background = await form.evaluate(el => getComputedStyle(el).backgroundColor);
      assert.equal(background, await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor));
      await form.getByRole('button', { name: 'Selecionar categoria da partida' }).click();
      const categories = page.getByRole('dialog', { name: 'Categoria da partida', exact: true });
      assert.equal(await categories.getByRole('button', { name: 'Iniciação', exact: true }).count(), 1);
      assert.equal(await categories.getByRole('button', { name: 'Base', exact: true }).count(), 1);
      await categories.getByRole('button', { name: 'SUB-7', exact: true }).click();
      await categories.getByRole('button', { name: 'Usar categoria', exact: true }).click();
      assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).position), 'fixed', 'Fechar um modal filho mantém o fundo bloqueado');
      assert.equal(await form.getByRole('button', { name: 'Selecionar categoria da partida' }).evaluate(el => el === document.activeElement), true);
      if (width < 600) {
        await page.setViewportSize({ width, height: 520 });
        await page.waitForFunction(() => Math.abs(document.querySelector('.schedule-create-dialog').getBoundingClientRect().height - innerHeight) < 2);
        const action = await form.getByRole('button', { name: 'Criar partida', exact: true }).boundingBox();
        assert.ok(action.y >= 0 && action.y + action.height <= 520);
        await page.setViewportSize({ width, height: 900 });
      }
      await form.getByRole('button', { name: 'Selecionar competição', exact: true }).click();
      await page.getByRole('dialog', { name: 'Selecionar competição', exact: true }).getByRole('button', { name: /Amistoso/ }).click();
      await form.getByRole('button', { name: 'Selecionar mandante' }).click();
      const home = page.getByRole('dialog', { name: 'Selecionar mandante', exact: true });
      await home.getByRole('button', { name: /Ocian/ }).hover();
      const hover = await home.getByRole('button', { name: /Ocian/ }).evaluate(el => ({ row: getComputedStyle(el).backgroundColor, badge: getComputedStyle(el.querySelector('.club-badge')).backgroundColor, radius: parseFloat(getComputedStyle(el).borderRadius) }));
      assert.notEqual(hover.row, hover.badge);
      assert.ok(hover.radius > 0);
      await home.getByRole('searchbox').fill('Ocian');
      await page.keyboard.press('Escape');
      await home.waitFor({ state: 'hidden' });
      assert.equal(await form.getByRole('button', { name: 'Selecionar mandante' }).evaluate(el => el === document.activeElement), true);
      await form.getByRole('button', { name: 'Selecionar mandante' }).click();
      assert.equal(await home.getByRole('searchbox').inputValue(), '');
      await home.getByRole('searchbox').fill('Ocian');
      await home.getByRole('button', { name: /Ocian/ }).click();
      await form.getByRole('button', { name: 'Selecionar visitante' }).click();
      const away = page.getByRole('dialog', { name: 'Selecionar visitante', exact: true });
      assert.ok(await away.getByRole('button', { name: /Ocian/ }).isVisible());
      await away.getByRole('searchbox').fill('Santos');
      await away.getByRole('button', { name: /Santos/ }).click();
      const cards = form.locator('.schedule-create-team');
      assert.equal(await cards.count(), 2);
      assert.equal(await cards.nth(0).locator('.club-badge img').getAttribute('src'), crest);
      assert.equal(await cards.nth(1).locator('.club-badge').textContent(), 'S');
      const first = await cards.nth(0).boundingBox();
      const second = await cards.nth(1).boundingBox();
      assert.equal(first.y, second.y);
      assert.ok(second.x > first.x + first.width);
      await form.getByLabel('Horário', { exact: true }).fill('19:30');
      await form.getByRole('button', { name: 'Criar partida', exact: true }).click();
      assert.ok(await form.getByText('Informe a data da partida.', { exact: true }).isVisible());
      assert.equal(posts, 0);
      await form.getByRole('button', { name: 'Data', exact: true }).click();
      const calendar = page.getByRole('dialog', { name: 'Data da partida', exact: true });
      assert.ok(await calendar.getByRole('button', { name: 'Mês anterior', exact: true }).isDisabled(), 'Calendário impede voltar a um mês anterior ao atual');
      await calendar.getByRole('button', { name: /^Ano / }).click();
      await calendar.getByRole('button', { name: '2027', exact: true }).click();
      await calendar.getByRole('button', { name: /^Mês (?!anterior)/ }).click();
      await calendar.getByRole('button', { name: 'dezembro', exact: true }).click();
      await calendar.getByRole('button', { name: /21 de dezembro de 2027/ }).click();
      await form.getByLabel('Horário', { exact: true }).fill('25:80');
      await form.getByRole('button', { name: 'Criar partida', exact: true }).click();
      assert.equal(posts, 0);
      assert.ok(await form.getByText('Informe um horário válido entre 00:00 e 23:59.', { exact: true }).isVisible());
      await form.getByLabel('Horário', { exact: true }).fill('19:30');
      assert.equal(await form.locator('[aria-invalid="true"]').count(), 0);
      await form.screenshot({ path: path.resolve(__dirname, `../../../test-results/web-schedule/create-${width}-${theme}.png`) });
      assert.ok(await form.evaluate(el => el.scrollWidth <= el.clientWidth));
      await form.getByRole('button', { name: 'Criar partida', exact: true }).click();
      const review = page.getByRole('dialog', { name: 'Revisar partida', exact: true });
      await review.waitFor();
      assert.equal(posts, 0);
      await review.getByRole('button', { name: 'Voltar e editar' }).click();
      assert.ok((await form.getByRole('button', { name: 'Data', exact: true }).textContent()).includes('21/12/2027'));
      await form.getByRole('button', { name: 'Criar partida', exact: true }).click();
      await review.getByRole('button', { name: 'Confirmar e criar' }).click();
      if (failSave) {
        await review.getByRole('alert').waitFor();
        assert.ok(await review.getByRole('alert').textContent().then(text => text.includes('Seus dados foram mantidos')));
        failSave = false;
        await review.getByRole('button', { name: 'Confirmar e criar' }).click();
      }
      await review.waitFor({ state: 'hidden' });
      assert.notEqual(await page.locator('body').evaluate(el => getComputedStyle(el).position), 'fixed');
      assert.equal(posts, width === 320 ? 2 : 1);
      console.log(`PASS ${width}px ${theme}: contraste, cards, seleção, validação, revisão e ${width === 320 ? 'falha e recuperação' : 'confirmação'} simulada`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
