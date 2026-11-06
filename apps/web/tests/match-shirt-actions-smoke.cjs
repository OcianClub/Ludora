const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 820, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      await context.addInitScript(() => {
        localStorage.setItem('ludora_token', 'test');
        localStorage.setItem('ludora_tema', 'dark');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
        localStorage.setItem('ludora_clube_id', '2');
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));
      await require('./visual-fixture.cjs').install(page);
      const players = Array.from({ length: 8 }, (_, i) => ({ id: 100 + i, nome: `Atleta ${i + 1}`, numCamisa: i >= 6 ? null : i + 1, posicao: i === 1 ? 'Goleiro' : 'Fixo', categoria_id: 1 }));
      let lineup = [];
      let saves = 0, deletes = 0;
      await page.route('**/jogadores/perfis?*', route => route.fulfill({ json: players }));
      await page.route('**/jogadores?*convocacao=true*', route => route.fulfill({ json: players }));
      await page.route('**/partidas?*', route => route.fulfill({ json: [{ id: 106, status: 'AGENDADA', categoria_id: 1, categoria: { nome: 'sub-7' }, data: '2026-10-29', horario: '19:30', emCasa: true, mandante_id: 13, visitante_id: 14, mandante: { nome: 'Ocian' }, visitante: { nome: 'Santos' } }] }));
      await page.route('http://localhost:3000/partidas/106', route => { deletes++; return route.fulfill({ json: {} }); });
      await page.route('**/partidas/106/escalacao', route => {
        if (route.request().method() === 'PUT') lineup = route.request().postDataJSON().jogadores;
        return route.fulfill({ json: lineup });
      });
      await page.route(/\/jogadores\/10[0-7]$/, route => {
        const player = players.find(p => p.id === Number(route.request().url().split('/').pop()));
        const body = route.request().postDataJSON();
        assert.deepEqual(Object.keys(body).sort(), body.confirmar_camisa ? ['confirmar_camisa', 'numCamisa'] : ['numCamisa']);
        const conflict = players.find(p => p.id !== player.id && p.numCamisa === body.numCamisa);
        if (conflict && !body.confirmar_camisa) return route.fulfill({ status: 409, json: { error: 'Camisa já utilizada', conflito_camisa: { jogador_id: conflict.id, nome: conflict.nome, camisa: body.numCamisa, categoria: 'sub-7', camisa_anterior: player.numCamisa } } });
        if (conflict) {
          assert.equal(body.confirmar_camisa.jogador_id, conflict.id);
          assert.equal(body.confirmar_camisa.camisa_anterior, player.numCamisa);
          conflict.numCamisa = player.numCamisa;
        }
        player.numCamisa = body.numCamisa;
        lineup = lineup.flatMap(row => {
          const current = players.find(p => p.id === row.jogador_id);
          return current.numCamisa === null ? [] : [{ ...row, numCamisa: current.numCamisa }];
        });
        saves++;
        return route.fulfill({ json: player });
      });
      await require('./shared-match-fixture.cjs').install(page, { players, lineup: () => lineup });
      await page.goto(`${process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187'}/partidas/106`);
      const trigger = page.getByRole('button', { name: 'Ações da partida', exact: true });
      await trigger.click();
      await page.getByRole('menuitem', { name: 'Editar partida', exact: true }).waitFor();
      await page.keyboard.press('ArrowDown');
      assert.ok(await page.getByRole('menuitem', { name: 'Cancelar partida', exact: true }).evaluate(el => el === document.activeElement));
      await page.keyboard.press('Escape');
      assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
      assert.ok(await trigger.evaluate(el => el === document.activeElement));
      await trigger.click();
      await page.getByRole('menuitem', { name: 'Cancelar partida', exact: true }).click();
      await page.getByRole('dialog', { name: 'Cancelar partida' }).waitFor();
      await page.getByRole('dialog', { name: 'Cancelar partida' }).getByRole('button', { name: 'Voltar', exact: true }).click();
      assert.equal(deletes, 0);
      await page.getByRole('button', { name: 'Montar escalação', exact: true }).click();
      for (let i = 1; i <= 6; i++) await page.getByRole('button', { name: `Convocar Atleta ${i}`, exact: true }).click();
      await page.getByRole('button', { name: 'Definir camisa de Atleta 7', exact: true }).click();
      await page.getByRole('textbox', { name: 'Número da camisa', exact: true }).fill('100');
      await page.getByRole('button', { name: 'Salvar camisa', exact: true }).click();
      assert.equal(saves, 0);
      await page.getByRole('textbox', { name: 'Número da camisa', exact: true }).fill('1');
      await page.getByRole('button', { name: 'Salvar camisa', exact: true }).click();
      await page.getByRole('dialog', { name: 'Confirmar troca de camisas' }).waitFor();
      assert.equal(players[0].numCamisa, 1);
      await page.getByRole('button', { name: 'Confirmar troca', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      assert.equal(saves, 1);
      assert.equal(players[0].numCamisa, null);
      assert.equal(await page.getByRole('button', { name: 'Salvar e revisar', exact: true }).isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: 'Remover Atleta 1 da escalação', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Definir camisa de Atleta 1', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Editar camisa de Atleta 7', exact: true }).innerText(), '01');
      assert.match(await page.locator('.preparation-footer').innerText(), /Falta selecionar 1 titular/);
      assert.equal(await page.locator('.preparation-review').count(), 0);
      await page.getByRole('button', { name: 'Definir camisa de Atleta 1', exact: true }).click();
      await page.getByRole('textbox', { name: 'Número da camisa', exact: true }).fill('9');
      await page.getByRole('button', { name: 'Salvar camisa', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'Convocar Atleta 7', exact: true }).click();
      await page.getByRole('button', { name: 'Convocar Atleta 1', exact: true }).click();
      // Trocar duas camisas válidas mantém ambos convocados, sem alterar titular/reserva.
      await page.getByRole('button', { name: 'Editar camisa de Atleta 6', exact: true }).click();
      await page.getByRole('textbox', { name: 'Número da camisa', exact: true }).fill('9');
      await page.getByRole('button', { name: 'Salvar camisa', exact: true }).click();
      await page.getByRole('button', { name: 'Confirmar troca', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'Definir camisa de Atleta 8', exact: true }).click();
      await page.getByRole('textbox', { name: 'Número da camisa', exact: true }).fill('06');
      await page.getByRole('button', { name: 'Salvar camisa', exact: true }).click();
      await page.getByRole('button', { name: 'Confirmar troca', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      assert.equal(await page.getByRole('button', { name: 'Remover Atleta 1 da escalação', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Definir camisa de Atleta 1', exact: true }).waitFor();
      // Troca titular/reserva pelo teclado e por arraste preserva as cinco vagas.
      const row = id => page.locator(`[data-lineup-id="${id}"]`);
      const swapStarter = page.getByRole('button', { name: 'Trocar Atleta 7', exact: true });
      await swapStarter.focus();
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Trocar com Atleta 6', exact: true }).focus();
      await page.keyboard.press('Enter');
      assert.equal(await row(106).getAttribute('data-lineup-role'), 'reserva');
      assert.equal(await row(105).getAttribute('data-lineup-role'), 'titular');
      const source = page.getByRole('button', { name: 'Trocar Atleta 6', exact: true });
      const target = page.getByRole('button', { name: 'Trocar Atleta 7', exact: true });
      await source.scrollIntoViewIfNeeded();
      await target.scrollIntoViewIfNeeded();
      const a = await source.boundingBox(), b = await target.boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
      await page.mouse.up();
      assert.equal(await row(106).getAttribute('data-lineup-role'), 'titular');
      assert.equal(await row(105).getAttribute('data-lineup-role'), 'reserva');
      // Cinco titulares sem goleiro não liberam a revisão, mesmo com camisas válidas.
      await page.getByRole('button', { name: 'Trocar Atleta 2', exact: true }).click();
      await page.getByRole('button', { name: 'Trocar com Atleta 6', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Salvar e revisar', exact: true }).isDisabled(), true);
      await page.getByRole('button', { name: 'Trocar Atleta 2', exact: true }).click();
      await page.getByRole('button', { name: 'Trocar com Atleta 6', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Salvar e revisar', exact: true }).isEnabled(), true);
      await page.getByRole('button', { name: 'Salvar e revisar', exact: true }).click();
      await page.locator('.preparation-review').waitFor();
      assert.equal(lineup.length, 6);
      assert.equal(lineup.some(p => p.jogador_id === 100), false);
      assert.equal(lineup.find(p => p.jogador_id === 105).numCamisa, 9);
      assert.equal(lineup.find(p => p.jogador_id === 105).titular, false);
      assert.equal(lineup.find(p => p.jogador_id === 106).numCamisa, 1);
      assert.equal(lineup.find(p => p.jogador_id === 106).titular, true);
      assert.equal(lineup.filter(p => p.titular).length, 5);
      page.on('dialog', dialog => dialog.dismiss());
      await page.reload();
      await page.locator('.preparation-review').waitFor();
      assert.equal(await page.getByText('Atleta 1', { exact: true }).count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      console.log(`Actions/shirts OK ${width}px: keyboard, delete cancellation, validation, conflict, selected player update, review`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });

