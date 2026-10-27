const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5189';
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const output = path.resolve(__dirname, '../../../test-results/web-players-layout');
  fs.mkdirSync(output, { recursive: true });
  try {
    for (const width of [320, 390, 820, 1366]) for (const theme of ['dark', 'light']) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 600 });
      await context.addInitScript(theme => {
        localStorage.setItem('ludora_token', 'visual-test-only');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex', email: 'test@example.test' }));
        localStorage.setItem('ludora_clube_id', '2');
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
        localStorage.setItem('ludora_tema', theme);
      }, theme);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      await require('./visual-fixture.cjs').install(page);
      await page.goto(base + '/jogadores');
      await page.locator('.alunos-table').waitFor();
      const rows = page.locator('.alunos-table tbody tr');
      assert.equal(await rows.count(), 25);
      assert.equal(await page.locator('.alunos-category-toggle').count(), 0);
      const firstNames = await rows.locator('.alunos-player-link').allTextContents();
      assert.deepEqual(firstNames, [...firstNames].sort((a, b) => a.localeCompare(b)));
      await page.getByRole('button', { name: 'Próxima página', exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll('.alunos-table tbody tr').length === 7);
      await page.getByRole('button', { name: 'Página anterior', exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll('.alunos-table tbody tr').length === 25);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const filter = page.getByRole('button', { name: 'Subcategoria Todos os subs' });
      await filter.click();
      await page.locator('[data-choice-option]').filter({ hasText: /^SUB-7$/ }).click();
      await page.waitForFunction(() => document.querySelectorAll('.alunos-table tbody tr').length === 8);
      assert.equal(await page.locator('.alunos-table .alunos-cell-category').count(), 0);
      await page.goto(base + '/jogadores');
      await page.locator('.alunos-table').waitFor();
      assert.equal(await rows.count(), 8, 'A seleção deve persistir ao voltar à página');
      assert.equal(await page.getByRole('button', { name: 'Subcategoria SUB-7', exact: true }).count(), 1);
      await page.getByRole('button', { name: 'Limpar filtros' }).click();
      if (width < 901) {
        await page.getByRole('button', { name: 'Filtros', exact: true }).click();
        const filters = page.getByRole('dialog', { name: 'Filtrar jogadores' });
        await filters.getByRole('button', { name: 'Sem número', exact: true }).click();
        await filters.getByRole('button', { name: 'Ver jogadores' }).click();
        await filters.waitFor({ state: 'hidden' });
        await page.getByRole('button', { name: 'Remover filtro de camisa' }).click();
      }
      await page.waitForFunction(() => document.querySelectorAll('.alunos-table tbody tr').length === 25);
      await page.getByLabel('Buscar aluno', { exact: true }).fill('Nome inexistente');
      await page.getByRole('heading', { name: 'Nenhum jogador encontrado' }).waitFor();
      await page.locator('.alunos-search input').fill('');
      await page.locator('.alunos-table').waitFor();
      await page.getByRole('button', { name: 'Base', exact: true }).click();
      await page.waitForFunction(() => [...document.querySelectorAll('.alunos-player-link')].length === 25 && [...document.querySelectorAll('.alunos-player-link')].every(link => Number(link.getAttribute('href').split('/').pop()) >= 500));
      await page.getByRole('button', { name: 'Iniciação', exact: true }).click();
      await page.waitForFunction(() => [...document.querySelectorAll('.alunos-player-link')].length === 25 && [...document.querySelectorAll('.alunos-player-link')].every(link => Number(link.getAttribute('href').split('/').pop()) < 500));
      await page.screenshot({ path: path.join(output, `players-${width}-${theme}.png`), fullPage: true });
      if (width === 390 && theme === 'dark') {
        await page.locator('.alunos-player-link').first().click();
        await page.waitForURL(/\/jogadores\/\d+/);
        await page.goBack();
        await page.locator('.alunos-table').waitFor();
        assert.equal(await rows.count(), 25);
      }
      await page.getByRole('button', { name: '+ Adicionar aluno', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Adicionar aluno', exact: true });
      await dialog.waitFor();
      assert.deepEqual(await dialog.locator('.birth-fields .field-label').allTextContents(), ['Dia', 'Mês', 'Ano']);
      assert.equal(await dialog.getByLabel('Nome completo').getAttribute('placeholder'), 'Ex.: João Pedro da Silva');
      await dialog.getByRole('button', { name: 'Fixo', exact: true }).click();
      const save = await dialog.getByRole('button', { name: 'Salvar aluno' }).boundingBox();
      assert.ok(save.y >= 0 && save.y + save.height <= 844);
      assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth));
      assert.equal(await dialog.getByRole('button', { name: 'Salvar aluno' }).isDisabled(), true);
      await page.screenshot({ path: path.join(output, `create-${width}-${theme}.png`) });
      if (width === 390 && theme === 'dark') {
        let attempts = 0;
        await page.route('**/jogadores', route => {
          if (route.request().method() !== 'POST') return route.fallback();
          const payload = route.request().postDataJSON();
          assert.equal(payload.nome, 'Novo Aluno');
          assert.equal(payload.posicao, 'Fixo');
          assert.equal(payload.dtNasc, '2019-01-15');
          attempts++;
          return attempts === 1 ? route.fulfill({ status: 503, json: { error: 'Não foi possível salvar. Tente novamente.' } }) : route.fulfill({ json: { id: 999, ...payload } });
        });
        await dialog.getByLabel('Nome completo').fill('Novo Aluno');
        await dialog.getByLabel('CPF', { exact: true }).fill('12345678909');
        for (const [label, placeholder, value] of [['Dia', 'Dia', '15'], ['Mês', 'Mês', 'Janeiro'], ['Ano', 'Ano', '2019']]) {
          await dialog.getByRole('button', { name: `${label} ${placeholder}`, exact: true }).click();
          await dialog.locator('[data-choice-option]').getByText(value, { exact: true }).click();
        }
        await dialog.getByRole('button', { name: 'Salvar aluno' }).click();
        await dialog.getByRole('alert').waitFor();
        assert.equal(await dialog.getByLabel('Nome completo').inputValue(), 'Novo Aluno');
        await dialog.getByRole('button', { name: 'Salvar aluno' }).click();
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(attempts, 2);
        await page.getByRole('button', { name: '+ Adicionar aluno', exact: true }).click();
      }
      await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS jogadores ${width}px ${theme}: filtro de sub, limpeza, modal e rodapé acessíveis, sem overflow`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
