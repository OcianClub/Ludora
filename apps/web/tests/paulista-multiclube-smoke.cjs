// Leitura do banco do projeto: usa sessões locais preparadas, sem publicar mutações.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../..'), base = 'http://localhost:5173';
(async () => {
  const sessions = JSON.parse(await fs.readFile(path.join(root, '.local-demo/paulista-multiclube-20261106/sessoes-web.json')));
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'docs/dados/paulista-multiclube-20261106.json')));
  const out = path.join(root, 'test-results/paulista-multiclube'); await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const session of sessions.filter(s => !process.env.PAULISTA_SMOKE_CLUBE || s.key === process.env.PAULISTA_SMOKE_CLUBE)) for (const width of [390, 1366]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width === 390, colorScheme: theme });
      await context.addInitScript(({ session, theme }) => {
        localStorage.setItem('ludora_token', session.token); localStorage.setItem('ludora_usuario', JSON.stringify(session.usuario)); localStorage.setItem('ludora_clube', JSON.stringify(session.clube)); localStorage.setItem('ludora_clube_id', String(session.clube.id)); localStorage.setItem('ludora_tema', theme);
      }, { session, theme });
      const page = await context.newPage(), errors = []; page.setDefaultTimeout(25_000);
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (!['localhost', '127.0.0.1'].includes(url.hostname) || !['3000'].includes(url.port)) return route.continue();
        const cors = { 'access-control-allow-origin': base, 'access-control-allow-headers': 'authorization,content-type,x-clube-id' };
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
        if (url.pathname.startsWith('/socket.io')) return route.abort();
        assert.equal(req.method(), 'GET', 'Este smoke não grava dados no projeto.');
        const response = await fetch('http://localhost:3000' + url.pathname + url.search, { headers: { Authorization: `Bearer ${session.token}`, 'x-clube-id': String(session.clube.id) } });
        return route.fulfill({ status: response.status, headers: { ...cors, 'content-type': 'application/json' }, body: await response.text() });
      });
      try {
        const own = manifest.identidades.filter(p => p.key === session.key);
        if (width === 1366 && theme === 'dark') {
          for (const identity of own) {
            await page.goto(base + `/competicoes/paulista?evento=${identity.eventoId}`);
            await page.getByLabel(`Divisão oficial ${identity.divisao}`, { exact: true }).waitFor();
            await page.locator('.paulista-participation-position > strong').filter({ hasText: `${identity.classificacao.find(r => /CLASSIFICA/i.test(r.fase)).posicao}º` }).waitFor();
          }
        }
        const start = own.find(p => p.categoria === 'Sub-7');
        await page.goto(base + `/competicoes/paulista?evento=${start.eventoId}`);
        await page.getByLabel(`Divisão oficial ${start.divisao}`, { exact: true }).waitFor();
        await page.getByRole('tab', { name: 'Base', exact: true }).click();
        const sub12 = page.getByRole('tab', { name: 'SUB-12', exact: true });
        if (width === 390) await sub12.tap(); else { await sub12.focus(); await page.keyboard.press('Enter'); }
        const target = own.find(p => p.categoria === 'Sub-12');
        await page.getByLabel(`Divisão oficial ${target.divisao}`, { exact: true }).waitFor();
        await page.locator('.paulista-participation-position > strong').filter({ hasText: `${target.classificacao.find(r => /CLASSIFICA/i.test(r.fase)).posicao}º` }).waitFor();
        const globe = page.getByRole('link', { name: /^Abrir página oficial da Federação/ });
        assert.equal(await globe.getAttribute('href'), `https://eventos.admfutsal.com.br/evento/${target.eventoId}`);
        if (width === 1366) { await globe.hover(); await page.getByRole('tooltip').waitFor(); await page.mouse.move(0, 0); }
        await page.getByRole('button', { name: 'Classificação', exact: true }).click();
        await page.locator('.paulista-standings .is-own').waitFor();
        assert.match(await page.locator('.paulista-ranking-summary').innerText(), new RegExp(session.clube.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        assert.equal(await page.getByText('Conferência calculada pelo Ludora · 3/1/0 e saldo', { exact: true }).count(), 0);
        assert.equal(await page.locator('body').evaluate(el => el.scrollWidth > innerWidth + 1), false);
        await page.screenshot({ path: path.join(out, `${session.key}-${width}-${theme}-classificacao.png`) });
        await page.getByRole('button', { name: 'Chaveamento', exact: true }).click();
        await page.locator('.paulista-bracket-scroll, .collection-empty').first().waitFor();
        await page.screenshot({ path: path.join(out, `${session.key}-${width}-${theme}-chaveamento.png`) });
        await page.getByRole('button', { name: 'Jogos', exact: true }).click();
        await page.locator('.match-card').first().waitFor();
        if (session.key === 'maua') {
          await page.locator('.match-card').first().click();
          await page.getByRole('dialog', { name: 'Detalhes oficiais da partida', exact: true }).waitFor();
          await page.getByRole('dialog', { name: 'Detalhes oficiais da partida', exact: true }).getByText('W.O. publicado', { exact: true }).waitFor(); await page.goBack();
        }
        const sample = manifest.validacao.categorias.find(c => c.key === session.key && c.sub === 'Sub-12');
        const sorted = [...target.jogos].sort((a, b) => `${a.data || '9999'} ${a.horario || '99:99'}`.localeCompare(`${b.data || '9999'} ${b.horario || '99:99'}`) || a.id.localeCompare(b.id));
        const card = page.locator('.match-card').nth(sorted.findIndex(j => j.id === sample.jogoConferido));
        await card.focus(); await page.keyboard.press('Enter');
        await page.waitForURL(/\/partidas\/\d+/); await page.locator('.match-result, .placar-time').first().waitFor();
        await page.goBack(); await page.waitForURL(/competicoes\/paulista/); await page.locator('.match-card').first().waitFor();
        assert.deepEqual(errors, []);
        console.log(`PASS banco real: ${session.key}, ${width}px, ${theme}`);
      } catch (e) { await page.screenshot({ path: path.join(out, `FALHA-${session.key}-${width}-${theme}.png`) }); throw e; }
      finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
