const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';
const output = path.resolve(__dirname, '../../../test-results/web-schedule');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  try {
    for (const width of [320, 390, 820, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
      try {
        await context.addInitScript(() => {
          if (sessionStorage.getItem('schedule-fixture')) return;
          sessionStorage.setItem('schedule-fixture', 'true');
          localStorage.setItem('ludora_token', 'visual-test-only');
          localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex', email: 'visual@example.test' }));
          localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
          localStorage.setItem('ludora_clube_id', '2');
          localStorage.setItem('ludora_tema', 'dark');
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
        await require('./visual-fixture.cjs').install(page);
        const date = new Date();
        const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const tomorrow = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
        const nextDay = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
        let matches = Array.from({ length: 57 }, (_, index) => ({
          id: index + 1,
          categoria_id: index === 56 ? 5 : index % 2 + 1,
          categoria: { id: index === 56 ? 5 : index % 2 + 1, nome: index === 56 ? 'sub-12' : index % 2 ? 'sub-8' : 'sub-7', tipo: index === 56 ? 'BASE' : 'INICIACAO', clube_id: 2 },
          mandante_id: 13, visitante_id: 14,
          mandante: { id: 13, nome: 'Ocian sub-7' },
          visitante: { id: 14, nome: index % 2 ? 'União Esportiva sub-7' : 'Santos sub-7' },
          gols_mandante: 2, gols_visitante: 1,
          data: `${index === 56 ? nextDay : index >= 34 ? '2025-10-20' : index >= 29 ? nextDay : today}T12:00:00Z`,
          horario: '19:30', local: index % 2 ? 'Ginásio Central' : 'Quadra principal', emCasa: index % 2 === 0,
          status: index < 24 ? 'AO_VIVO' : index < 29 ? 'PREPARADA' : index < 34 ? 'AGENDADA' : index < 54 ? 'FINALIZADA' : index === 56 ? 'AGENDADA' : 'CANCELADA',
          somente_leitura: index === 1,
        }));
        await page.route('**/partidas?*', route => route.request().isNavigationRequest() ? route.fallback() : route.fulfill({ contentType: 'application/json', body: JSON.stringify(matches) }));
        await page.goto(base + '/partidas');
        const mobile = width <= 760;
        async function chooseFilter(label, option) {
          if (!mobile) {
            if (label === 'Categoria') {
              const [phase, sub] = option.split(' · ');
              await page.getByRole('group', { name: 'Categoria das partidas' }).getByRole('button', { name: phase.toUpperCase(), exact: true }).click();
              if (sub.startsWith('todos')) return;
              await page.getByRole('combobox', { name: 'Subcategoria', exact: true }).click();
              await page.getByRole('option', { name: sub.replace(/^sub-/i, 'Sub-'), exact: true }).click();
              return;
            }
            await page.getByRole('combobox', { name: label, exact: true }).filter({ visible: true }).click();
            await page.getByRole('option', { name: option, exact: true }).click();
            return;
          }
          await page.getByRole('button', { name: /^Filtros/ }).click();
          const dialog = page.getByRole('dialog', { name: 'Filtrar partidas', exact: true });
          const close = dialog.getByRole('button', { name: 'Fechar janela', exact: true });
          await close.focus();
          await close.press('Shift+Tab');
          assert.equal(await dialog.getByRole('button', { name: 'Aplicar filtros' }).evaluate(el => el === document.activeElement), true, 'Foco permanece no modal');
          await page.keyboard.press('Tab');
          assert.equal(await close.evaluate(el => el === document.activeElement), true);
          if (label === 'Categoria') {
            const [phase, sub] = option.split(' · ');
            await dialog.getByRole('group', { name: 'Categoria' }).getByRole('button', { name: phase.toUpperCase(), exact: true }).click();
            if (sub && !sub.startsWith('todos')) await dialog.getByRole('group', { name: 'Sub' }).getByRole('button', { name: sub.replace(/^sub-/i, 'Sub-'), exact: true }).click();
          } else {
            await dialog.getByRole('group', { name: label }).getByRole('button', { name: option, exact: true }).click();
          }
          await dialog.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
        }
        const carousel = page.getByRole('region', { name: 'Carrossel de partidas ao vivo' });
        await carousel.waitFor();
        const toolbarYWithoutFilters = (await page.locator('.schedule-results-toolbar').boundingBox()).y;
        assert.equal(await page.getByRole('combobox', { name: 'Local', exact: true }).count(), 0);
        assert.equal(await page.locator('.schedule-section').filter({ has: page.getByRole('button', { name: /^Hoje/ }) }).locator('.match-card').count(), 5);
        assert.equal(await page.locator('.schedule-section').filter({ has: page.getByRole('button', { name: /^A seguir/ }) }).locator('.match-card').count(), 5);
        if (mobile) {
          const unchangedUrl = page.url();
          await page.getByRole('button', { name: /^Filtros/ }).click();
          const dialog = page.getByRole('dialog', { name: 'Filtrar partidas', exact: true });
          await dialog.getByRole('searchbox').fill('rascunho');
          await dialog.getByRole('button', { name: 'Fechar janela', exact: true }).click();
          assert.equal(page.url(), unchangedUrl, 'Cancelar não aplica rascunhos');
          await page.getByRole('button', { name: /^Filtros/ }).click();
          assert.equal(await dialog.getByRole('searchbox').inputValue(), '');
          await page.screenshot({ path: path.join(output, `schedule-filters-${width}.png`) });
          await page.setViewportSize({ width, height: 520 });
          await dialog.getByRole('searchbox').fill('');
          await dialog.getByRole('group', { name: 'Ordenar', exact: true }).getByRole('button', { name: 'Por horário' }).scrollIntoViewIfNeeded();
          const applyBox = await dialog.getByRole('button', { name: 'Aplicar filtros', exact: true }).boundingBox();
          assert.ok(applyBox.y >= 0 && applyBox.y + applyBox.height <= 520, 'Ações continuam acessíveis com altura reduzida');
          await page.screenshot({ path: path.join(output, `schedule-filters-short-${width}.png`) });
          await page.setViewportSize({ width, height: 950 });
          await dialog.getByRole('button', { name: 'Fechar janela', exact: true }).click();
        }
        assert.equal(await carousel.locator('.match-card').count(), 24);
        assert.equal(await carousel.locator('.status-ao-vivo').count(), 0);
        assert.equal(await carousel.getByRole('img', { name: 'Partida ao vivo' }).count(), 24);
        assert.equal(await page.getByRole('button', { name: /Carregar mais jogos ao vivo/ }).count(), 0);
        await page.getByRole('button', { name: 'Próximas partidas ao vivo', exact: true }).click();
        assert.ok(await carousel.evaluate(el => el.scrollLeft > 0));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.equal(await page.getByRole('button', { name: /Excluir partida/ }).count(), 0);
        const legend = page.getByRole('group', { name: 'Filtrar por situação', exact: true });
        if (mobile) {
          assert.equal(await legend.isVisible(), false);
          assert.equal(await page.getByRole('searchbox').filter({ visible: true }).count(), 0);
          const top = await page.locator('.schedule-live-section').boundingBox();
          assert.ok(top.y < 420, 'Partidas aparecem sem uma tela inteira de filtros');
          await chooseFilter('Situação', 'Finalizadas');
        } else await legend.getByRole('button', { name: /Finalizadas/ }).click();
        assert.ok(Math.abs((await page.locator('.schedule-results-toolbar').boundingBox()).y - toolbarYWithoutFilters) < 1, 'Filtros ativos não deslocam o conteúdo');
        assert.equal(await carousel.count(), 0);
        assert.equal(await page.locator('.match-card').count(), 12);
        await page.getByRole('button', { name: 'Limpar tudo', exact: true }).click();
        assert.ok(await page.locator('.schedule-section-toggle').count() <= 5);
        assert.equal(await carousel.evaluate(el => getComputedStyle(el).scrollSnapType), 'none');
        await chooseFilter('Categoria', 'Iniciação · sub-7');
        assert.ok((await page.locator('.match-card-header > span:first-child').allTextContents()).every(text => text === 'sub-7'));
        await chooseFilter('Categoria', 'Base · todos os subs');
        assert.equal(await carousel.count(), 0);
        assert.equal(await page.locator('.match-card').count(), 1);
        assert.ok(await page.getByRole('button', { name: 'Remover filtro Base', exact: true }).count());
        if (!mobile) {
          await page.getByRole('combobox', { name: 'Subcategoria' }).click();
          const subOptions = await page.getByRole('option').allTextContents();
          assert.deepEqual(subOptions.map(label => label.replace('✓', '')), ['Todos os subs', 'Sub-12', 'Sub-14', 'Sub-16', 'Sub-18']);
          await page.getByRole('combobox', { name: 'Subcategoria' }).press('Escape');
        }
        await chooseFilter('Categoria', 'Iniciação · todos os subs');
        await page.getByRole('button', { name: mobile ? /^Filtros/ : /Mais filtros/ }).click();
        const more = page.getByRole('dialog', { name: mobile ? 'Filtrar partidas' : 'Mais filtros', exact: true });
        if (mobile) await more.getByRole('group', { name: 'Situação' }).getByRole('button', { name: 'Preparadas', exact: true }).click();
        else {
          await more.getByRole('combobox', { name: 'Situação' }).click();
          const menu = more.getByRole('listbox');
          assert.equal(await menu.evaluate(el => getComputedStyle(el).position), 'static');
          await more.getByRole('option', { name: 'Cancelada', exact: true }).scrollIntoViewIfNeeded();
          const menuBox = await menu.boundingBox();
          const modalBox = await more.boundingBox();
          assert.ok(menuBox.y >= modalBox.y && menuBox.y + menuBox.height <= modalBox.y + modalBox.height, 'Menu cabe no modal');
          await page.screenshot({ path: path.join(output, `schedule-more-${width}.png`) });
          await more.getByRole('option', { name: 'Preparada', exact: true }).click();
        }
        await more.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
        assert.ok((await page.locator('.match-card .status-badge').allTextContents()).every(text => text === 'Preparada'));
        assert.equal(await page.locator('.match-card').count(), 5);
        await page.getByRole('button', { name: 'Limpar tudo', exact: true }).click();

        await chooseFilter('Período', 'Hoje');
        assert.ok(await carousel.count());
        assert.equal(await page.getByRole('button', { name: /^Finalizadas.*Recolher/ }).count(), 0);
        if (mobile) {
          await page.getByRole('button', { name: /^Filtros/ }).click();
          await page.getByRole('dialog', { name: 'Filtrar partidas' }).getByRole('group', { name: 'Período' }).getByRole('button', { name: 'Intervalo' }).click();
        } else {
          await page.getByRole('combobox', { name: 'Período', exact: true }).click();
          await page.getByRole('option', { name: 'Personalizado…', exact: true }).click();
        }
        const periodDialog = page.getByRole('dialog', { name: mobile ? 'Filtrar partidas' : 'Escolher período', exact: true });
        await periodDialog.getByRole('textbox', { name: 'De', exact: true }).fill('2025-10-01');
        await periodDialog.getByRole('textbox', { name: 'Até', exact: true }).fill('2025-10-31');
        await periodDialog.getByRole('button', { name: mobile ? 'Aplicar filtros' : 'Aplicar período', exact: true }).click();
        assert.equal(await carousel.count(), 0);
        assert.ok(await page.locator('.schedule-history-day').count());
        if (mobile) await page.getByRole('button', { name: /^Filtros/ }).click();
        await page.getByRole('searchbox', { name: 'Buscar time, adversário ou local' }).filter({ visible: true }).fill('uniao');
        if (mobile) await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
        assert.ok(await page.locator('.match-card').count());
        await page.getByRole('button', { name: 'Limpar tudo', exact: true }).click();
        const liveWidth = (await carousel.locator('.match-card').first().boundingBox()).width;
        await page.getByRole('group', { name: 'Visualização das partidas' }).getByRole('button', { name: 'Lista', exact: true }).click();
        assert.ok(await page.locator('.schedule-list').count());
        assert.equal(await carousel.evaluate(el => el.classList.contains('schedule-list')), false);
        assert.equal((await carousel.locator('.match-card').first().boundingBox()).width, liveWidth);
        await chooseFilter(mobile ? 'Ordenar' : 'Ordenar por', 'Por categoria');
        assert.equal(new URL(page.url()).searchParams.get('ordem'), 'categoria');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.getByRole('group', { name: 'Visualização das partidas' }).getByRole('button', { name: 'Cards', exact: true }).click();
        if (mobile) {
          const accordion = page.getByRole('button', { name: /^Hoje/ });
          await accordion.focus();
          await accordion.press('Enter');
          assert.equal(await accordion.getAttribute('aria-expanded'), 'false');
          await accordion.press('Space');
          assert.equal(await accordion.getAttribute('aria-expanded'), 'true');
          assert.ok(await accordion.evaluate(el => parseFloat(getComputedStyle(el.querySelector('.schedule-section-title')).fontSize) <= 14));
          assert.ok((await accordion.boundingBox()).height >= 44, 'Título menor preserva área de toque');
        }
        for (const theme of ['dark', 'light']) {
          await page.evaluate(value => { localStorage.setItem('ludora_tema', value); window.dispatchEvent(new Event('ludora:theme-change')); scrollTo(0, 0); }, theme);
          await page.screenshot({ path: path.join(output, `schedule-prototype-${width}-${theme}.png`), animations: 'disabled' });
        }
        if (mobile) {
          matches[0] = {
            ...matches[0], gols_mandante: 12, gols_visitante: 11,
            mandante: { id: 13, nome: 'Associação Esportiva de Desenvolvimento da Cidade sub-7' },
            visitante: { id: 14, nome: 'Clube Internacional de Formação de Atletas sub-7' },
            local: 'Centro Poliesportivo Municipal · Quadra principal · Entrada pela Avenida dos Esportes',
          };
          await page.reload();
          await carousel.waitFor();
          await page.evaluate(() => document.documentElement.style.fontSize = '20px');
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Texto ampliado e nomes longos não causam rolagem lateral');
          const card = carousel.locator('.match-card').first();
          const bounds = await card.boundingBox();
          assert.ok(bounds.height < 400, 'Nomes longos não transformam o card em um bloco excessivamente alto');
          const teamBounds = await card.locator('.match-teams').boundingBox();
          assert.ok(teamBounds.x >= bounds.x && teamBounds.x + teamBounds.width <= bounds.x + bounds.width);
          const crests = await card.locator('.club-badge').all();
          assert.ok(Math.abs((await crests[0].boundingBox()).y - (await crests[1].boundingBox()).y) < 1, 'Escudos alinhados com nomes de tamanhos diferentes');
          await card.locator('a').scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(output, `schedule-long-text-${width}.png`) });
          await page.evaluate(() => document.documentElement.style.fontSize = '');
        }
        const beforeUrl = page.url();
        await carousel.locator('a[href="/partidas/1"]').scrollIntoViewIfNeeded();
        assert.ok((await carousel.locator('.match-card').first().boundingBox()).width > 200, 'Cards mantêm largura após trocar a visualização');
        await carousel.locator('a[href="/partidas/1"]').click();
        await page.getByRole('button', { name: 'Excluir partida', exact: true }).waitFor();
        await page.goBack();
        await carousel.waitFor();
        assert.equal(page.url(), beforeUrl, 'Filtros e ordenação preservados ao voltar');
        await carousel.locator('a[href="/partidas/1"]').click();
        await page.getByRole('button', { name: 'Excluir partida', exact: true }).waitFor();
        let failDelete = true;
        await page.route('**/partidas/1', async route => {
          assert.equal(route.request().method(), 'DELETE');
          if (failDelete) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Tente novamente em instantes."}' });
          matches = matches.filter(match => match.id !== 1);
          return route.fulfill({ contentType: 'application/json', body: '{}' });
        });
        await page.getByRole('button', { name: 'Excluir partida', exact: true }).click();
        const confirmation = page.getByRole('dialog', { name: 'Confirmar exclusão' });
        await confirmation.getByRole('button', { name: 'Confirmar exclusão', exact: true }).click();
        await confirmation.getByRole('alert').waitFor();
        assert.ok(matches.some(match => match.id === 1));
        failDelete = false;
        await confirmation.getByRole('button', { name: 'Confirmar exclusão', exact: true }).click();
        await page.waitForURL('**/partidas');
        assert.equal(matches.some(match => match.id === 1), false);
        await page.goto(base + '/partidas/2');
        await page.getByText(/Histórico compartilhado:/).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Excluir partida', exact: true }).count(), 0);
        console.log(`PASS ${width}px: resumo, categorias, carrossel, período, lista, filtros preservados e exclusão simulada`);
      } finally { await context.close(); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
