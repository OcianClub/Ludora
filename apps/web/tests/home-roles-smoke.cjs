const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { install } = require('./visual-fixture.cjs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';
const output = path.resolve(__dirname, '../../../test-results/home-roles');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  try {
    for (const role of process.env.LUDORA_HOME_TEST_ROLES?.split(',') || ['ADMIN', 'TECNICO', 'RESTRITO', 'TORCEDOR', 'OLHEIRO', 'ANONIMO']) {
      for (const width of [320, 390, 820, 1440]) for (const theme of ['dark', 'light']) {
        const manager = ['ADMIN', 'TECNICO'].includes(role);
        const club = { id: 2, nome: 'Ocian', meuPapel: role === 'RESTRITO' ? 'TECNICO' : role,
          acessoTodasCategorias: false, categoriasAcesso: [{ id: role === 'RESTRITO' ? 2 : 1, nome: role === 'RESTRITO' ? 'sub-8' : 'sub-7' }] };
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
        try {
          await context.addInitScript(({ club, theme }) => {
            localStorage.setItem('ludora_token', 'visual-test-only');
            localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
            localStorage.setItem('ludora_clube', JSON.stringify(club));
            localStorage.setItem('ludora_clube_id', '2');
            localStorage.setItem('ludora_tema', theme);
            if (club.meuPapel === 'ANONIMO') { localStorage.removeItem('ludora_token'); localStorage.removeItem('ludora_usuario'); }
          }, { club, theme });
          const page = await context.newPage();
          const calls = [];
          page.on('pageerror', e => errors.push(e.message));
          await page.route('**/*', route => ['fetch', 'xhr'].includes(route.request().resourceType())
            || new URL(route.request().url()).origin !== new URL(base).origin ? route.abort() : route.continue());
          await install(page, { role: club.meuPapel });
          await page.route('**/usuarios/me', route => route.fulfill({ json: { id: 1, nome: 'Alex', email: 'visual@example.test', clubes: [club] } }));
          const category = { id: 1, nome: 'sub-7', clube_id: 2, tipo: 'INICIACAO' };
          const match = (id, status, data, extra = {}) => ({ id, status, data, horario: '19:30', emCasa: true,
            mandante: { id: 10, nome: 'Ocian' }, visitante: { id: 11, nome: 'Santos' }, categoria: category,
            gols_mandante: 3, gols_visitante: 1, clube_origem_id: 2, sumula_clube_id: 2, gols_sem_autor: 0, ...extra });
          let rows = [match(90, 'AO_VIVO', '2026-10-20', { gols_sem_autor: 2 }),
            match(91, 'FINALIZADA', '2026-10-19'), match(92, 'PREPARADA', '2099-11-06', { titulares_definidos: 3, minha_equipe_pronta: false, titulares_necessarios: 5 })];
          let profilesFail = false;
          let profiles = [
            { id: 1, nome: 'Alex da categoria', categoria_id: 1, totalPartidas: 4, totalGols: 3, totalAssistencias: 2 },
            { id: 2, nome: 'Bruno da categoria', categoria_id: 1, totalPartidas: 4, totalGols: 3, totalAssistencias: 0 },
          ];
          await page.route('**/jogadores/perfis?**', route => {
            calls.push(route.request().url());
            return route.fulfill({ status: profilesFail ? 503 : 200, json: profilesFail ? { error: 'offline' } : profiles });
          });
          await page.route('**/partidas/home?**', route => route.fulfill({ json: rows }));
          await page.route('**/partidas/solicitacoes', route => route.fulfill({ json: [
            { id: 'a', respondente_id: 2, status: 'PENDENTE', categoria_nome: 'sub-7' },
            { id: 'b', respondente_id: 2, status: 'PENDENTE', categoria_nome: 'sub-8' },
            { id: 'c', respondente_id: 3, status: 'PENDENTE', categoria_nome: 'sub-7' },
          ] }));
          await page.route('**/publico/clubes/2/**', route => {
            const pathname = new URL(route.request().url()).pathname;
            if (pathname.endsWith('/categorias')) return route.fulfill({ json: [category] });
            if (pathname.endsWith('/partidas/home')) return route.fulfill({ json: rows });
            if (pathname.endsWith('/times')) return route.fulfill({ json: [] });
            return route.fallback();
          });
          await page.goto(base + '/dashboard');
          await page.locator('.home-match-cta').waitFor();
          if (manager) {
            await page.getByRole('link', { name: /Solicitações de partida/ }).waitFor();
            assert.equal(await page.locator('.home-pending').count(), 1);
            assert.match(await page.locator('.home-pending').innerText(), /3\/5 titulares/);
            assert.equal(await page.locator('.home-pending-items a').count(), 4);
            assert.equal(await page.getByRole('link', { name: /Solicitações de partida/ }).getAttribute('href'), '/partidas/solicitacoes');
            assert.equal(await page.locator('.home-match-cta').innerText(), 'Operar súmula');
            assert.equal(await page.locator('.home-highlights').count(), 0);
            assert.match(await page.locator('.home-upcoming-match').first().getAttribute('aria-label'), /Continuar preparação/);
          } else {
            await page.locator('.home-highlight-leaders').waitFor();
            assert.equal(await page.locator('.home-pending').count(), 0);
            assert.equal(await page.locator('.home-match-cta').innerText(), 'Acompanhar ao vivo');
            assert.doesNotMatch(await page.locator('.home-upcoming').innerText(), /Preparada|Agendada|Equipe confirmada/);
            assert.equal(await page.locator('.home-highlight-leaders a').count(), 2);
            assert.match(await page.locator('.home-highlight-leaders').innerText(), /atleta empatado/);
            assert.ok(calls.every(url => url.includes('categoria_id=1')));
          }
          assert.equal(await page.locator('.home-stale-live').count(), 1);
          const ball = page.locator('.history-summary-result').first();
          await ball.focus();
          await page.getByRole('tooltip').waitFor();
          assert.match(await page.getByRole('tooltip').innerText(), /Ocian 3 a 1 Santos/);
          assert.match(await ball.getAttribute('aria-label'), /Ocian 3 a 1 Santos/);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${role} ${width}: overflow`);
          assert.equal(await page.locator('.home-moment, .category-moment').count(), 0, 'sem histórico duplicado');
          assert.equal(await page.locator('.history-summary-result').count(), await page.locator('.home-history-table tbody tr').count());
          const summaryOrder = await page.locator('.history-summary-result').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-controls')));
          const rowOrder = await page.locator('.home-history-table tbody tr').evaluateAll(rows => rows.map(row => row.id));
          assert.deepEqual(summaryOrder, rowOrder, 'bolinhas e tabela têm a mesma ordem');
          await ball.click();
          assert.ok(await page.locator('.home-history-table tbody tr').first().locator('.history-table-link').evaluate(el => el === document.activeElement), 'bolinha leva à partida na tabela pelo teclado ou toque');
          if (width === 1440) {
            const main = await page.locator('.home-feature').boundingBox();
            const side = await page.locator(manager ? '.home-pending' : '.home-side').boundingBox();
            assert.ok(Math.abs(main.y - side.y) < 1 && side.x > main.x + main.width, 'colunas superiores alinhadas');
          }
          await page.mouse.move(0, 0);
          await ball.evaluate(el => el.blur());
          if ([390, 1440].includes(width) && ['ADMIN', 'TORCEDOR'].includes(role)) {
            await page.screenshot({ path: path.join(output, `${role}-${width}-${theme}.png`), fullPage: true, animations: 'disabled' });
          }
          if (role === 'TORCEDOR' && width === 390 && theme === 'dark') {
            rows = [rows[1]];
            profiles = [];
            await page.reload();
            await page.getByRole('heading', { name: 'Última partida' }).waitFor();
            assert.equal(await page.locator('.home-score').innerText(), '3\n·\n1');
            assert.equal(await page.locator('.home-match-cta').innerText(), 'Ver resumo da partida');
            await page.waitForFunction(() => !document.querySelector('.home-highlights'));
            rows = [];
            profilesFail = true;
            await page.reload();
            await page.getByRole('button', { name: 'Tentar novamente' }).waitFor();
            profilesFail = false;
            profiles = [{ id: 1, nome: 'Recuperado', totalGols: 1, totalAssistencias: 0, totalPartidas: 1 }];
            await page.getByRole('button', { name: 'Tentar novamente' }).click();
            await page.getByText('Recuperado', { exact: true }).waitFor();
          }
          console.log(`PASS ${role} ${width}px ${theme}`);
        } finally { await context.close(); }
      }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
