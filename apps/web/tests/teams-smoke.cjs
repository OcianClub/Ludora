const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5189';
const output = path.resolve(__dirname, '../../../test-results/club-workspace');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 760, 820, 1366]) {
      for (const theme of ['dark', 'light']) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        await context.addInitScript(theme => {
          localStorage.setItem('ludora_token', 'teams-test');
          localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
          localStorage.setItem('ludora_clube_id', '2');
          localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
          localStorage.setItem('ludora_tema', theme);
        }, theme);
        const page = await context.newPage();
        const errors = [];
        const writes = [];
        let failCrest = false;
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
        await require('./visual-fixture.cjs').install(page);
        const categories = [7, 8, 9, 10, 12, 14, 16, 18].map((n, i) => ({ id: i + 1, nome: `sub-${n}`, tipo: n <= 10 ? 'INICIACAO' : 'BASE' }));
        let rows = categories.flatMap(cat => ['Aurora FC', 'Estrela Azul', 'Ludora FC', 'Ocian', 'Santos', 'União Esportiva'].map((name, i) => {
          const clubId = ({ Ocian: 2, Santos: 3, 'Ludora FC': 4 })[name];
          return { id: cat.id * 10 + i, nome: `${name} ${cat.nome}`, categoria_id: cat.id,
            clube_representado_id: clubId || null, clubeRepresentado: clubId ? { id: clubId, nome: name } : null };
        }));
        await page.route('http://localhost:3000/times**', async route => {
          const request = route.request();
          const pathname = new URL(request.url()).pathname;
          if (pathname === '/times/contexto') return route.fulfill({ json: [
            { key: 'club:2', vitorias: 3, empates: 2, derrotas: 1, golsPro: 9, golsContra: 5, proxima: null, categorias: [
              { categoria_id: 1, vitorias: 3, empates: 2, derrotas: 1, golsPro: 9, golsContra: 5, proxima: null },
            ] },
            { key: 'aurora fc', vitorias: 2, empates: 1, derrotas: 1, golsPro: 6, golsContra: 4, proxima: { data: '2027-10-29', categoria_id: 1 }, categorias: [
              { categoria_id: 1, vitorias: 2, empates: 1, derrotas: 1, golsPro: 6, golsContra: 4, proxima: { data: '2027-10-29', categoria_id: 1 } },
            ] },
          ] });
          if (/\/contexto$/.test(pathname)) return route.fulfill({ json: {
            ultimas: [{ id: 100, data: '2026-10-21', horario: '19:30', categoria: categories[0], mandante: rows.find(r => r.id === 13), visitante: rows.find(r => r.id === 10), gols_mandante: 2, gols_visitante: 1, status: 'FINALIZADA' }],
            proximas: [{ id: 106, data: '2027-10-29', horario: '19:30', categoria: categories[0], mandante: rows.find(r => r.id === 13), visitante: rows.find(r => r.id === 10), status: 'AGENDADA' }],
          } });
          const match = pathname.match(/^\/times\/(\d+)(?:\/(escudo|categorias|impacto|arquivo|nome))?$/);
          if (request.method() !== 'GET') writes.push({ method: request.method(), pathname, data: request.postDataJSON() });
          if (pathname === '/times' && request.method() === 'GET') return route.fulfill({ json: rows });
          if (pathname === '/times' && request.method() === 'POST') {
            const row = { id: 999, ...request.postDataJSON(), clube_representado_id: null };
            rows.push(row);
            return route.fulfill({ status: 201, json: row });
          }
          const row = rows.find(item => item.id === Number(match?.[1]));
          if (!row) return route.fulfill({ status: 404, json: { error: 'Time não encontrado' } });
          if (match[2] === 'impacto') return route.fulfill({ json: { partidas: row.categoria_id === 1 ? 2 : 0, competicoes: 0 } });
          if (match[2] === 'arquivo') {
            const name = row.nome.replace(/\s+sub-\d+$/, '');
            const ids = rows.filter(item => item.nome.replace(/\s+sub-\d+$/, '') === name).map(item => item.id);
            const arquivado = request.postDataJSON().arquivado;
            rows.forEach(item => { if (ids.includes(item.id)) item.arquivado = arquivado; });
            return route.fulfill({ json: { ids, arquivado } });
          }
          if (match[2] === 'nome') {
            const name = row.nome.replace(/\s+sub-\d+$/, '');
            const items = rows.filter(item => item.nome.replace(/\s+sub-\d+$/, '') === name);
            items.forEach(item => { item.nome = request.postDataJSON().nome + ' ' + categories.find(cat => cat.id === item.categoria_id).nome; });
            return route.fulfill({ json: { items, clubeId: row.clube_representado_id, nome: request.postDataJSON().nome } });
          }
          if (match[2] === 'escudo') {
            if (failCrest) { failCrest = false; return route.fulfill({ status: 503, json: { error: 'Servidor indisponível. Tente novamente.' } }); }
            const name = row.nome.replace(/\s+sub-\d+$/, '');
            const ids = rows.filter(item => item.nome.replace(/\s+sub-\d+$/, '') === name).map(item => item.id);
            const escudo = request.postDataJSON().escudo || null;
            rows.forEach(item => { if (ids.includes(item.id)) item.escudo = escudo; });
            return route.fulfill({ json: { ids, escudo } });
          }
          if (match[2] === 'categorias') {
            const cat = categories.find(item => item.id === request.postDataJSON().categoria_id);
            const result = { ...row, id: 1000 + rows.length, nome: row.nome.replace(/\s+sub-\d+$/, '') + ' ' + cat.nome, categoria_id: cat.id };
            rows.push(result);
            return route.fulfill({ status: 201, json: result });
          }
          if (request.method() === 'DELETE') { rows = rows.filter(item => item !== row); return route.fulfill({ json: { mensagem: 'Time excluído' } }); }
          Object.assign(row, request.postDataJSON());
          return route.fulfill({ json: row });
        });
        await page.goto(base + '/times');
        await page.locator('.teams-card').first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator('.teams-card').count(), 6);
        assert.match(await page.locator('.teams-card').first().innerText(), /Ocian/);
        async function fit() {
          const overflow = await page.evaluate(() => [...document.querySelectorAll('.teams-page *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => [el.className, el.getBoundingClientRect().right]));
          await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, { timeout: 2000 });
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow em ${width}/${theme}: ${JSON.stringify(overflow)}`);
          const dialog = page.locator('dialog[open]').last();
          if (await dialog.count()) assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Modal sem corte horizontal');
        }
        await fit();
        if (width <= 760) {
          assert.equal(await page.getByRole('heading', { name: 'Times', exact: true }).isVisible(), false);
          const fab = await page.getByRole('button', { name: 'Adicionar time', exact: true }).boundingBox();
          const nav = await page.locator('.bottom-nav').boundingBox();
          assert.ok(fab.x + fab.width <= width - 12 && fab.y + fab.height <= nav.y - 8, 'FAB acima da navegação');
          const search = await page.locator('.teams-toolbar .collection-search').boundingBox();
          const sort = await page.getByRole('combobox', { name: 'Ordenar times' }).boundingBox();
          assert.ok(sort.width <= 76 && Math.abs(sort.height - search.height) <= 2, `Ordenação compacta e alinhada com a busca: ${JSON.stringify({ sort, search })}`);
        }
        const sort = page.getByRole('combobox', { name: 'Ordenar times' });
        await sort.click();
        await page.getByRole('option', { name: 'Nome Z–A', exact: true }).click();
        await sort.click();
        assert.equal(await page.getByRole('option', { name: 'Nome Z–A', exact: true }).getAttribute('aria-selected'), 'true');
        await page.getByRole('option', { name: 'Nome A–Z', exact: true }).click();
        await page.getByRole('button', { name: /^No Ludora/ }).click();
        assert.equal(await page.locator('.teams-card').count(), 3);
        await page.getByRole('button', { name: /^Fora do Ludora/ }).click();
        assert.equal(await page.locator('.teams-card').count(), 3);
        await page.getByRole('button', { name: /^Todos/ }).click();
        await page.getByRole('searchbox', { name: 'Buscar time' }).fill('Aurora');
        assert.equal(await page.locator('.teams-card').count(), 1);
        await page.getByRole('searchbox', { name: 'Buscar time' }).fill('');
        if (width > 760) {
          await page.getByRole('button', { name: 'Lista', exact: true }).click();
          await page.locator('.teams-grid.is-list').first().waitFor();
        } else {
          assert.equal(await page.getByRole('group', { name: 'Modo de visualização' }).count(), 0);
        }
        await fit();
        await page.screenshot({ path: path.join(output, `teams-list-${width}-${theme}.png`) });
        if (width === 1366 && theme === 'dark') {
          await page.setViewportSize({ width: 390, height: 900 });
          await page.waitForFunction(() => !document.querySelector('.teams-grid.is-list'));
          assert.equal(await page.getByRole('group', { name: 'Modo de visualização' }).count(), 0);
          await page.setViewportSize({ width, height: 900 });
          await page.locator('.teams-grid.is-list').first().waitFor();
        }
        if (width > 760) await page.getByRole('button', { name: 'Cards', exact: true }).click();
        await page.screenshot({ path: path.join(output, `teams-cards-${width}-${theme}.png`) });
        const ownCard = page.locator('.teams-card.is-own');
        await ownCard.locator('.teams-record-stat.is-win strong').filter({ hasText: '3' }).waitFor();
        await ownCard.getByRole('button', { name: 'Ver time Ocian' }).click();
        const ownPanel = page.locator('.teams-drawer');
        await ownPanel.getByRole('heading', { name: /Retrospecto do clube/ }).waitFor();
        assert.match(await ownPanel.locator('.team-insights-stats').innerText(), /3\s*Vitórias/);
        await ownPanel.locator('.team-recent-match').first().waitFor();
        await ownPanel.getByRole('link', { name: 'Organizar partida', exact: true }).click();
        const ownCreation = page.getByRole('dialog', { name: 'Organizar partida', exact: true });
        await ownCreation.waitFor();
        assert.equal(await ownCreation.getByRole('button', { name: 'Selecionar adversário', exact: true }).count(), 1);
        assert.equal(await ownCreation.locator('.schedule-create-error').count(), 0);
        await page.goto(base + '/times');
        await page.locator('.teams-card').first().waitFor();
        await page.getByRole('button', { name: 'Ver time Aurora FC' }).click();
        const drawer = page.locator('.teams-drawer');
        await drawer.waitFor();
        if (width <= 760) {
          const createMatch = await drawer.getByRole('link', { name: 'Nova partida contra Aurora FC' }).boundingBox();
          assert.ok(createMatch.height >= 36 && createMatch.height <= 38, 'Ação compacta no painel mobile');
        }
        await drawer.locator('.team-recent-match').first().waitFor();
        assert.match(await drawer.locator('.team-insights-stats').innerText(), /2\s*Vitórias/);
        assert.equal(await drawer.locator('.teams-category-row').count(), 8);
        assert.deepEqual(await drawer.locator('.teams-category-row > strong').allTextContents(), categories.map(c => c.nome.toUpperCase()));
        assert.ok(await page.evaluate(() => document.body.style.overflow === 'hidden'));
        assert.equal(await drawer.evaluate(el => getComputedStyle(el).backgroundColor), await page.locator('.sidebar').evaluate(el => getComputedStyle(el).backgroundColor));
        await fit();
        if (width <= 600) assert.equal(Math.round((await drawer.boundingBox()).height), 900);
        await page.screenshot({ path: path.join(output, `teams-panel-${width}-${theme}.png`) });
        await drawer.locator('.teams-management > summary').click();
        await drawer.locator('.teams-category-row').first().getByText('···', { exact: true }).click();
        await page.keyboard.press('Escape');
        assert.equal(await drawer.count(), 1, 'Escape fecha primeiro o menu, não o painel');
        await drawer.locator('.teams-category-row').first().getByRole('button', { name: 'Editar', exact: true }).first().click();
        await drawer.getByRole('textbox', { name: 'Nome nesta categoria' }).focus();
        await page.keyboard.press('Escape');
        assert.equal(await drawer.locator('.teams-inline-edit').count(), 0);
        await drawer.locator('.teams-category-row').first().getByText('···', { exact: true }).click();
        await drawer.getByRole('button', { name: 'Excluir', exact: true }).click();
        const deletion = page.getByRole('dialog', { name: 'Excluir SUB-7?', exact: true });
        await deletion.getByText(/2 partidas e 0 competições/).waitFor();
        assert.equal(await deletion.getByRole('button', { name: 'Excluir categoria' }).isDisabled(), true);
        await page.keyboard.press('Escape');
        await drawer.getByRole('button', { name: 'Fechar janela' }).click();
        assert.equal(await page.getByRole('button', { name: 'Ver time Aurora FC' }).evaluate(el => el === document.activeElement), true);
        await page.getByRole('button', { name: 'Alterar escudo de Aurora FC' }).click();
        const crest = page.getByRole('dialog', { name: 'Escudo do time' });
        await crest.getByRole('textbox', { name: 'URL do escudo' }).fill('javascript:alert(1)');
        await crest.getByRole('button', { name: 'Salvar escudo' }).click();
        assert.equal(writes.length, 0);
        await crest.getByRole('textbox', { name: 'URL do escudo' }).fill('https://example.test/escudo.png');
        failCrest = true;
        await crest.getByRole('button', { name: 'Salvar escudo' }).click();
        await crest.getByRole('alert').waitFor();
        await crest.getByRole('button', { name: 'Salvar escudo' }).click();
        await crest.waitFor({ state: 'detached' });
        assert.equal(rows.filter(row => row.escudo).length, 8);
        await page.getByRole('button', { name: 'Adicionar time', exact: true }).click();
        const creation = page.getByRole('dialog', { name: 'Adicionar time', exact: true });
        await creation.getByRole('textbox', { name: 'Nome do time' }).fill('Monte Azul');
        await creation.getByRole('combobox', { name: 'Primeira categoria' }).click();
        await creation.getByRole('option', { name: 'SUB-7', exact: true }).click();
        await creation.getByRole('button', { name: 'Adicionar time', exact: true }).click();
        await creation.waitFor({ state: 'detached' });
        await page.getByRole('button', { name: 'Ver time Monte Azul' }).click();
        await drawer.locator('.teams-management > summary').click();
        await drawer.getByRole('button', { name: 'Adicionar categoria', exact: true }).click();
        await drawer.getByRole('combobox', { name: 'Adicionar categoria', exact: true }).click();
        assert.equal(await drawer.getByRole('option', { name: 'SUB-7', exact: true }).count(), 0);
        await drawer.getByRole('option', { name: 'SUB-8', exact: true }).click();
        await drawer.getByRole('button', { name: 'Adicionar', exact: true }).click();
        await drawer.locator('.teams-category-row').nth(1).waitFor();
        await drawer.locator('.teams-category-row').nth(1).getByText('···', { exact: true }).click();
        await drawer.getByRole('button', { name: 'Excluir', exact: true }).click();
        const freeDeletion = page.getByRole('dialog', { name: 'Excluir SUB-8?', exact: true });
        await freeDeletion.getByText(/0 partidas e 0 competições/).waitFor();
        await freeDeletion.getByRole('button', { name: 'Excluir categoria' }).click();
        await freeDeletion.waitFor({ state: 'detached' });
        assert.equal(await drawer.locator('.teams-category-row').count(), 1);
        await drawer.locator('.teams-header-menu > summary').click();
        await drawer.getByRole('button', { name: 'Editar nome', exact: true }).click();
        const rename = page.getByRole('dialog', { name: 'Editar nome do time', exact: true });
        await rename.getByRole('textbox', { name: 'Nome do time' }).fill('Monte Verde');
        await rename.getByRole('button', { name: 'Salvar nome' }).click();
        await rename.waitFor({ state: 'detached' });
        assert.equal(await drawer.locator('.teams-header-menu > summary').evaluate(el => el === document.activeElement), true);
        assert.equal(rows.filter(row => row.nome.startsWith('Monte Verde')).length, 1);
        await drawer.locator('.teams-header-menu > summary').click();
        await drawer.getByRole('button', { name: 'Arquivar time', exact: true }).click();
        const archive = page.getByRole('dialog', { name: 'Arquivar Monte Verde?', exact: true });
        await archive.getByRole('button', { name: 'Arquivar time', exact: true }).click();
        await archive.waitFor({ state: 'detached' });
        assert.equal(await page.locator('.teams-card').count(), 6);
        await page.getByRole('button', { name: /^Arquivados/ }).click();
        assert.equal(await page.locator('.teams-card').count(), 1);
        await page.getByRole('button', { name: 'Ver time Monte Verde' }).click();
        await drawer.locator('.teams-header-menu > summary').click();
        await drawer.getByRole('button', { name: 'Restaurar time', exact: true }).click();
        await drawer.waitFor({ state: 'detached' });
        await page.getByRole('button', { name: /^Todos/ }).click();
        await page.getByRole('button', { name: 'Ver time Aurora FC' }).click();
        await drawer.getByRole('button', { name: 'Fechar janela' }).click();
        assert.equal(await page.getByRole('button', { name: 'Filtros', exact: true }).count(), 0);
        await page.getByRole('tab', { name: 'Base', exact: true }).click();
        await page.getByRole('tab', { name: 'SUB-18', exact: true }).click();
        assert.equal(await page.locator('.teams-card').count(), 6);
        await fit();
        await page.getByRole('tab', { name: 'Iniciação', exact: true }).click();
        await page.getByRole('tab', { name: 'SUB-7', exact: true }).click();
        const aurora = page.locator('.teams-card').filter({ has: page.getByRole('heading', { name: 'Aurora FC', exact: true }) });
        await aurora.getByRole('button', { name: 'Mostrar todas as categorias de Aurora FC' }).click();
        assert.equal(await aurora.locator('.teams-preview > span').count(), 8);
        await aurora.getByRole('button', { name: 'Recolher categorias de Aurora FC' }).click();
        assert.equal(await aurora.locator('.teams-preview > span').count(), 3);
        const newMatch = await aurora.locator('.teams-quick-match').boundingBox();
        const viewTeam = await aurora.locator('.teams-open').boundingBox();
        assert.ok(newMatch.x < viewTeam.x && newMatch.width > viewTeam.width, 'Nova partida à esquerda e mais larga');
        await page.getByRole('button', { name: 'Ver time Aurora FC' }).click();
        await drawer.getByRole('link', { name: 'Nova partida contra Aurora FC' }).click();
        const organize = page.getByRole('dialog', { name: 'Organizar partida', exact: true });
        await organize.waitFor();
        assert.equal(await organize.getByRole('button', { name: 'Selecionar adversário: Aurora FC' }).count(), 1);
        assert.match(await organize.locator('.schedule-create-sub').innerText(), /sub-7/);
        assert.deepEqual(errors, []);
        console.log(`Times OK: ${width}px ${theme}`);
        await context.close();
      }
    }

    for (const role of ['TORCEDOR', 'TECNICO']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 740 }, reducedMotion: 'reduce' });
      await context.addInitScript(role => {
        localStorage.setItem('ludora_token', 'teams-role-test');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
        localStorage.setItem('ludora_clube_id', '2');
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: role }));
        localStorage.setItem('ludora_tema', 'dark');
      }, role);
      const page = await context.newPage();
      await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
      await require('./visual-fixture.cjs').install(page, { role });
      await page.route('http://localhost:3000/times/contexto', route => route.fulfill({ status: 503, json: { error: 'Falha simulada no retrospecto' } }));
      await page.route(/http:\/\/localhost:3000\/times\/\d+\/contexto/, route => route.fulfill({ json: { ultimas: [], proximas: [] } }));
      await page.goto(base + '/times');
      await page.locator('.teams-card-context').filter({ hasText: 'Retrospecto indisponível' }).first().waitFor();
      assert.equal(await page.locator('.teams-summary-error').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Recarregar retrospecto', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Alterar escudo de Ocian' }).count(), 0, 'Só ADMIN edita escudo oficial');
      if (role === 'TORCEDOR') {
        assert.equal(await page.getByRole('button', { name: 'Adicionar time', exact: true }).count(), 0);
        assert.equal(await page.locator('.teams-quick-match').count(), 0);
        assert.equal(await page.getByRole('button', { name: /^Arquivados/ }).count(), 0);
      }
      await page.getByRole('button', { name: 'Ver time Santos' }).click();
      const drawer = page.locator('.teams-drawer');
      await drawer.locator('.team-insights-empty').first().waitFor();
      assert.equal(await drawer.locator('.teams-membership.is-club').innerText(), 'No Ludora');
      if (role === 'TORCEDOR') assert.equal(await drawer.locator('.teams-header-menu').count(), 0);
      if (role === 'TECNICO') {
        await drawer.locator('.teams-header-menu > summary').click();
        assert.equal(await drawer.getByRole('button', { name: 'Editar nome', exact: true }).count(), 0);
        assert.equal(await drawer.getByRole('button', { name: 'Alterar escudo', exact: true }).count(), 0);
      }
      console.log(`Times permissões/erro OK: ${role}`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
