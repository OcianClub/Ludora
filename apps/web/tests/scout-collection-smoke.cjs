const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5192';
const output = path.resolve(__dirname, '../../../test-results/scout-collection');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 760, 820, 1024, 1440, 1920]) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
      try {
        await context.addInitScript(() => {
          localStorage.setItem('ludora_token', 'visual-test-only');
          localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Gestor de teste' }));
          localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
          localStorage.setItem('ludora_clube_id', '2'); localStorage.setItem('ludora_tema', 'dark');
        });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
        await require('./visual-fixture.cjs').install(page);
        const players = Array.from({ length: 30 }, (_, i) => ({
          id: i + 1, nome: ['João Vítor', 'Ethan Brooks', 'Associação Esportiva Atleta de nome extremamente longo para testar reticências'][i % 3] + (i > 2 ? ` ${i}` : ''),
          posicao: ['Alas', 'Fixo', 'Goleiro', 'Pivô'][i % 4], idade: i === 3 ? null : 7 + i % 2,
          numCamisa: i % 3 ? i + 1 : null, categoria_id: 1, perfil_ml: i % 4 === 3 ? 'Sem dados' : ['Armador', 'Artilheiro', 'Paredão'][i % 3],
          nota_geral: 0, jogos_disputados: 5 + i % 5, gols: i < 2 ? 6 : 0, assistencias: i % 4,
          defesas: i % 4 === 2 ? 8 : 0, analise_scout: { versao: 2 },
        }));
        players.push({ ...players[0], id: 101, nome: 'Atleta da Base', categoria_id: 5 });
        let profileCalls = 0, historyCalls = 0;
        await page.route('**/jogadores/perfis*', route => { profileCalls++; return route.fulfill({ json: players }); });
        await page.route('**/jogadores/*/scout-contexto*', route => { historyCalls++; return route.fulfill({ status: 503, json: { error: 'Teste de indisponibilidade' } }); });
        await page.goto(base + '/elenco');
        await page.getByRole('button', { name: /^Ver ficha de/ }).first().waitFor();
        assert.equal(historyCalls, 0, 'ficha não é consultada para montar a coleção');
        assert.equal(await page.locator('.scout-leaders > button').count(), 3);
        assert.equal(await page.locator('.scout-profile-filters').count(), 0);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (width > 760) {
          const table = page.getByRole('table', { name: /Atletas de SUB-7/ });
          await table.waitFor(); assert.equal(await table.locator('thead th').count(), 9);
          assert.equal(await table.locator('tbody tr').count(), 20);
          assert.equal(await table.getByRole('columnheader', { name: 'Convocações', exact: true }).getAttribute('aria-sort'), 'none');
          for (const label of ['Camisa', 'Nome', 'Posição', 'Idade', 'Convocações', 'Gols', 'Assist', 'Defesas', 'Perfil']) {
            const header = table.getByRole('columnheader', { name: label, exact: true });
            const button = header.getByRole('button');
            await button.focus(); await page.keyboard.press('Enter');
            const first = await header.getAttribute('aria-sort');
            await button.click(); assert.notEqual(await header.getAttribute('aria-sort'), first);
            await button.click(); assert.equal(new URL(page.url()).searchParams.has('ordem'), false);
          }
          const toggle = page.getByRole('group', { name: 'Visualização do elenco' });
          await toggle.getByRole('button', { name: 'Cards', exact: true }).click();
          assert.equal(await page.locator('.scout-player').count(), 20);
          await toggle.getByRole('button', { name: 'Tabela', exact: true }).click();
          if (width === 1024 || width === 1440) {
            const expand = page.getByRole('button', { name: /(?:Recolher|Expandir) navegação/ });
            if (await expand.count()) {
              await expand.click();
              assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            }
          }
        } else {
          assert.equal(await page.getByRole('group', { name: 'Visualização do elenco' }).count(), 0);
          assert.equal(await page.locator('.scout-mobile-player').count(), 20);
          assert.equal(await page.locator('.scout-leader-icon:visible').count(), 3);
          assert.ok(!(await page.locator('.scout-mobile-shirt').allTextContents()).some(text => text.includes('#')));
          const chips = page.getByRole('group', { name: 'Ordenar atletas' });
          await chips.getByRole('button', { name: 'Gols', exact: true }).click();
          assert.match(await chips.getByRole('button', { name: /Gols,/ }).getAttribute('aria-label'), /decrescente/);
          const boxes = await page.locator('.scout-mobile-player').evaluateAll(rows => rows.map(row => row.getBoundingClientRect().height));
          assert.ok(Math.max(...boxes) <= 70, 'nomes longos não aumentam a altura dos cards');
        }
        await page.getByRole('button', { name: /Carregar mais atletas/ }).click();
        assert.equal(await page.getByRole('button', { name: /^Ver ficha de/ }).count(), 30);
        await page.getByRole('searchbox', { name: 'Buscar atleta' }).fill('joao');
        assert.equal(await page.getByRole('button', { name: /^Ver ficha de/ }).count(), 10);
        await page.getByRole('searchbox', { name: 'Buscar atleta' }).fill('atleta inexistente');
        assert.equal(await page.locator('.scout-empty').getByText('Nenhum atleta corresponde aos filtros.').count(), 1);
        await page.getByRole('searchbox', { name: 'Buscar atleta' }).fill('');
        await page.getByRole('button', { name: 'Mais filtros', exact: true }).click();
        const filters = page.getByRole('dialog', { name: 'Filtrar elenco' });
        await filters.getByRole('group', { name: 'Posição', exact: true }).getByRole('button', { name: 'Fixo', exact: true }).click();
        await filters.getByRole('group', { name: 'Perfil de registros', exact: true }).getByRole('button', { name: 'Artilheiro', exact: true }).click();
        await filters.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
        assert.ok(await page.getByRole('button', { name: /^Ver ficha de/ }).count() > 0);
        assert.equal(new URL(page.url()).searchParams.get('posicao'), 'Fixo');
        await page.getByRole('button', { name: 'Limpar tudo', exact: true }).click();
        await page.getByRole('button', { name: /^Mais gols:.*empatados/ }).click();
        const tie = page.getByRole('dialog', { name: 'Mais gols · atletas empatados' });
        assert.equal(await tie.locator('.scout-tied-list > button').count(), 2);
        await tie.getByRole('button', { name: 'Ethan Brooks', exact: true }).click();
        const detail = page.getByRole('dialog', { name: 'Ficha do atleta' });
        await detail.getByRole('button', { name: 'Tentar novamente', exact: true }).waitFor();
        assert.equal(historyCalls, 1);
        await detail.getByRole('button', { name: 'Fechar janela', exact: true }).click();
        assert.equal(profileCalls, 1, 'filtros e ordenação não repetem a consulta ao servidor');
        for (const theme of ['dark', 'light']) {
          await page.evaluate(value => { localStorage.setItem('ludora_tema', value); window.dispatchEvent(new Event('ludora:theme-change')); scrollTo(0, 0); }, theme);
          await page.mouse.move(0, 0);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          if ([390, 820, 1440].includes(width)) await page.screenshot({ path: path.join(output, `scout-${width}-${theme}.png`), fullPage: true });
        }
        if (width === 1440) {
          await page.getByRole('group', { name: 'Visualização do elenco' }).getByRole('button', { name: 'Cards', exact: true }).click();
          await page.screenshot({ path: path.join(output, 'scout-1440-cards.png'), fullPage: true });
        }
        assert.deepEqual(errors, []);
        console.log(`OK Scout ${width}px: tabela/cards, ordenação, filtros, empatados, ficha e consultas preservadas`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
