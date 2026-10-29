const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';
const output = path.resolve(__dirname, '../../../test-results/web-notifications');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  async function setup(width) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 761, timezoneId: 'America/Sao_Paulo' });
    await context.addInitScript(() => {
      localStorage.setItem('ludora_token', 'visual-test-only');
      localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex Morgan' }));
      localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
      localStorage.setItem('ludora_clube_id', '2');
      localStorage.setItem('ludora_tema', 'dark');
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      if (['xhr', 'fetch'].includes(route.request().resourceType())) return route.abort();
      return new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort();
    });
    await require('./visual-fixture.cjs').install(page);
    const state = {
      fail: false, calls: [],
      rows: Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - Math.floor(i / 3));
        date.setHours(18, 10 - i, 0, 0);
        return { id: i + 1, tipo: ['GOL_PARTIDA', 'PARTIDA_AGENDADA', 'RESULTADO_PARTIDA'][i % 3],
          titulo: ['Gol do Ocian sub-7!', 'Nova partida marcada', 'Vitória!'][i % 3] + ` ${i + 1}`,
          corpo: 'Informações do clube com uma descrição maior para conferir leitura e alinhamento.',
          lida: i % 3 === 1, partida_id: 105, criada_em: date.toISOString() };
      }),
    };
    await page.route('**/notificacoes**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      state.calls.push({ path: url.pathname, method, club: request.headers()['x-clube-id'] });
      if (method === 'GET') {
        const cursor = Number(url.searchParams.get('cursor'));
        const index = cursor ? state.rows.findIndex(item => item.id === cursor) + 1 : 0;
        const rows = state.rows.slice(index, index + 3);
        const body = JSON.stringify({ notificacoes: rows,
          totalNaoLidas: state.rows.filter(item => !item.lida).length,
          proximoCursor: index + 3 < state.rows.length ? rows.at(-1).id : null });
        if (state.pauseGet) await new Promise(resolve => { state.releaseGet = resolve; state.onPaused?.(); });
        return route.fulfill({ contentType: 'application/json', body });
      }
      if (state.fail) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline"}' });
      if (method === 'PATCH') state.rows = state.rows.map(item => url.pathname === '/notificacoes/lidas' || url.pathname === `/notificacoes/${item.id}/lida` ? { ...item, lida: true } : item);
      if (method === 'DELETE') state.rows = state.rows.filter(item => url.pathname === '/notificacoes' ? false : url.pathname === '/notificacoes/lidas' ? !item.lida : url.pathname !== `/notificacoes/${item.id}`);
      return route.fulfill({ contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.goto(base + '/dashboard');
    await page.getByRole('button', { name: /^Notificações,/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Notificações', exact: true });
    await dialog.locator('.notification-row').first().waitFor();
    await dialog.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    return { context, page, state, dialog };
  }

  try {
    for (const width of [320, 390, 1366]) {
      const { context, page, state, dialog } = await setup(width);
      try {
        assert.equal(await dialog.locator('.notification-row').count(), 3);
        assert.equal(await dialog.getByRole('heading', { name: 'Hoje', exact: true }).count(), 1);
        const notificationArea = width <= 760 ? '.workspace-actions' : '.sidebar-footer';
        assert.equal(await page.locator(`${notificationArea} .notifications-trigger`).count(), 1);
        assert.equal(await page.locator('.notifications-trigger').count(), 1, 'Apenas uma instância consulta os avisos');
        const header = await dialog.locator('.modal-header-tools').evaluate(el => [...el.children].map(child => child.getBoundingClientRect().y));
        assert.ok(Math.abs(header[0] - header[1]) < 1, 'Ações alinhadas no cabeçalho');
        assert.equal(await dialog.locator('.notification-kind-icon').count(), 3);
        await dialog.getByRole('button', { name: 'Não lidas', exact: true }).click();
        assert.equal(await dialog.locator('.notification-row').count(), 2);
        await dialog.getByRole('combobox', { name: 'Tipo de aviso' }).click();
        await dialog.getByRole('option', { name: 'Gol', exact: true }).click();
        assert.equal(await dialog.locator('.notification-row').count(), 1);
        await dialog.getByRole('combobox', { name: 'Tipo de aviso' }).click();
        await dialog.getByRole('option', { name: 'Todos os tipos', exact: true }).click();
        await dialog.getByRole('button', { name: 'Todas', exact: true }).click();
        await dialog.getByRole('button', { name: 'Carregar mais avisos' }).click();
        await page.waitForFunction(() => document.querySelectorAll('.notification-row').length === 6);
        assert.equal(await dialog.getByRole('heading', { name: 'Ontem', exact: true }).count(), 1);
        assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), 'Sem overflow horizontal');
        await page.screenshot({ path: path.join(output, `notifications-${width}-dark.png`), animations: 'disabled' });
        const first = state.rows[0];
        state.fail = true;
        await dialog.locator('.notification-card').first().hover();
        await dialog.getByRole('button', { name: `Excluir notificação: ${first.titulo}`, exact: true }).click();
        await dialog.getByRole('alert').waitFor();
        assert.equal(await dialog.locator('.notification-row').count(), 6, 'Falha não remove o aviso');
        state.fail = false;
        const card = dialog.locator('.notification-card').first();
        await card.scrollIntoViewIfNeeded();
        const box = await card.boundingBox();
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x - 130, y, { steps: 10 });
        await page.mouse.up();
        await page.waitForFunction(() => document.querySelectorAll('.notification-row').length === 5);
        assert.equal(new URL(page.url()).pathname, '/dashboard', 'Swipe não abre a partida');
        assert.ok(!state.rows.some(item => item.id === first.id));
        if (width < 761) {
          const nextCard = dialog.locator('.notification-card').first();
          await nextCard.scrollIntoViewIfNeeded();
          const rect = await nextCard.boundingBox();
          const touch = await context.newCDPSession(page);
          const touchX = rect.x + rect.width / 2;
          const touchY = rect.y + rect.height / 2;
          const removedId = state.rows[0].id;
          await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchX, y: touchY }] });
          for (let step = 1; step <= 12; step++) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchX - step * 10, y: touchY }] });
          await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await page.waitForFunction(() => document.querySelectorAll('.notification-row').length === 4);
          assert.ok(!state.rows.some(item => item.id === removedId), 'Swipe de toque exclui o aviso');
          await touch.detach();
        }
        await dialog.getByLabel('Ações das notificações').click();
        await dialog.getByRole('button', { name: 'Excluir avisos lidos', exact: true }).click();
        await dialog.getByRole('button', { name: 'Confirmar exclusão', exact: true }).click();
        await dialog.getByRole('alert', { name: 'Confirmar limpeza' }).waitFor({ state: 'detached' });
        assert.ok(state.rows.every(item => !item.lida));
        await dialog.getByLabel('Ações das notificações').click();
        await dialog.getByRole('button', { name: 'Marcar todas como lidas' }).click();
        await page.waitForFunction(() => document.querySelector('.notifications-trigger').getAttribute('aria-label') === 'Notificações, 0 não lidas');
        assert.ok(state.rows.every(item => item.lida));
        await dialog.getByLabel('Ações das notificações').click();
        await dialog.getByRole('button', { name: 'Excluir todas as notificações', exact: true }).click();
        await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
        assert.ok(state.rows.length > 0, 'Cancelar preserva o histórico');
        await page.evaluate(() => { localStorage.setItem('ludora_tema', 'light'); window.dispatchEvent(new Event('ludora:theme-change')); });
        await page.screenshot({ path: path.join(output, `notifications-${width}-light.png`), animations: 'disabled' });
        await dialog.getByLabel('Ações das notificações').click();
        await dialog.getByRole('button', { name: 'Excluir todas as notificações', exact: true }).click();
        await dialog.getByRole('button', { name: 'Confirmar exclusão', exact: true }).click();
        await dialog.getByRole('heading', { name: 'Nenhuma notificação por enquanto' }).waitFor();
        assert.equal(state.rows.length, 0);
        assert.ok(state.calls.every(call => call.club === '2'));
        console.log(`PASS ${width}px: filtros, datas, paginação, chevron, erro, swipe, limpar lidas/tudo, leitura e confirmação`);
      } finally { await context.close(); }
    }
    const race = await setup(1366);
    try {
      await race.dialog.getByRole('button', { name: 'Fechar janela', exact: true }).click();
      await race.dialog.waitFor({ state: 'hidden' });
      race.state.pauseGet = true;
      const paused = new Promise(resolve => { race.state.onPaused = resolve; });
      await race.page.getByRole('button', { name: /^Notificações,/ }).click();
      await paused;
      await race.dialog.locator('.notification-card').first().hover();
      await race.dialog.getByRole('button', { name: `Excluir notificação: ${race.state.rows[0].titulo}`, exact: true }).click();
      await race.page.waitForFunction(() => document.querySelectorAll('.notification-row').length === 2);
      const resumed = race.page.waitForResponse(response => new URL(response.url()).pathname === '/notificacoes' && response.request().method() === 'GET');
      race.state.pauseGet = false;
      race.state.releaseGet();
      await resumed;
      await race.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await race.dialog.locator('.notification-row').count(), 2, 'Resposta antiga não restaura um aviso já excluído');
      console.log('PASS atualização concorrente não ressuscita aviso excluído');
    } finally { await race.context.close(); }
    assert.deepEqual(errors, []);
    console.log('PASS notificações sem banco, e-mail ou push reais.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
