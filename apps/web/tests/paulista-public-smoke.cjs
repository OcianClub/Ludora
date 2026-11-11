const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');
const { install } = require('./visual-fixture.cjs');
const { eventos } = require('./paulista-public-fixture.cjs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5191';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const output = path.resolve(__dirname, '../../../test-results/paulista-publico');
  await fs.mkdir(output, { recursive: true });
  try {
    for (const mode of ['anonimo', 'torcedor', 'gestor-visitante', 'gestor']) {
      for (const width of [320, 390, 768, 1024, 1440]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        await context.addInitScript(({ mode }) => {
          const role = mode.startsWith('gestor') ? 'ADMIN' : 'TORCEDOR';
          localStorage.setItem('ludora_clube_id', '2');
          localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: role }));
          if (mode !== 'anonimo') {
            localStorage.setItem('ludora_token', 'visual-test-only');
            localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex Morgan', email: 'visual@example.test' }));
          }
          if (mode === 'gestor-visitante') sessionStorage.setItem('ludora_visitor_view', JSON.stringify({ clubId: 2, userId: 1 }));
        }, { mode });
        const page = await context.newPage(), calls = [], errors = [];
        page.setDefaultTimeout(12000);
        page.on('pageerror', e => errors.push(e.message));
        await install(page, { role: mode.startsWith('gestor') ? 'ADMIN' : 'TORCEDOR', onUnknown: route => route.fulfill({ status: 404, json: { error: 'Consulta de teste não prevista' } }) });
        await page.route('http://localhost:3000/**', async route => {
          const req = route.request(), url = new URL(req.url());
          calls.push({ path: url.pathname, method: req.method() });
          if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
          if (url.pathname === '/publico/clubes/2/paulista') {
            assert.equal(req.headers().authorization, undefined);
            return route.fulfill({ json: eventos() });
          }
          if (url.pathname === '/paulista/status') return route.fulfill({ json: { ativo: true, bancoPronto: true } });
          if (url.pathname === '/paulista/eventos') return route.fulfill({ json: eventos().map(({ id, ano, categoria, divisao }) => ({ id, ano, categoria, divisao })) });
          if (/^\/paulista\/eventos\/\d+$/.test(url.pathname)) {
            const e = eventos().find(e => e.id === Number(url.pathname.split('/').pop()));
            return route.fulfill({ json: { evento: { id: e.id }, snapshot: { ...e, titulo: 'Paulista', avisos: [] }, vinculos: [{ equipeId: 20, clubeId: 2, nome: 'Ocian' }], jogosLocais: [], pendencias: [], retroativos: [] } });
          }
          return route.fallback();
        });
        const publicMode = mode !== 'gestor';
        await page.goto(base + (publicMode ? '/clubes/2/competicoes' : '/competicoes'));
        await page.locator('.paulista-overview-screen').waitFor();
        assert.equal(await page.getByRole('heading', { name: 'Entre para continuar' }).count(), 0);
        await page.getByRole('button', { name: 'Jogos', exact: true }).click();
        await page.locator('.paulista-fixture').first().waitFor();
        await page.getByRole('button', { name: /^Ver partida / }).first().click();
        await page.getByRole('dialog').waitFor();
        assert.match(await page.getByRole('dialog').innerText(), /Arena de teste/);
        assert.equal(await page.getByRole('dialog').getByRole('button', { name: /Salvar|Editar|Registrar|Iniciar/ }).count(), 0);
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Classificação', exact: true }).click();
        await page.locator('.paulista-table-scroll tr.is-own').waitFor();
        await page.getByRole('button', { name: 'Chaveamento', exact: true }).click();
        await page.locator('.paulista-bracket-game').first().waitFor();
        await page.getByRole('tab', { name: 'SUB-8', exact: true }).click();
        await page.getByText('Divisão A1', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Opções do campeonato', exact: true }).click();
        const beforeRefresh = calls.filter(c => c.path.includes(publicMode ? '/publico/clubes/2/paulista' : '/paulista/eventos/926')).length;
        await Promise.all([
          page.waitForResponse(r => new URL(r.url()).pathname === (publicMode ? '/publico/clubes/2/paulista' : '/paulista/eventos/926')),
          page.getByRole('menuitem', { name: 'Atualizar dados', exact: true }).click(),
        ]);
        await page.waitForFunction(() => document.querySelector('.paulista-header')?.getAttribute('aria-busy') === 'false');
        assert.ok(calls.filter(c => c.path.includes(publicMode ? '/publico/clubes/2/paulista' : '/paulista/eventos/926')).length > beforeRefresh);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${mode} ${width}px sem overflow`);
        await page.screenshot({ path: path.join(output, `${mode}-${width}.png`) });
        if (publicMode) {
          assert.deepEqual(calls.filter(c => /^\/(?:admin|paulista)\//.test(c.path)), [], 'visitante não usa consultas internas');
          assert.equal(await page.getByRole('button', { name: /Editar|Salvar|Finalizar|Fazer substituição|Sincronizar/ }).count(), 0);
          await page.goto(base + '/competicoes/paulista?evento=925');
          await page.locator('.paulista-overview-screen').waitFor();
          if (mode !== 'gestor-visitante') {
            await page.goto(base + '/jogadores');
            await page.getByRole('heading', { name: /Entre para continuar|Área de gestão do clube/ }).waitFor();
          }
        } else {
          assert.ok(calls.some(c => c.path === '/paulista/eventos/925'), 'gestor preserva o painel autenticado');
        }
        assert.deepEqual(calls.filter(c => !['GET', 'OPTIONS'].includes(c.method)), [], 'navegação não modifica dados');
        assert.deepEqual(errors, []);
        console.log(`OK ${mode} ${width}px: consulta, filtros, detalhes, classificação, chaveamento, atualização e permissões`);
        await context.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
