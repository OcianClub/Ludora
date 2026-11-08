// Duas sessões isoladas e API simulada: nenhum convite ou jogo real é criado.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5191';
const { install } = require('./visual-fixture.cjs');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [360, 1180]) {
      let accepted = false;
      const contexts = [], pages = [], errors = [];
      const clubs = [{ id: 2, nome: 'Ocian', meuPapel: 'ADMIN', acessoTodasCategorias: true }, { id: 3, nome: 'Santos', meuPapel: 'ADMIN', acessoTodasCategorias: true }];
      const user = { id: 1, nome: 'Gestor de teste', email: 'schedule@example.test', clubes: clubs };
      const projection = club => {
        const categoria = { id: club === 2 ? 7 : 88, nome: 'sub-7', tipo: 'INICIACAO', clube_id: club };
        return ['AGENDADA', 'PREPARADA', 'AO_VIVO', 'FINALIZADA', 'CANCELADA'].map((status, i) => ({
          id: 701 + i, status, categoria, categoria_id: categoria.id, organizador_id: 2, clube_origem_id: 2,
          data: '2026-12-15T00:00:00Z', horario: `1${i}:30`, local: 'Quadra compartilhada', emCasa: club === 2,
          mandante_id: 20, visitante_id: 30, mandante: { id: 20, nome: 'Ocian', clube_representado_id: 2 },
          visitante: { id: 30, nome: 'Santos', clube_representado_id: 3 }, gols_mandante: 2, gols_visitante: 1,
        }));
      };
      const proposal = { id: 'schedule-proposal', tipo: 'CRIACAO', origem_id: 2, destino_id: 3, respondente_id: 3,
        versao: 0, origem: clubs[0], destino: clubs[1], categoria_nome: 'SUB-7', criado_em: '2026-11-08T12:00:00Z',
        dados: { data: '2026-12-15', horario: '19:30', local: 'Quadra compartilhada' } };
      const reads = new Map();
      for (const club of [2, 3]) {
        const context = await browser.newContext({ viewport: { width, height: 900 } }); contexts.push(context);
        await context.addInitScript(({ club, clubs, user }) => {
          localStorage.setItem('ludora_token', 'schedule-test-only');
          localStorage.setItem('ludora_usuario', JSON.stringify(user));
          localStorage.setItem('ludora_clube_id', String(club));
          localStorage.setItem('ludora_clube', JSON.stringify(clubs.find(c => c.id === club)));
          localStorage.setItem('ludora_tema', 'dark');
        }, { club, clubs, user });
        const page = await context.newPage(); pages.push(page); page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
        await install(page);
        await page.route('**/usuarios/me', route => route.fulfill({ json: user }));
        await page.route('**/clubes', route => route.fulfill({ json: clubs }));
        await page.route(/\/categorias(?:\?.*)?$/, route => route.fulfill({ json: [projection(club)[0].categoria] }));
        await page.route(/\/partidas(?:\?.*)?$/, async route => {
          if (route.request().isNavigationRequest()) return route.fallback();
          reads.set(club, (reads.get(club) || 0) + 1);
          await route.fulfill({ json: projection(club).filter(p => accepted || p.status === 'AO_VIVO') });
        });
        await page.route('**/partidas/solicitacoes', route => route.request().isNavigationRequest() ? route.fallback() : route.fulfill({ json: [{ ...proposal, status: accepted ? 'ACEITA' : 'PENDENTE', partida_id: accepted ? 701 : undefined }] }));
        await page.route('**/partidas/solicitacoes/schedule-proposal/responder', async route => {
          assert.equal(club, 3); assert.equal(route.request().postDataJSON().acao, 'ACEITAR');
          accepted = true; await route.fulfill({ json: { partidaId: 701 } });
        });
        await page.goto(base + '/partidas');
        await page.locator('.match-card-live').waitFor();
        assert.equal(await page.locator('.match-schedule').getAttribute('data-status'), 'TODAS', 'a existência de jogo ao vivo não deve ocultar novas partidas');
      }
      const organizer = pages[0], opponent = pages[1];
      await opponent.goto(base + '/partidas/solicitacoes');
      await opponent.getByRole('button', { name: 'Aceitar', exact: true }).click();
      const dialog = opponent.getByRole('dialog', { name: 'Aceitar proposta' });
      await dialog.getByRole('button', { name: 'Aceitar proposta', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' }); assert.equal(accepted, true);
      await opponent.getByRole('link', { name: /Voltar.*partidas/i }).click();
      await opponent.locator('.match-card').filter({ hasText: 'Agendada' }).waitFor();
      const before = reads.get(2);
      await organizer.evaluate(() => window.dispatchEvent(new Event('ludora:public-matches-changed')));
      await organizer.locator('.match-card').filter({ hasText: 'Agendada' }).waitFor();
      assert.ok(reads.get(2) > before, 'aviso invalida a resposta anterior mesmo dentro do prazo do cache');

      for (const [i, page] of pages.entries()) {
        for (const [status, label, expected] of [['AO_VIVO', 'Ao vivo', 1], ['PROXIMAS', 'Próximas', 2], ['FINALIZADA', 'Finalizadas', 1], ['CANCELADA', 'Canceladas', 1]]) {
          await page.getByRole('tab', { name: new RegExp(label) }).click();
          await page.waitForFunction(value => document.querySelector('.match-schedule')?.dataset.status === value, status);
          assert.equal(await page.locator('.match-card').count(), expected, `${i ? 'Santos' : 'Ocian'} / ${status}`);
          assert.equal(await page.locator('.match-card .match-venue').first().innerText(), i ? 'Fora' : 'Casa');
          assert.equal(await page.getByRole('tab', { name: new RegExp(label) }).getAttribute('aria-selected'), 'true');
        }
        await page.goto(base + '/partidas?status=AGENDADA');
        await page.locator('.match-card').waitFor(); assert.equal(await page.locator('.match-card').count(), 1);
        assert.match(await page.locator('.match-card').innerText(), /Agendada/);
        await page.goto(base + '/partidas?status=PREPARADA');
        await page.locator('.match-card').waitFor(); assert.equal(await page.locator('.match-card').count(), 1);
        assert.match(await page.locator('.match-card').innerText(), /Preparada/);
        await page.goto(base + '/partidas?organizadas=clube');
        if (i) await page.getByRole('heading', { name: 'Nenhuma partida com estes filtros' }).waitFor();
        else { await page.locator('.match-card').first().waitFor(); assert.ok(await page.locator('.match-card').count() >= 3); }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sem transbordamento horizontal');
      }
      assert.deepEqual(errors, []);
      for (const context of contexts) await context.close();
      console.log(`OK ${width}px: aceite, duas agendas, cache, 5 estados, mando e organizador`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
