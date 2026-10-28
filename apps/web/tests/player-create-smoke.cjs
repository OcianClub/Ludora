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
    for (const width of [320, 390, 820, 1366]) {
      for (const theme of ['dark', 'light']) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        await context.addInitScript(theme => {
          localStorage.setItem('ludora_token', 'test-only');
          localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex', email: 'test@example.test' }));
          localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
          localStorage.setItem('ludora_clube_id', '2');
          localStorage.setItem('ludora_tema', theme);
        }, theme);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
        await require('./visual-fixture.cjs').install(page);
        await page.route('http://localhost:3000/jogadores/categoria?*', route => route.fulfill({ json: {
          categoria: { id: 1, nome: 'sub-7', tipo: 'INICIACAO' }, temporada: 2026,
        } }));
        const posts = [];
        let firstFailure = width === 320 || width === 390;
        await page.route('http://localhost:3000/jogadores', async route => {
          if (route.request().method() !== 'POST') return route.fallback();
          const body = route.request().postDataJSON();
          posts.push(body);
          if (firstFailure) {
            firstFailure = false;
            return route.fulfill(width === 390 ? { status: 409, json: {
              error: 'Camisa em uso', conflito_camisa: { jogador_id: 100, nome: 'Outro aluno', camisa: 9, categoria: 'sub-7', camisa_anterior: null },
            } } : { status: 503, json: { error: 'Serviço temporariamente indisponível. Tente novamente.' } });
          }
          await new Promise(resolve => setTimeout(resolve, 100));
          return route.fulfill({ json: { id: 999, ...body } });
        });
        await page.goto(base + '/jogadores');
        await page.locator('.alunos-results-bar').waitFor();
        await page.getByRole('button', { name: '+ Adicionar aluno', exact: true }).click();
        const form = page.getByRole('dialog', { name: 'Adicionar aluno', exact: true });
        assert.equal(await form.getByRole('button', { name: 'Salvar aluno', exact: true }).isDisabled(), true);
        for (const [index, value] of ['15', 'Janeiro', '2019'].entries()) {
          const choice = form.locator('.birth-fields .choice').nth(index);
          await choice.locator('.choice-trigger').click();
          await choice.getByRole('button', { name: value, exact: true }).click();
        }
        await page.waitForFunction(() => document.querySelector('.alunos-category-notice')?.textContent.includes('Temporada 2026'));
        await form.getByRole('button', { name: 'Salvar aluno', exact: true }).click();
        assert.ok(await form.getByRole('alert').textContent().then(text => text.includes('nome completo')));
        assert.equal(posts.length, 0);
        await form.getByLabel('Nome completo', { exact: true }).fill('Aluno de teste');
        await form.getByLabel('CPF', { exact: true }).fill('52998224725');
        await form.getByLabel('Camisa (opcional)', { exact: true }).fill('9');
        const notice = form.locator('.alunos-category-notice');
        assert.equal(await notice.evaluate(el => getComputedStyle(el).borderTopWidth), '0px');
        await form.getByLabel('Nome completo', { exact: true }).press('Enter');
        const review = page.getByRole('dialog', { name: 'Revisar aluno', exact: true });
        await review.waitFor();
        assert.equal(posts.length, 0, 'Revisar não envia o cadastro');
        assert.ok(await review.getByText('Aluno de teste', { exact: true }).isVisible());
        assert.ok(await review.getByText('15/01/2019', { exact: true }).isVisible());
        assert.ok(await review.evaluate(el => el.scrollWidth <= el.clientWidth), 'Resumo sem corte horizontal');
        await review.getByRole('button', { name: 'Voltar e editar' }).click();
        assert.equal(await form.getByLabel('Nome completo', { exact: true }).inputValue(), 'Aluno de teste');
        await form.getByRole('button', { name: 'Salvar aluno', exact: true }).click();
        await review.screenshot({ path: path.join(output, `player-review-${width}-${theme}.png`) });
        await review.getByRole('button', { name: 'Confirmar e salvar' }).click();
        if (width === 390) {
          await form.locator('.alunos-conflict').waitFor();
          assert.ok(await form.getByText('A camisa 9 já pertence a Outro aluno no SUB-7.', { exact: true }).isVisible());
          await form.getByRole('button', { name: 'Confirmar transferência', exact: true }).click();
          await form.waitFor({ state: 'hidden' });
          assert.deepEqual(posts[1].confirmar_camisa, { jogador_id: 100, camisa_anterior: null });
        } else if (width === 320) {
          await review.getByRole('alert').waitFor();
          await review.getByRole('button', { name: 'Confirmar e salvar' }).click();
        }
        await review.waitFor({ state: 'hidden' });
        assert.equal(posts.length, width < 400 ? 2 : 1);
        assert.equal(posts[0].nome, 'Aluno de teste');
        assert.equal(posts[0].dtNasc, '2019-01-15');
        assert.notEqual(await page.locator('body').evaluate(el => getComputedStyle(el).position), 'fixed');
        assert.deepEqual(errors, []);
        console.log(`PASS aluno ${width}px ${theme}: revisão, edição e ${width === 390 ? 'conflito de camisa' : width === 320 ? 'falha e tentativa novamente' : 'confirmação'}`);
        await context.close();
      }
    }
    for (const role of ['TORCEDOR', null, 'ADMIN']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
      await context.addInitScript(role => {
        localStorage.setItem('ludora_token', 'test-only');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: role }));
        localStorage.setItem('ludora_clube_id', '2');
      }, role);
      const page = await context.newPage();
      await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
      await require('./visual-fixture.cjs').install(page, { role });
      await page.goto(base + '/dashboard');
      await page.getByRole('heading', { name: 'Histórico de partidas', exact: true }).waitFor();
      assert.equal(await page.locator('.home-pending').count(), role === 'ADMIN' ? 1 : 0);
      assert.ok(await page.locator('.home-upcoming-day > a').first().evaluate(el => parseFloat(getComputedStyle(el).borderRadius) > 0));
      console.log(`PASS pendências e hover: ${role || 'visitante'}`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
