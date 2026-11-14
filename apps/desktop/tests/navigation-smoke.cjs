// Renderer compilado com IPC simulado: não acessa contas, API ou banco reais.
// Execute após o build: node apps/desktop/tests/navigation-smoke.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../out/renderer');
const output = path.resolve(__dirname, '../../../test-results/desktop-navigation');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' };

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => {
      res.writeHead(error ? 404 : 200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(error ? 'Not found' : data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const scenario of [
      { width: 1440, height: 900, role: 'SUPERADMIN', theme: 'dark' },
      { width: 1280, height: 720, role: 'SUPERADMIN', theme: 'light' },
      { width: 960, height: 640, role: 'SUPERADMIN', theme: 'dark' },
      { width: 640, height: 480, role: 'SUPERADMIN', theme: 'dark' },
      { width: 1200, height: 800, role: 'SUPORTE', theme: 'dark' },
      { width: 800, height: 600, role: 'DESENVOLVEDOR', theme: 'light' },
    ]) {
      const context = await browser.newContext({ viewport: scenario });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(scenario => {
        localStorage.setItem('ludora_tema', scenario.theme);
        window.__calls = [];
        const noop = () => () => {};
        window.ludora = {
          auth: { restaurar: async () => ({ ok: true, persistente: true, usuario: { id: 1, nome: 'Equipe de teste', email: 'visual@example.test', papel_plataforma: scenario.role } }), aoExpirar: noop, sair: async () => {} },
          config: { obter: async () => ({ apiUrl: 'http://localhost:3000', apiUrlPadrao: 'http://localhost:3000', versao: '0.0.1', plataforma: 'win32', armazenamentoSeguro: true }) },
          logs: { historico: async () => ({ estado: 'conectado', entradas: [] }), aoReceber: noop,
            aoMudarEstado: callback => { const listener = e => callback(e.detail); window.addEventListener('fixture:connection', listener); return () => window.removeEventListener('fixture:connection', listener); } },
          api: { requisicao: async (method, route) => {
            window.__calls.push(route);
            let data;
            if (route === '/admin/overview') data = { totais: { usuarios: 31, jogadores: 546, partidas: 751, partidasAoVivo: 27 }, conexoes: { principal: 2, admin: 1 }, clubes: [] };
            else if (route === '/admin/overview/operacao') data = { consultadoEm: '2026-11-10T12:00:00Z', chamados: { abertos: 0, atrasados: 0 }, manutencao: 0, federacao: { pendencias: 0, falhas: 0, erroRotina: false }, antigas: [] };
            else if (route === '/admin/equipe/diagnostico') data = { banco: 'disponivel', latenciaMs: 92, consultadoEm: '2026-11-09T23:00:00Z', emailConfigurado: true, paulistaHabilitado: true };
            else throw new Error(`IPC sem fixture: ${route}`);
            return { ok: true, status: 200, data };
          } },
        };
      }, scenario);
      await page.goto(base + '/#/');
      const canAccessOperations = scenario.role !== 'SUPORTE';
      await page.getByRole('heading', { level: 1, name: 'Visão global', exact: true }).waitFor();
      const nav = page.getByRole('navigation', { name: 'Navegação principal' });
      const expected = canAccessOperations ? ['Visão global', 'Clubes', 'Usuários', 'Campeonato Paulista', 'Chamados', 'Manutenção', 'Banco e integrações', 'Logs ao vivo', 'Ajustes']
        : ['Visão global', 'Chamados', 'Manutenção', 'Ajustes'];
      assert.deepEqual(await nav.getByRole('link').evaluateAll(links => links.map(link => link.getAttribute('aria-label'))), expected);
      assert.equal(await nav.locator('section').count(), canAccessOperations ? 3 : 2, 'Sem seções vazias ou acesso indevido');
      assert.equal(await page.locator('.admin-layout-collapsed').count(), scenario.width <= 960 ? 1 : 0);
      assert.equal(await page.locator('.admin-sidebar .admin-sidebar-toggle').count(), 1);
      assert.equal(await page.locator('.admin-workspace-header .admin-sidebar-toggle').count(), 0);
      assert.equal(await page.locator('.admin-brand').isVisible(), scenario.width > 960);
      assert.equal(await page.locator('.admin-workspace-header').getByText('Administrador Ludora', { exact: true }).count(), 0);
      const paddingAligned = await page.evaluate(() => {
        const header = document.querySelector('.admin-header-inner');
        const main = document.querySelector('.admin-content');
        return Math.abs(header.getBoundingClientRect().right - parseFloat(getComputedStyle(header).paddingRight) - main.getBoundingClientRect().right + parseFloat(getComputedStyle(main).paddingRight)) < 1;
      });
      assert.equal(paddingAligned, true, 'Header usa o mesmo container do conteúdo');
      if (canAccessOperations) {
        await page.getByRole('status', { name: 'Conexão em tempo real: Conectado' }).waitFor();
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('fixture:connection', { detail: 'erro' })));
        await page.getByRole('status', { name: 'Conexão em tempo real: Sem conexão' }).waitFor();
      }
      const calls = await page.evaluate(() => window.__calls.length);
      if (scenario.width > 960) {
        await page.getByRole('button', { name: 'Recolher navegação', exact: true }).click();
        assert.equal(await nav.getByRole('link', { name: expected[0], exact: true }).getAttribute('data-tooltip'), expected[0]);
        await page.reload();
        await page.getByRole('button', { name: 'Expandir navegação', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Expandir navegação', exact: true }).click();
        await page.setViewportSize({ width: 800, height: scenario.height });
        await page.waitForFunction(() => !!document.querySelector('.admin-layout-collapsed'));
        await page.setViewportSize(scenario);
        await page.waitForFunction(() => !document.querySelector('.admin-layout-collapsed'));
      }
      assert.equal(await page.evaluate(() => window.__calls.length), calls, 'Recolher ou redimensionar não recarrega os dados da página');
      await page.getByRole('link', { name: 'Servidor da API: API local. Configurar conexão' }).click();
      await page.getByRole('heading', { level: 1, name: 'Ajustes', exact: true }).waitFor();
      if (scenario.width <= 960) await page.getByRole('button', { name: 'Expandir navegação', exact: true }).click();
      await page.getByRole('link', { name: 'Ludora — visão global', exact: true }).click();
      if (scenario.width <= 960) await page.getByRole('button', { name: 'Recolher navegação', exact: true }).click();
      await page.getByRole('heading', { level: 1, name: 'Visão global', exact: true }).waitFor();
      if (!canAccessOperations) {
        await page.goto(base + '/#/visao');
        await page.getByRole('heading', { level: 1, name: 'Visão global', exact: true }).waitFor();
        assert.equal(new URL(page.url()).hash, '#/visao');
      }
      const theme = page.getByRole('radio', { name: scenario.theme === 'dark' ? 'Tema escuro' : 'Tema claro' });
      await theme.focus(); await page.keyboard.press('Home');
      assert.equal(await page.getByRole('radio', { name: 'Tema do sistema' }).getAttribute('aria-checked'), 'true');
      await page.getByRole('radio', { name: scenario.theme === 'dark' ? 'Tema escuro' : 'Tema claro' }).click();
      await page.locator('.admin-skip-link').focus(); await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'main-content');
      const layout = await page.evaluate(() => {
        const sidebar = document.querySelector('.admin-sidebar').getBoundingClientRect();
        const main = document.querySelector('.admin-workspace').getBoundingClientRect();
        const footer = document.querySelector('.admin-sidebar-footer').getBoundingClientRect();
        return { overlap: sidebar.right > main.left + 1, overflow: document.documentElement.scrollWidth > innerWidth || document.querySelector('.admin-workspace-header').scrollWidth > main.width, footer: footer.bottom <= innerHeight + 1 };
      });
      assert.deepEqual(layout, { overlap: false, overflow: false, footer: true });
      assert.deepEqual(errors, []);
      await nav.getByRole('link', { name: 'Ajustes', exact: true }).scrollIntoViewIfNeeded();
      assert.ok(await nav.getByRole('link', { name: 'Ajustes', exact: true }).isVisible(), 'Último item acessível mesmo em janela baixa');
      await page.evaluate(() => {
        document.querySelector('.admin-nav').scrollTop = 0;
        document.querySelector('.admin-workspace').scrollTop = 0;
      });
      await page.screenshot({ path: path.join(output, `${scenario.role}-${scenario.width}-${scenario.theme}.png`), fullPage: true });
      console.log(`PASS ${scenario.role} ${scenario.width}x${scenario.height} ${scenario.theme}`);
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
