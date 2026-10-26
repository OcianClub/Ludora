const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const base = 'http://127.0.0.1:5187';
const output = path.resolve(__dirname, '../../../test-results/web-schedule');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 820, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      try {
        await context.addInitScript(() => {
          localStorage.setItem('ludora_token', 'visual-test-only');
          localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex', email: 'visual@example.test' }));
          localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
          localStorage.setItem('ludora_clube_id', '2');
          localStorage.setItem('ludora_tema', 'dark');
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
        await require('./visual-fixture.cjs').install(page);
        const players = [
          { id: 1, nome: 'João Vítor', posicao: 'Alas', numCamisa: 6, idade: 13, categoria_id: 1, perfil_ml: 'Armador', nota_geral: 46, gols: 1, assistencias: 3, jogos_disputados: 6, scores_ml: { finalizacao: 17, visao_de_jogo: 70, defesa: 0, disciplina: 100, intensidade: 0, tecnica: 43 } },
          { id: 2, nome: 'Ethan Brooks', posicao: 'Fixo', numCamisa: 9, categoria_id: 1, perfil_ml: 'Artilheiro', nota_geral: 54.3, gols: 6, assistencias: 0, jogos_disputados: 8 },
          { id: 3, nome: 'Caio Ribeiro', posicao: 'Goleiro', numCamisa: 1, categoria_id: 1, perfil_ml: 'Paredão', nota_geral: 20, gols: 0, defesas: 12, jogos_disputados: 4 },
          { id: 4, nome: 'Atleta sem avaliação', posicao: 'Pivô', categoria_id: 1, perfil_ml: 'Sem dados', nota_geral: 0, jogos_disputados: 0 },
          { id: 5, nome: 'Índice zero válido', posicao: 'Fixo', categoria_id: 1, perfil_ml: 'Armador', nota_geral: 0, jogos_disputados: 1 },
          { id: 6, nome: 'Atleta da Base', posicao: 'Alas', categoria_id: 5, perfil_ml: 'Artilheiro', nota_geral: 31, gols: 2, jogos_disputados: 3 },
        ];
        let failHistory = false;
        let historyCalls = 0;
        await page.route('**/jogadores/perfis*', route => route.fulfill({ json: players }));
        await page.route('**/jogadores/*/scout-contexto', route => {
          historyCalls++;
          if (failHistory) return route.fulfill({ status: 503, json: { error: 'indisponível' } });
          const id = Number(new URL(route.request().url()).pathname.split('/')[2]);
          return route.fulfill({ json: { jogador_id: id, total_partidas: 3, partidas: [
            { id: 11, data: '2026-08-12', adversario: 'Aurora FC', gols: 1, assistencias: 2, defesas: 0 },
            { id: 12, data: '2026-08-05', adversario: 'União Esportiva', gols: 0, assistencias: 0, defesas: 0 },
            { id: 13, data: '2026-07-29', adversario: 'Estrela Azul', gols: 0, assistencias: 1, defesas: 0 },
          ] } });
        });
        await page.goto(base + '/elenco');
        await page.getByRole('button', { name: 'Ver ficha de João Vítor', exact: true }).waitFor();
        assert.equal(await page.locator('.scout-player').count(), 5);
        assert.equal(historyCalls, 0, 'Não consulta histórico na listagem');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.getByRole('group', { name: 'Perfil de desempenho' }).getByRole('button', { name: /^Armador/ }).click();
        assert.equal(await page.locator('.scout-player').count(), 2);
        await page.getByRole('searchbox', { name: 'Buscar atleta' }).fill('joao');
        assert.equal(await page.locator('.scout-player').count(), 1);
        const before = page.url();
        await page.getByRole('button', { name: 'Ver ficha de João Vítor', exact: true }).click();
        const detail = page.getByRole('dialog', { name: 'Ficha do atleta' });
        await detail.getByRole('row', { name: /^Aurora FC/ }).waitFor();
        assert.ok(await detail.getByText('0,33', { exact: true }).count());
        assert.ok(await detail.getByRole('heading', { name: 'Índices comparativos' }).count());
        await page.screenshot({ path: path.join(output, `scout-detail-${width}.png`) });
        await page.goBack();
        await detail.waitFor({ state: 'detached' });
        assert.equal(page.url(), before);
        await page.getByRole('button', { name: 'Limpar tudo', exact: true }).click();
        await page.getByRole('group', { name: 'Perfil de desempenho' }).getByRole('button', { name: /^Não avaliados/ }).click();
        assert.equal(await page.locator('.scout-player').count(), 1);
        assert.ok(await page.getByRole('button', { name: 'Ver ficha de Atleta sem avaliação' }).count());
        await page.getByRole('button', { name: 'Limpar tudo', exact: true }).click();
        await page.getByRole('group', { name: 'Categoria do scout' }).getByRole('button', { name: 'BASE', exact: true }).click();
        assert.equal(await page.locator('.scout-player').count(), 1);
        await page.getByRole('group', { name: 'Categoria do scout' }).getByRole('button', { name: 'INICIAÇÃO', exact: true }).click();
        await page.getByRole('button', { name: 'Mais filtros', exact: true }).click();
        const filters = page.getByRole('dialog', { name: 'Filtrar elenco' });
        await filters.getByRole('group', { name: 'Participação' }).getByRole('button', { name: 'Sem escalações', exact: true }).click();
        await filters.getByRole('button', { name: 'Aplicar filtros' }).click();
        assert.equal(await page.locator('.scout-player').count(), 1);
        await page.getByRole('button', { name: 'Limpar tudo', exact: true }).click();
        await page.getByRole('group', { name: 'Visualização do elenco' }).getByRole('button', { name: 'Lista', exact: true }).click();
        assert.ok(await page.locator('.scout-players-list').count());
        await page.getByRole('group', { name: 'Visualização do elenco' }).getByRole('button', { name: 'Cards', exact: true }).click();
        for (const theme of ['dark', 'light']) {
          await page.evaluate(value => { localStorage.setItem('ludora_tema', value); window.dispatchEvent(new Event('ludora:theme-change')); scrollTo(0, 0); }, theme);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          await page.screenshot({ path: path.join(output, `scout-${width}-${theme}.png`), fullPage: true });
        }
        failHistory = true;
        await page.getByRole('button', { name: 'Ver ficha de João Vítor', exact: true }).click();
        await detail.getByRole('alert').waitFor();
        assert.ok(await detail.getByRole('heading', { name: 'Totais registrados' }).count());
        failHistory = false;
        await detail.getByRole('button', { name: 'Tentar novamente' }).click();
        await detail.getByRole('row', { name: /^Aurora FC/ }).waitFor();
        assert.deepEqual(errors, []);
        console.log(`PASS Scout ${width}px: perfis, busca sem acentos, categorias, lista, ficha, histórico sob demanda, falha e recuperação`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
