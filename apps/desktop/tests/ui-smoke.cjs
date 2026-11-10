// Padrões visuais e interações do renderer com IPC fictício, sem banco real.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../out/renderer');
const output = path.resolve(__dirname, '../../../test-results/desktop-ui');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff' };

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, data) => { res.writeHead(error ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(error ? 'Not found' : data); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const scenario of [
      { width: 1440, height: 900, theme: 'dark' }, { width: 1280, height: 720, theme: 'light' },
      { width: 800, height: 600, theme: 'dark' }, { width: 640, height: 480, theme: 'light' },
    ]) {
      const context = await browser.newContext({ viewport: scenario, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(scenario => {
        localStorage.setItem('ludora_tema', scenario.theme);
        window.__mode = 'normal'; window.__writes = 0;
        const club = { id: 1, nome: 'Ocian', escudo: null, cidade: 'Praia Grande', estado: 'SP', plano: 'DEMO', ativo: true, membros: 14, categorias: 8, jogadores: 226, partidas: 298 };
        const overview = { totais: { clubes: 1, usuarios: 1, jogadores: 226, partidas: 298, partidasAoVivo: 2 }, conexoes: { principal: 2, admin: 1 }, clubes: [club] };
        const noop = () => () => {};
        window.ludora = {
          auth: { restaurar: async () => ({ ok: true, persistente: true, usuario: { id: 1, nome: 'Equipe de teste', email: 'visual@example.test', papel_plataforma: 'SUPERADMIN' } }), aoExpirar: noop, sair: async () => {} },
          config: { obter: async () => ({ apiUrl: 'http://localhost:3000', apiUrlPadrao: 'http://localhost:3000', versao: '0.0.1', plataforma: 'win32', armazenamentoSeguro: true }) },
          logs: { historico: async () => ({ estado: 'conectado', entradas: [] }), aoReceber: noop, aoMudarEstado: noop },
          api: { requisicao: async (method, route) => {
            if (method !== 'GET') { window.__writes++; throw new Error('Teste não deve alterar dados'); }
            if (window.__mode === 'loading') await new Promise(resolve => setTimeout(resolve, 800));
            if (window.__mode === 'error' && route === '/admin/overview') return { ok: false, status: 503, data: { error: 'Serviço indisponível. Tente novamente.' } };
            let data;
            const url = new URL(route, 'http://fixture');
            if (url.pathname === '/admin/overview') data = overview;
            else if (url.pathname === '/admin/usuarios') data = url.searchParams.get('busca') ? [] : [{ id: 2, nome: 'Alex de teste', email: 'alex@example.test', papel_plataforma: 'USUARIO', suspenso: false, clubes: [{ clube_id: 1, nome: 'Ocian', papel: 'TECNICO' }] }];
            else if (url.pathname === '/admin/equipe/chamados/filtros') data = { clubes: [{ value: 1, label: 'Ocian' }], responsaveis: [], contagens: { '': 0, NOVO: 0, ATRASADO: 0, RECORRENTE: 0, MEUS: 0 } };
            else if (url.pathname === '/admin/equipe/chamados/clubes') data = [{ value: 1, label: 'Ocian' }];
            else if (url.pathname === '/admin/equipe/chamados') data = [];
            else if (url.pathname === '/admin/equipe/manutencao') data = { pausas: [], clubes: [club], eventos: [], operacoes: [], chamado: null };
            else throw new Error(`IPC sem fixture: ${route}`);
            return { ok: true, status: 200, data };
          } },
        };
      }, scenario);
      const base = `http://127.0.0.1:${server.address().port}/#/`;
      await page.goto(base + 'clubes');
      const search = page.getByRole('searchbox', { name: 'Buscar clube', exact: true });
      await search.waitFor();
      const heights = await page.locator('.club-toolbar .collection-search, .club-toolbar .schedule-select-trigger').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().height));
      assert.deepEqual(heights, [40, 40]);
      await page.getByRole('button', { name: 'Novo clube', exact: true }).click();
      let dialog = page.getByRole('dialog', { name: 'Novo clube', exact: true });
      await dialog.waitFor();
      await dialog.getByRole('textbox', { name: 'Nome do clube', exact: true }).focus();
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      assert.equal(await page.getByRole('button', { name: 'Novo clube', exact: true }).evaluate(el => el === document.activeElement), true);
      await search.fill('inexistente');
      await page.getByRole('heading', { name: 'Nenhum clube encontrado', exact: true }).waitFor();

      await page.goto(base + 'chamados');
      await page.getByRole('heading', { name: 'Nenhum chamado encontrado', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Mais filtros', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Filtrar chamados', exact: true });
      const combo = dialog.getByRole('combobox', { name: /Situação/ });
      await combo.scrollIntoViewIfNeeded();
      const before = await dialog.boundingBox();
      await combo.click();
      await dialog.getByRole('listbox').waitFor();
      const after = await dialog.boundingBox();
      assert.equal(Math.round(before.height), Math.round(after.height), 'Select não aumenta o modal');
      assert.equal(Math.round(before.y), Math.round(after.y), 'Select não desloca o modal');
      await page.keyboard.press('Escape');
      assert.equal(await dialog.isVisible(), true, 'Primeiro Escape fecha apenas o select');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Novo chamado', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Novo chamado manual', exact: true });
      await dialog.waitFor();
      await page.getByRole('radio', { name: 'Web', exact: true }).waitFor();
      await dialog.getByRole('button', { name: 'Cancelar', exact: true }).focus();
      await page.keyboard.press('Tab');
      assert.equal(await dialog.getByRole('button', { name: 'Fechar janela' }).evaluate(el => el === document.activeElement), true, 'Tab permanece no modal');
      const geometry = await dialog.evaluate(el => {
        const box = el.getBoundingClientRect();
        const body = el.querySelector('.modal-body');
        const footer = el.querySelector('.modal-footer').getBoundingClientRect();
        return { inViewport: box.x >= 0 && box.y >= 0 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1, bodyOverflow: body.scrollWidth > body.clientWidth + 1, footerVisible: footer.bottom <= box.bottom && footer.top > box.top };
      });
      assert.deepEqual(geometry, { inViewport: true, bodyOverflow: false, footerVisible: true });
      await page.screenshot({ path: path.join(output, `modal-${scenario.width}-${scenario.theme}.png`) });
      await page.keyboard.press('Escape');

      await page.goto(base + 'usuarios');
      await page.getByRole('button', { name: /Alex de teste/ }).waitFor();
      const topBefore = await page.locator('.user-list-heading').boundingBox();
      await page.getByRole('button', { name: 'Mais filtros', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Filtrar usuários', exact: true });
      await dialog.waitFor();
      const topAfter = await page.locator('.user-list-heading').boundingBox();
      assert.equal(Math.round(topBefore.y), Math.round(topAfter.y), 'Filtros de usuários não empurram a lista');
      await dialog.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
      await dialog.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      const filterSize = await page.getByRole('button', { name: 'Mais filtros', exact: true }).boundingBox();
      assert.equal(filterSize.width, 40); assert.equal(filterSize.height, 40);
      await page.screenshot({ path: path.join(output, `usuarios-${scenario.width}-${scenario.theme}.png`) });
      await page.getByRole('searchbox', { name: 'Buscar usuários', exact: true }).fill('nada');
      await page.getByRole('heading', { name: 'Nenhuma conta encontrada', exact: true }).waitFor();
      await page.evaluate(() => { window.__mode = 'error'; });
      await page.getByRole('navigation').getByRole('link', { name: 'Visão global', exact: true }).click();
      await page.getByRole('alert').waitFor();
      await page.evaluate(() => { window.__mode = 'loading'; });
      await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
      await page.getByRole('status', { name: 'Carregando visão global', exact: true }).waitFor();
      assert.equal(await page.locator('.desktop-skeleton i').first().evaluate(el => getComputedStyle(el).animationName), 'none');
      await page.screenshot({ path: path.join(output, `skeleton-${scenario.width}-${scenario.theme}.png`) });
      await page.getByRole('heading', { level: 1, name: 'Visão global', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.__writes), 0);
      assert.deepEqual(errors, []);
      console.log(`PASS controles, modais, filtros e estados ${scenario.width}x${scenario.height} ${scenario.theme}`);
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
