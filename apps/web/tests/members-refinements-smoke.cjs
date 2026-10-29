const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5189';
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 820, 1366]) for (const theme of ['dark', 'light']) {
      const context = await browser.newContext({ viewport: { width, height: 844 } });
      await context.addInitScript(theme => {
        localStorage.setItem('ludora_token', 'members-test');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Meu usuário' }));
        localStorage.setItem('ludora_clube_id', '2');
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
        localStorage.setItem('ludora_tema', theme);
      }, theme);
      const p = await context.newPage();
      await p.route('**/*', r => new URL(r.request().url()).origin === base ? r.continue() : r.abort());
      await require('./visual-fixture.cjs').install(p);
      await p.route('http://localhost:3000/membros', r => r.fulfill({ json: [
        { id: 3, papel: 'TECNICO', usuario: { id: 3, nome: 'Zeca' }, acesso_todas_categorias: false, categorias: [{ categoria_id: 1 }] },
        { id: 2, papel: 'OLHEIRO', usuario: { id: 2, nome: 'Ana' }, acesso_todas_categorias: false, categorias: [] },
        { id: 1, papel: 'ADMIN', usuario: { id: 1, nome: 'Meu usuário' }, acesso_todas_categorias: true, categorias: [] }
      ] }));
      let canceled = false;
      await p.route('http://localhost:3000/convites**', r => {
        if (r.request().method() === 'POST') { canceled = true; return r.fulfill({ json: { mensagem: 'Cancelado' } }); }
        return r.fulfill({ json: { convites: [{ id: 'test-invite', email: 'pessoa@example.test', papel: 'TECNICO', situacao: canceled ? 'REVOGADO' : 'PENDENTE', expira_em: '2030-10-20T12:00:00Z', categorias: [] }] } });
      });
      await p.goto(base + '/membros');
      await p.locator('.members-person').first().waitFor();
      assert.match(await p.locator('.members-person').first().innerText(), /Meu usuário/);
      assert.equal(await p.locator('.member-avatar').count(), 0);
      assert.equal(await p.locator('.members-row-self .members-initials').innerText(), 'MU');
      assert.equal(await p.locator('.members-initials').first().evaluate(el => getComputedStyle(el).borderRadius), '50%');
      assert.equal(await p.locator('.members-access-subs').getByText('SUB-7', { exact: true }).count(), 1);
      if (width <= 760) {
        assert.equal(await p.locator('.members-desktop-filters').isVisible(), false);
        const search = await p.getByRole('searchbox', { name: 'Buscar pessoa' }).boundingBox();
        const filterButton = p.getByRole('button', { name: 'Mais filtros', exact: true });
        const filterBounds = await filterButton.boundingBox();
        assert.ok(Math.abs(search.height - filterBounds.height) <= 2);
        await filterButton.click();
        let filters = p.getByRole('dialog', { name: 'Filtrar pessoas' });
        await filters.getByRole('button', { name: 'Técnico', exact: true }).click();
        await filters.getByRole('button', { name: 'Aplicar filtros' }).click();
        assert.equal(await p.locator('.members-person').count(), 1);
        assert.match(await p.locator('.members-person').innerText(), /Zeca/);
        await filterButton.click();
        filters = p.getByRole('dialog', { name: 'Filtrar pessoas' });
        await filters.getByRole('button', { name: 'Limpar filtros' }).click();
        await filters.getByRole('button', { name: 'Aplicar filtros' }).click();
        assert.equal(await p.locator('.members-person').count(), 3);
      } else {
        assert.equal(await p.getByRole('button', { name: 'Mais filtros', exact: true }).isVisible(), false);
        assert.ok(await p.getByRole('button', { name: /Cargo Todos os cargos/ }).isVisible());
        assert.ok(await p.getByRole('button', { name: /Categoria Todas as categorias/ }).isVisible());
      }
      assert.ok(await p.locator('td[data-label="Cargo"]').evaluateAll(cells => cells.every(cell => cell.querySelector('.members-role').getBoundingClientRect().right <= cell.getBoundingClientRect().right)));
      if (width > 760) {
        for (const name of ['Pessoa', 'Cargo', 'Acesso']) {
          for (const direction of ['crescente', 'decrescente', 'padrão']) {
            await p.getByRole('button', { name: `${name}: ordenar em ordem ${direction}`, exact: true }).click();
            assert.match(await p.locator('.members-person').first().innerText(), /Meu usuário/);
          }
        }
        assert.match(await p.locator('.members-person').nth(1).innerText(), /Zeca/);
      }
      await p.getByRole('searchbox', { name: 'Buscar pessoa' }).focus();
      assert.equal(await p.getByRole('searchbox').evaluate(el => getComputedStyle(el).outlineStyle), 'none');
      assert.equal(await p.locator('.collection-search').evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
      await p.getByRole('button', { name: 'Gerenciar', exact: false }).first().click();
      const access = p.getByRole('dialog', { name: /Acesso de/ });
      await access.getByRole('button', { name: /Cargo no clube/ }).click();
      const options = access.locator('.choice-options');
      assert.equal(await options.evaluate(el => getComputedStyle(el).position), 'static');
      await options.getByRole('button', { name: 'Visitante', exact: true }).focus();
      await access.getByRole('button', { name: 'Fechar janela' }).click();
      await p.getByRole('button', { name: /Convites/ }).click();
      const dateLines = await p.locator('td[data-label="Validade"]').evaluate(cell => { const range = document.createRange(); range.selectNodeContents(cell); return range.getClientRects().length; });
      assert.equal(dateLines, 1);
      await p.getByRole('button', { name: 'Cancelar convite', exact: true }).click();
      const cancel = p.getByRole('dialog', { name: 'Cancelar convite?' });
      await cancel.getByRole('button', { name: 'Cancelar convite', exact: true }).click();
      await p.locator('.members-notice').filter({ hasText: 'Convite cancelado.' }).waitFor();
      assert.ok(canceled);
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const output = path.resolve('../../test-results/members-refinements'); fs.mkdirSync(output, { recursive: true });
      await p.screenshot({ path: path.join(output, `${width}-${theme}.png`), fullPage: true });
      await context.close();
      console.log(`${width}px ${theme}: ordem, foco, cargos e cancelamento OK`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
