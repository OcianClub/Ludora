const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { prepare } = require('./responsive-audit.cjs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5188';
const output = path.resolve(__dirname, '../../../test-results/proposal-response');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const [width, theme] of [[320, 'dark'], [360, 'dark'], [390, 'light'], [760, 'dark'], [1440, 'dark']]) {
      const { context, page } = await prepare(browser, width, 844, theme);
      const proposal = {
        id: 'visual-proposal', tipo: 'CRIACAO', origem_id: 3, destino_id: 2, respondente_id: 2,
        status: 'PENDENTE', versao: 4, categoria_nome: 'sub-9', criado_em: '2026-11-05',
        origem: { id: 3, nome: 'Santos', escudo: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="white"/><text x="20" y="27" text-anchor="middle" font-size="24">S</text></svg>') }, destino: { id: 2, nome: 'Ocian' },
        dados: { data: '2026-11-05', horario: '22:22', local: 'Ginásio Municipal de Praia Grande — Quadra principal' },
      };
      let responses = [];
      if (width === 320) {
        proposal.origem.nome = 'Santos Associação Esportiva Comunitária de Praia Grande';
        proposal.destino.nome = 'Ocian Praia Clube Associação Esportiva de São Paulo';
      }
      let fail = true;
      let listed = [proposal];
      await page.route('**/partidas/solicitacoes', route => route.request().isNavigationRequest() ? route.fallback() : route.fulfill({ json: listed }));
      await page.route('**/partidas/solicitacoes/*/responder', async route => {
        responses.push(route.request().postDataJSON());
        await new Promise(resolve => setTimeout(resolve, 200));
        return route.fulfill({ status: fail ? 409 : 200, json: fail ? { error: 'A proposta mudou. Confira os dados antes de responder.' } : {} });
      });
      // Acesso direto: o modal não pode depender do CSS carregado pela página Partidas.
      await page.goto(base + '/partidas/solicitacoes');
      const card = page.locator('.shared-proposal');
      await card.waitFor();
      assert.equal(await card.locator('.club-badge img').count(), 1, 'Usa o escudo salvo');
      assert.equal(await card.locator('.club-badge').nth(1).innerText(), 'O', 'Sem escudo usa a inicial');
      assert.ok(await card.evaluate(el => el.scrollWidth <= el.clientWidth));
      for (const name of await card.locator('.shared-proposal-club strong').all()) {
        const textLayout = await name.evaluate(el => ({
          wrap: getComputedStyle(el).whiteSpace,
          overflow: getComputedStyle(el).textOverflow,
          clipped: el.scrollWidth > el.clientWidth,
          height: el.getBoundingClientRect().height,
          lineHeight: parseFloat(getComputedStyle(el).lineHeight),
        }));
        assert.equal(textLayout.wrap, 'nowrap');
        assert.equal(textLayout.overflow, 'ellipsis');
        assert.ok(textLayout.height <= textLayout.lineHeight + 1, 'Nome ocupa só uma linha');
        if (width === 320) assert.ok(textLayout.clipped, 'Nomes longos são truncados');
        else assert.equal(textLayout.clipped, false, 'Nomes como Santos e Ocian devem aparecer completos');
      }
      const center = await card.locator('.shared-proposal-teams').evaluate(el => {
        const clubs = [...el.querySelectorAll('.shared-proposal-club')].map(club => club.getBoundingClientRect());
        const cross = el.querySelector('.shared-proposal-versus').getBoundingClientRect();
        return Math.abs((clubs[0].right + clubs[1].left) / 2 - (cross.left + cross.right) / 2);
      });
      assert.ok(center < 1, 'O × deve ficar no centro do espaço entre os clubes');
      assert.ok(await card.locator('.shared-proposal-teams').evaluate(el => {
        const cross = el.querySelector('.shared-proposal-versus').getBoundingClientRect();
        return [...el.querySelectorAll('.shared-proposal-club')].every(club => {
          const box = club.getBoundingClientRect();
          const name = club.querySelector('strong').getBoundingClientRect();
          return Math.abs(box.right - name.right) < 1 && Math.abs((box.top + box.bottom) / 2 - (cross.top + cross.bottom) / 2) < 1;
        });
      }), 'Não sobra coluna vazia após o nome; times e × ficam na mesma linha central');
      assert.ok(await card.locator('.shared-proposal-teams').evaluate(el => Math.abs(el.firstElementChild.getBoundingClientRect().left - el.getBoundingClientRect().left) < 1), 'Times alinhados à esquerda');
      if (width <= 760) {
        assert.ok(await page.getByRole('heading', { name: 'Solicitações', exact: true }).isVisible());
        assert.equal(await page.locator('.workspace-header').isVisible(), false);
        assert.equal(await page.locator('.shared-desktop-header').isVisible(), false);
        assert.ok(await page.getByRole('button', { name: 'Filtrar solicitações', exact: true }).isVisible());
      }
      await page.screenshot({ path: path.join(output, `request-${width}-${theme}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Aceitar', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Aceitar proposta', exact: true });
      await dialog.waitFor();
      await dialog.getByText('22:22', { exact: true }).waitFor();
      const layout = await dialog.evaluate(el => {
        const rect = el.getBoundingClientRect();
        const footer = el.querySelector('.modal-footer').getBoundingClientRect();
        const buttons = [...el.querySelectorAll('.proposal-response-actions button')].map(button => {
          const box = button.getBoundingClientRect();
          return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
        });
        return { x: rect.x, right: rect.right, bottom: rect.bottom, overflow: el.scrollWidth > el.clientWidth, footer, buttons };
      });
      assert.ok(!layout.overflow && layout.x >= 0 && layout.right <= width && layout.bottom <= 844);
      assert.ok(layout.buttons.every(button => button.height >= 44 && button.right < layout.right - 10 && button.x > layout.x + 10));
      assert.ok(Math.abs(layout.buttons[0].width - layout.buttons[1].width) < 1);
      await page.screenshot({ path: path.join(output, `accept-${width}-${theme}.png`) });
      await dialog.getByRole('button', { name: 'Voltar', exact: true }).click();
      assert.equal(responses.length, 0);

      if (width === 360) {
        proposal.origem.escudo = 'data:image/png;base64,bm90YW5pbWFnZQ==';
        await page.reload();
        await card.locator('.club-badge').first().getByText('S', { exact: true }).waitFor();
        for (const action of ['Sugerir alteração', 'Recusar', 'Cancelar proposta']) {
          if (action === 'Cancelar proposta') {
            proposal.origem_id = 2;
            proposal.respondente_id = 3;
            await page.reload();
          }
          await page.getByRole('button', { name: action, exact: true }).click();
          await page.locator('.proposal-response-dialog').waitFor();
          assert.ok(await page.locator('.proposal-response-actions').isVisible());
          if (action === 'Sugerir alteração') await page.getByLabel('Local', { exact: true }).fill('Ginásio Ocian');
          await page.keyboard.press('Escape');
          assert.equal(responses.length, 0);
        }
        proposal.origem_id = 3;
        proposal.respondente_id = 2;
        await page.reload();
        await page.getByRole('button', { name: 'Aceitar', exact: true }).click();
        await dialog.getByRole('button', { name: 'Aceitar proposta', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        await page.getByText('A solicitação mudou ou já foi respondida. Confira os dados atualizados antes de continuar.', { exact: true }).waitFor();
        assert.equal(responses.length, 1);
        assert.equal(responses[0].versao, 4);
        assert.equal(responses[0].acao, 'ACEITAR');
        fail = false;
        await page.getByRole('button', { name: 'Aceitar', exact: true }).click();
        await dialog.getByRole('button', { name: 'Aceitar proposta', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(responses.length, 2);

        listed = [proposal, { ...proposal, id: 'sent', origem_id: 2, destino_id: 3, respondente_id: 3 }, { ...proposal, id: 'accepted', status: 'ACEITA' }];
        await page.reload();
        await page.locator('.shared-request-results strong').getByText('2 solicitações', { exact: true }).waitFor();
        const openFilters = () => page.getByRole('button', { name: 'Filtrar solicitações', exact: true }).click();
        const filters = page.getByRole('dialog', { name: 'Filtrar solicitações', exact: true });
        await openFilters();
        await filters.getByRole('button', { name: 'Enviadas', exact: true }).click();
        assert.equal(await page.locator('.shared-proposal').count(), 2, 'Alterações só entram ao aplicar');
        await filters.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
        assert.equal(await page.locator('.shared-proposal').count(), 1);
        assert.ok(await page.getByRole('button', { name: 'Cancelar proposta', exact: true }).isVisible());
        await openFilters();
        await filters.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.shared-proposal').count(), 1, 'Fechar sem aplicar preserva os filtros');
        await openFilters();
        await filters.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
        await filters.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
        assert.equal(await page.locator('.shared-proposal').count(), 3);
        await openFilters();
        await filters.getByRole('button', { name: 'Para responder', exact: true }).click();
        await filters.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
        assert.equal(await page.locator('.shared-proposal').count(), 1, 'Para responder inclui somente pendentes destinadas ao clube');
        listed = [];
        await page.reload();
        await page.getByRole('heading', { name: 'Nenhuma solicitação por aqui' }).waitFor();
        assert.ok(await page.locator('.shared-requests-empty > .icon').isVisible());
        assert.equal(await page.locator('.shared-requests-empty').evaluate(el => getComputedStyle(el).textAlign), 'center');
        await page.screenshot({ path: path.join(output, 'empty-360-dark.png') });
      }
      if (width === 390) {
        await page.getByRole('link', { name: 'Voltar às partidas', exact: true }).click();
        await page.waitForURL('**/partidas');
        await page.locator('.workspace-header').waitFor({ state: 'visible' });
      }
      console.log(`OK proposta: ${width}px, ${theme}`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
