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
      const players = Array.from({ length: 7 }, (_, i) => ({ id: 100 + i, nome: `Atleta ${i + 1}`, numCamisa: i === 6 ? null : i + 1, posicao: 'Fixo', categoria_id: 1 }));
      let lineup = [];
      let saves = 0, deletes = 0;
      await page.route('**/jogadores/perfis?*', route => route.fulfill({ json: players }));
      await page.route('**/partidas?*', route => route.fulfill({ json: [{ id: 106, status: 'AGENDADA', categoria_id: 1, categoria: { nome: 'sub-7' }, data: '2026-10-29', horario: '19:30', emCasa: true, mandante_id: 13, visitante_id: 14, mandante: { nome: 'Ocian' }, visitante: { nome: 'Santos' } }] }));
      await page.route('http://localhost:3000/partidas/106', route => { deletes++; return route.fulfill({ json: {} }); });
      await page.route('**/partidas/106/escalacao', route => {
        if (route.request().method() === 'PUT') lineup = route.request().postDataJSON().jogadores;
        return route.fulfill({ json: lineup });
      });
      await page.route(/\/jogadores\/10[0-6]$/, route => {
        const player = players.find(p => p.id === Number(route.request().url().split('/').pop()));
        const body = route.request().postDataJSON();
        const conflict = players.find(p => p.id !== player.id && p.numCamisa === body.numCamisa);
        if (conflict && !body.confirmar_camisa) return route.fulfill({ status: 409, json: { error: 'Camisa já utilizada', conflito_camisa: { jogador_id: conflict.id, nome: conflict.nome, camisa: body.numCamisa, categoria: 'sub-7', camisa_anterior: player.numCamisa } } });
        if (conflict) {
          assert.equal(body.confirmar_camisa.jogador_id, conflict.id);
          assert.equal(body.confirmar_camisa.camisa_anterior, player.numCamisa);
          conflict.numCamisa = player.numCamisa;
        }
        player.numCamisa = body.numCamisa;
        saves++;
        return route.fulfill({ json: player });
      });
      await require('./shared-match-fixture.cjs').install(page, { players, lineup: () => lineup });
      await page.goto('http://127.0.0.1:5187/partidas/106');
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
      await page.locator('.lineup-available summary').click();
      for (let i = 1; i <= 5; i++) await page.getByRole('button', { name: `Convocar Atleta ${i}`, exact: true }).click();
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
      await page.getByRole('button', { name: 'Revisar partida', exact: true }).click();
      assert.match(await page.locator('.preparation-footer [role="alert"]').innerText(), /camisa/);
      assert.equal(await page.locator('.preparation-review').count(), 0);
      await page.getByRole('button', { name: 'Editar camisa de Atleta 1', exact: true }).click();
      await page.getByRole('textbox', { name: 'Número da camisa', exact: true }).fill('9');
      await page.getByRole('button', { name: 'Salvar camisa', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'Convocar Atleta 7', exact: true }).click();
      await page.getByRole('button', { name: 'Revisar partida', exact: true }).click();
      await page.locator('.preparation-review').waitFor();
      assert.equal(lineup.length, 6);
      assert.equal(lineup.find(p => p.jogador_id === 100).numCamisa, 9);
      assert.equal(lineup.find(p => p.jogador_id === 106).numCamisa, 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      console.log(`Actions/shirts OK ${width}px: keyboard, delete cancellation, validation, conflict, selected player update, review`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });

