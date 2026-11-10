// Fluxo real da interface com HTTP simulado; nenhum chamado é enviado ao servidor.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { install } = require('./visual-fixture.cjs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5199';
const output = path.resolve(__dirname, '../../../test-results/support');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const scenario of [
      { width: 1440, height: 960, expanded: true },
      { width: 1280, height: 720, expanded: false },
      { width: 900, height: 700, expanded: true },
      { width: 390, height: 844 },
      { width: 320, height: 640 },
      { width: 1366, height: 900, visitor: true },
      { width: 390, height: 844, visitor: true },
    ]) {
      const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height }, colorScheme: scenario.width === 1440 ? 'light' : 'dark' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await install(page);
      let gets = 0, sends = 0, replies = 0;
      let ticket = { id: 'chamado-teste', assunto: 'Não consigo acessar uma partida', status: 'NOVO', criadoEm: '2026-11-09T18:00:00Z', historico: [] };
      await page.route('http://localhost:3000/suporte**', async route => {
        const req = route.request();
        if (req.method() === 'POST') {
          if (scenario.visitor) assert.equal(req.headers()['x-clube-id'], undefined, 'Visitante não deve alegar vínculo com o clube');
          else assert.equal(req.headers()['x-clube-id'], '2');
          const body = req.postDataJSON();
          assert.ok(req.headers().authorization);
          if (req.url().endsWith('/responder')) {
            replies++; ticket = { ...ticket, status: 'EM_TRIAGEM', historico: [{ motivo: body.mensagem, criadoEm: ticket.criadoEm }] };
            return route.fulfill({ json: { ok: true } });
          }
          sends++; assert.equal(body.rota, scenario.visitor ? '/clubes/3' : '/dashboard');
          assert.ok(body.requestId); assert.ok(!JSON.stringify(body).includes('token='));
          return route.fulfill({ status: 201, json: ticket });
        }
        gets++;
        await new Promise(r => setTimeout(r, 100));
        return route.fulfill({ json: req.url().endsWith('/suporte') ? [ticket] : ticket });
      });
      await page.goto(base + '/login');
      await page.evaluate(scenario => {
        const club = scenario.visitor ? { id: 3, nome: 'Santos', meuPapel: null } : { id: 2, nome: 'Ocian', meuPapel: 'ADMIN' };
        localStorage.setItem('ludora_token', 'fixture-only-token');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex Morgan', email: 'visual@example.test' }));
        localStorage.setItem('ludora_clube_id', String(club.id));
        localStorage.setItem('ludora_clube', JSON.stringify(club));
        localStorage.setItem('ludora_sidebar_expanded', String(!!scenario.expanded));
      }, scenario);
      await page.goto(base + (scenario.visitor ? '/clubes/3' : '/dashboard'));
      if (scenario.visitor) {
        await page.getByRole('button', { name: 'Menu da conta', exact: true }).click();
        await page.getByRole('button', { name: 'Suporte e ajuda', exact: true }).click();
      } else if (scenario.width <= 760) {
        await page.getByRole('button', { name: 'Mais opções de navegação' }).click();
        await page.getByRole('button', { name: 'Suporte e ajuda', exact: true }).click();
      } else {
        if (scenario.width <= 1050 && scenario.expanded) await page.getByRole('button', { name: 'Expandir navegação' }).click();
        const trigger = page.locator('.sidebar-help').getByRole('button', { name: 'Suporte e ajuda' });
        await trigger.waitFor();
        const supportBox = await trigger.boundingBox();
        const accountBox = await page.locator('.sidebar-footer').boundingBox();
        assert.ok(supportBox.y + supportBox.height <= accountBox.y + 1, 'Suporte acima do perfil');
        assert.equal(await page.locator('.sidebar-nav').getByRole('link', { name: 'Ver como visitante' }).count(), 0);
        await trigger.click();
      }
      const dialog = page.getByRole('dialog', { name: 'Suporte e ajuda', exact: true });
      await dialog.getByLabel('Assunto', { exact: true }).fill(ticket.assunto);
      assert.equal(gets, 0, 'Novo chamado não aguarda consulta do histórico');
      await dialog.getByLabel('O que aconteceu?', { exact: true }).fill('Ao abrir a partida, o sistema não mostrou os detalhes esperados.');
      const titlePosition = await dialog.locator('.support-intro').evaluate(el => el.getBoundingClientRect().top + el.closest('.modal-body').scrollTop);
      await dialog.getByRole('combobox', { name: /Tipo de ajuda/ }).click();
      await dialog.getByRole('option', { name: 'Erro no sistema', exact: true }).click();
      assert.equal(await dialog.locator('.support-intro').evaluate(el => el.getBoundingClientRect().top + el.closest('.modal-body').scrollTop), titlePosition, 'Select não empurra o formulário; rolar para alcançar o campo é permitido');
      assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Modal sem overflow horizontal');
      const modalBox = await dialog.boundingBox();
      const tabsBox = await dialog.locator('.support-tabs').boundingBox();
      const sendBox = await dialog.getByRole('button', { name: 'Enviar chamado', exact: true }).boundingBox();
      assert.ok(modalBox.x + modalBox.width - sendBox.x - sendBox.width >= 12, 'Rodapé com respiro lateral');
      assert.ok(tabsBox.width > modalBox.width * .8, 'Abas ocupam a largura útil');
      assert.equal(await dialog.locator('.support-tabs .compact-control-label').first().isVisible(), true, 'Textos das abas visíveis no mobile');
      const labelBox = await dialog.locator('.support-tabs .compact-control-label').first().boundingBox();
      assert.ok(labelBox.width > 65 && labelBox.height < 24, 'Rótulo das abas em uma linha legível');
      await page.screenshot({ path: path.join(output, `${scenario.visitor ? 'visitante' : scenario.expanded ? 'expandida' : 'compacta'}-${scenario.width}.png`) });
      await dialog.getByRole('button', { name: 'Enviar chamado', exact: true }).click();
      await dialog.getByText('Chamado enviado. Acompanhe as respostas por aqui.').waitFor();
      assert.equal(sends, 1);
      await dialog.getByLabel('Responder ao atendimento').fill('Aqui estão os passos para reproduzir o problema.');
      await dialog.getByRole('button', { name: 'Enviar resposta', exact: true }).click();
      await dialog.getByText('Resposta enviada.', { exact: true }).waitFor();
      assert.equal(replies, 1);
      await dialog.getByRole('button', { name: 'Meus chamados', exact: true }).last().click();
      await dialog.locator('.support-tickets button').first().click();
      await dialog.locator('.support-detail').waitFor();
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      assert.deepEqual(errors, [], 'Sem erros React');
      console.log(`PASS suporte ${scenario.width}px ${scenario.visitor ? 'visitante' : scenario.expanded ? 'expandida' : 'compacta'}: criar, responder, histórico e fechar`);
      // Confere que o modo público continua acessível pelo menu da conta.
      if (!scenario.visitor && scenario.width > 760) {
        await page.locator('.sidebar-footer').getByRole('button', { name: 'Menu da conta' }).click();
        await page.getByRole('link', { name: 'Ver como visitante', exact: true }).click();
        await page.waitForURL('**/clubes/2');
        await page.getByRole('button', { name: 'Menu da conta', exact: true }).click();
        await page.getByRole('link', { name: 'Voltar à gestão', exact: true }).click();
        await page.waitForURL('**/dashboard');
      }
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
