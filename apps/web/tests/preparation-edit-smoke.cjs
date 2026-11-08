const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5191';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 760, 1180]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(() => {
        localStorage.setItem('ludora_token', 'test');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Gestor de teste' }));
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
        localStorage.setItem('ludora_clube_id', '2');
        localStorage.setItem('ludora_tema', 'dark');
      });
      const page = await context.newPage(), errors = [], edits = [];
      let navigations = 0;
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', req => { if (req.isNavigationRequest() && req.frame() === page.mainFrame()) navigations++; });
      await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      await require('./visual-fixture.cjs').install(page);
      const categoria = { id: 1, nome: 'sub-7', tipo: 'INICIACAO', clube_id: 2 };
      let status = 'AGENDADA';
      const game = () => ({ id: 106, status, versao: 5, titulares_necessarios: 5, periodo_atual: 1,
        categoria_id: 99, categoria: { ...categoria, id: 99, clube_id: 3 }, mandante_id: 13, visitante_id: 14,
        mandante: { id: 13, nome: 'Ocian', clube_representado_id: 2 }, visitante: { id: 14, nome: 'Santos', clube_representado_id: 3 },
        organizador_id: 3, sumula_clube_id: 3, data: '2026-12-20T00:00:00Z', horario: '19:30', local: 'Quadra original', emCasa: true,
        gols_mandante: 0, gols_visitante: 0 });
      await page.route('**/partidas/106/gestao', route => route.fulfill({ json: {
        partida: game(), organizador: { id: 3, nome: 'Santos' }, podePreparar: true, podeSumula: false, minhaEquipeId: 1,
        eventos: [], auditoria: [], equipes: [
          { id: 1, clube_id: 2, categoria_id: 1, categoria, time_id: 13, clube: { id: 2, nome: 'Ocian' }, pronta: false, publicada_em: null, escalacao: [] },
          { id: 2, clube_id: 3, categoria_id: 99, categoria: { ...categoria, id: 99, clube_id: 3 }, time_id: 14, clube: { id: 3, nome: 'Santos' }, pronta: false, publicada_em: null, escalacao: [] },
        ],
      } }));
      await page.route('**/partidas/106', async route => {
        if (route.request().method() !== 'PATCH') return route.fallback();
        edits.push(route.request().postDataJSON());
        await route.fulfill({ json: { solicitacao: { id: 'edit-test-proposal' } } });
      });
      for (const value of ['AGENDADA', 'PREPARADA']) {
        status = value;
        await page.goto(base + '/partidas/106');
        const edit = page.getByRole('button', { name: 'Editar partida', exact: true });
        await edit.waitFor(); assert.equal(await edit.isEnabled(), true, 'mandante pode propor edição mesmo sem ser organizador');
        const menu = page.getByRole('button', { name: 'Ações da partida', exact: true });
        const a = await edit.boundingBox(), b = await menu.boundingBox();
        assert.ok(a.x + a.width <= b.x && Math.abs(a.y + a.height / 2 - b.y - b.height / 2) < 1);
        assert.equal(await edit.locator('span').filter({ hasText: 'Editar partida' }).isVisible(), width > 760);
        if (width <= 760) assert.ok(a.width <= 40, 'mobile usa botão compacto de lápis');
        await menu.click(); assert.equal(await page.getByRole('menuitem', { name: 'Editar partida' }).count(), 0);
        await page.keyboard.press('Escape');
        await page.getByRole('navigation', { name: 'Etapas da preparação' }).getByRole('button', { name: /Escalação/ }).click();
        await edit.click();
        const dialog = page.getByRole('dialog', { name: 'Editar partida', exact: true });
        await dialog.waitFor(); assert.match(await dialog.innerText(), /Santos precisa aceitar/);
        await dialog.getByRole('combobox', { name: /Local/ }).fill('Quadra corrigida');
        if (value === 'PREPARADA') await dialog.getByRole('option').first().waitFor();
        const count = navigations;
        await dialog.getByRole('button', { name: 'Enviar alteração', exact: true }).click();
        await page.waitForURL('**/partidas/solicitacoes?id=edit-test-proposal');
        assert.equal(navigations, count, 'edição não recarrega o site inteiro');
        assert.deepEqual(edits.at(-1), { data: '2026-12-20', horario: '19:30', local: 'Quadra corrigida', versao: 5 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      assert.deepEqual(errors, []); await context.close();
      console.log(`OK ${width}px: edição agendada/preparada, mandante, lápis responsivo e proposta sem recarregar`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
