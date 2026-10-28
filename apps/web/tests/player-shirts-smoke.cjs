const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5189';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 820, 1366]) for (const theme of ['dark', 'light']) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(theme => {
        localStorage.setItem('ludora_token', 'test-only');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
        localStorage.setItem('ludora_clube_id', '2');
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
        localStorage.setItem('ludora_tema', theme);
      }, theme);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
      await require('./visual-fixture.cjs').install(page);
      const subs = [7, 8, 9, 10, 12, 14, 16, 18];
      const players = subs.flatMap((sub, index) => [0, 1].map(i => ({
        id: (index + 1) * 100 + i, nome: `${i ? 'Bia' : 'Ana'} Sub ${sub}`, categoria_id: index + 1,
        numCamisa: i ? 9 : null, dtNasc: '2019-01-01', cpf: '', posicao: 'Fixo', ativo: true,
      })));
      const writes = [];
      let failNext = false;
      await page.route('http://localhost:3000/jogadores**', async route => {
        const req = route.request(), url = new URL(req.url()), query = url.searchParams;
        const match = url.pathname.match(/^\/jogadores\/(\d+)$/);
        if (match && req.method() === 'PATCH') {
          const player = players.find(row => row.id === Number(match[1]));
          const body = req.postDataJSON();
          writes.push(body);
          if (failNext) { failNext = false; return route.fulfill({ status: 503, json: { error: 'Falha temporária. Tente novamente.' } }); }
          const other = players.find(row => row.id !== player.id && row.categoria_id === player.categoria_id && row.numCamisa === body.numCamisa);
          if (other) {
            if (body.confirmar_camisa?.jogador_id !== other.id || body.confirmar_camisa?.camisa_anterior !== player.numCamisa) {
              return route.fulfill({ status: 409, json: { error: 'Número em uso', conflito_camisa: {
                jogador_id: other.id, nome: other.nome, camisa: body.numCamisa,
                camisa_anterior: player.numCamisa, categoria: `sub-${subs[player.categoria_id - 1]}`,
              } } });
            }
            other.numCamisa = player.numCamisa;
          }
          player.numCamisa = body.numCamisa;
          return route.fulfill({ json: player });
        }
        if (url.pathname !== '/jogadores' || req.method() !== 'GET') return route.fallback();
        let rows = players.filter(row => (!query.get('fase') || (row.categoria_id <= 4 ? 'INICIACAO' : 'BASE') === query.get('fase'))
          && (!query.get('categoria_id') || row.categoria_id === Number(query.get('categoria_id')))
          && row.nome.toLowerCase().includes((query.get('busca') || '').toLowerCase())
          && (!query.get('posicao') || row.posicao === query.get('posicao'))
          && (!query.get('camisa') || (query.get('camisa') === 'missing' ? row.numCamisa == null : row.numCamisa != null)));
        if (query.get('resumo') === 'true') return route.fulfill({ json: subs.map((_, i) => ({
          categoria_id: i + 1, total: rows.filter(row => row.categoria_id === i + 1).length,
          semCamisa: rows.filter(row => row.categoria_id === i + 1 && row.numCamisa == null).length,
        })) });
        rows = rows.sort((a, b) => a.nome.localeCompare(b.nome));
        return route.fulfill({ json: rows.slice(Number(query.get('offset') || 0), Number(query.get('offset') || 0) + Number(query.get('limite') || 25)) });
      });
      await page.goto(base + '/jogadores?categoria=1&visualizacao=tabela');
      const button = name => page.getByRole('button', { name: new RegExp(`^(Definir|Editar) camisa de ${name}$`) });
      await button('Ana Sub 7').waitFor();
      if (width <= 760) {
        assert.equal(await page.locator('.alunos-table').count(), 0);
        assert.equal(await page.locator('.alunos-view-toggle').count(), 0);
        assert.equal(await page.locator('.alunos-sub-toggle').count(), 8);
      } else {
        assert.ok(await page.locator('.alunos-table').isVisible());
      }
      await button('Ana Sub 7').click();
      let dialog = page.getByRole('dialog', { name: 'Número da camisa', exact: true });
      await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
      assert.ok(await button('Ana Sub 7').evaluate(element => element === document.activeElement));
      await button('Ana Sub 7').click();
      await dialog.getByRole('button', { name: 'Salvar camisa', exact: true }).click();
      await dialog.getByText('Informe um número inteiro de 1 a 99.').waitFor();
      assert.equal(writes.length, 0);
      await dialog.getByLabel('Número da camisa', { exact: true }).fill('100');
      await dialog.getByRole('button', { name: 'Salvar camisa', exact: true }).click();
      assert.equal(writes.length, 0);
      await dialog.getByLabel('Número da camisa', { exact: true }).fill('7');
      if (width === 1366) await dialog.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
      else await dialog.getByRole('button', { name: 'Salvar camisa', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      await button('Ana Sub 7').waitFor();
      assert.match(await button('Ana Sub 7').innerText(), /7/);
      assert.deepEqual(writes[0], { numCamisa: 7 });
      await button('Ana Sub 7').click();
      dialog = page.getByRole('dialog', { name: 'Número da camisa', exact: true });
      await dialog.getByLabel('Número da camisa', { exact: true }).fill('9');
      await dialog.getByRole('button', { name: 'Salvar camisa', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Confirmar troca de camisas', exact: true });
      await dialog.waitFor();
      await dialog.screenshot({ path: `../../test-results/club-workspace/shirt-conflict-${width}-${theme}.png` });
      assert.equal(players.find(row => row.id === 100).numCamisa, 7);
      assert.equal(players.find(row => row.id === 101).numCamisa, 9);
      await dialog.getByRole('button', { name: 'Voltar e editar', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Número da camisa', exact: true });
      await dialog.getByRole('button', { name: 'Salvar camisa', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Confirmar troca de camisas', exact: true });
      await dialog.getByRole('button', { name: 'Confirmar troca', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      await button('Ana Sub 7').waitFor();
      assert.equal(players.find(row => row.id === 100).numCamisa, 9);
      assert.equal(players.find(row => row.id === 101).numCamisa, 7);
      assert.deepEqual(writes.at(-1).confirmar_camisa, { jogador_id: 101, camisa_anterior: 7 });
      assert.match(await button('Bia Sub 7').innerText(), /7/);
      if (width > 760) await page.getByRole('button', { name: 'Lista', exact: true }).click();
      await page.locator('.alunos-sub-toggle').first().waitFor();
      assert.equal(await page.locator('.alunos-sub-toggle').count(), 8);
      const group = page.locator('#alunos-sub-5');
      await group.getByRole('button', { name: /SUB-12/ }).click();
      await button('Ana Sub 12').click();
      dialog = page.getByRole('dialog', { name: 'Número da camisa', exact: true });
      await dialog.getByLabel('Número da camisa', { exact: true }).fill('9');
      await dialog.getByRole('button', { name: 'Salvar camisa', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Confirmar troca de camisas', exact: true });
      await dialog.getByText('Sem camisa definida', { exact: true }).waitFor();
      await dialog.getByRole('button', { name: 'Confirmar troca', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      await button('Bia Sub 12').waitFor();
      assert.equal(players.find(row => row.id === 501).numCamisa, null);
      assert.equal(await group.getByRole('button', { name: /SUB-12/ }).getAttribute('aria-expanded'), 'true');
      await button('Bia Sub 12').click();
      dialog = page.getByRole('dialog', { name: 'Número da camisa', exact: true });
      await dialog.getByLabel('Número da camisa', { exact: true }).fill('8');
      failNext = true;
      await dialog.getByRole('button', { name: 'Salvar camisa', exact: true }).click();
      await dialog.getByText('Falha temporária. Tente novamente.').waitFor();
      await dialog.getByRole('button', { name: 'Salvar camisa', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      await button('Bia Sub 12').waitFor();
      assert.match(await button('Bia Sub 12').innerText(), /8/);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      await page.addStyleTag({ content: '.skip-link { display: none!important }' });
      await page.screenshot({ path: `../../test-results/club-workspace/shirts-${width}-${theme}.png`, fullPage: true });
      console.log('PASS shirts', width, theme);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
