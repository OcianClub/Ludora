const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';
const output = path.resolve(__dirname, '../../../test-results/web-home');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  async function setup(width, role = 'ADMIN', initialMode = 'normal') {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 761 });
    await context.addInitScript(role => {
      localStorage.setItem('ludora_token', 'visual-test-only');
      localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex Morgan', email: 'visual@example.test' }));
      localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: role, plano: 'DEMO' }));
      localStorage.setItem('ludora_clube_id', '2');
      localStorage.setItem('ludora_tema', 'dark');
    }, role);
    const page = await context.newPage();
    const requests = [];
    const state = { mode: initialMode };
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', req => {
      if (['xhr', 'fetch'].includes(req.resourceType())) requests.push(new URL(req.url()).pathname);
    });
    await page.route('**/*', route => {
      if (['xhr', 'fetch'].includes(route.request().resourceType())) return route.abort();
      if (new URL(route.request().url()).origin !== new URL(base).origin) return route.abort();
      return route.continue();
    });
    await require('./visual-fixture.cjs').install(page);
    await page.route('**/usuarios/me', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 1, nome: 'Alex Morgan', email: 'visual@example.test', clubes: [{ id: 2, nome: 'Ocian', meuPapel: role }] }) }));
    await page.route('**/partidas/home?**', async route => {
      if (state.mode === 'fail') return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      if (state.mode === 'slow') await new Promise(resolve => setTimeout(resolve, 700));
      if (state.mode === 'empty') return route.fulfill({ contentType: 'application/json', body: '[]' });
      if (state.mode === 'long') {
        const crest = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30"><circle cx="15" cy="15" r="13" fill="#0E78FF"/></svg>');
        const match = {
          id: 106, data: '2026-10-23', horario: '19:30', status: 'AO_VIVO', emCasa: true,
          categoria: { id: 1, nome: 'sub-7', tipo: 'INICIACAO', clube_id: 2 },
          mandante: { id: 10, nome: 'Associação Esportiva de Desenvolvimento e Formação de Atletas de Praia Grande', escudo: crest },
          visitante: { id: 11, nome: 'Sociedade Esportiva e Recreativa dos Atletas de São Vicente', escudo: base + '/missing-crest.png' },
          competicao: { nome: 'Campeonato Regional de Futsal das Categorias de Formação e Desenvolvimento Esportivo da Baixada Santista' },
          gols_mandante: 12, gols_visitante: 11,
        };
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify([
          match, ...Array.from({ length: 5 }, (_, i) => ({ ...match, id: 107 + i, status: 'FINALIZADA' })),
        ]) });
      }
      if (state.mode === 'prepared') return route.fulfill({ contentType: 'application/json', body: JSON.stringify([{
        id: 106, data: '2099-10-24', horario: '19:30', status: 'PREPARADA', emCasa: true,
        categoria: { id: 1, nome: 'sub-7', tipo: 'INICIACAO', clube_id: 2 },
        mandante: { id: 10, nome: 'Ocian' }, visitante: { id: 11, nome: 'Santos' },
        gols_mandante: 0, gols_visitante: 0,
      }]) });
      return route.fallback();
    });
    await page.goto(base + '/dashboard');
    return { context, page, state, requests };
  }
  try {
    const widths = process.env.LUDORA_HOME_TEST_WIDTHS
      ? process.env.LUDORA_HOME_TEST_WIDTHS.split(',').map(Number).filter(Number.isFinite)
      : [320, 390, 768, 1024, 1366, 1920];
    for (const width of widths) {
      const { context, page, requests } = await setup(width);
      try {
        await page.getByRole('heading', { name: 'Momento da categoria' }).waitFor();
        for (const dark of [true, false]) {
          await page.evaluate(dark => {
            localStorage.setItem('ludora_tema', dark ? 'dark' : 'light');
            window.dispatchEvent(new Event('ludora:theme-change'));
          }, dark);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow ${width}`);
          assert.equal(await page.locator('.home-pager-current .home-history-match').count(), 5);
          assert.equal(await page.locator('.home-pager-current .home-history-team.is-club').count(), 5);
          assert.equal(await page.locator('.home-pager-current .home-history-match').first().locator('.home-history-score').count(), 2);
          assert.equal(await page.locator('.home-pager-current .home-history-footer').count(), 5);
          assert.equal(await page.locator('.home-category-hint').count(), 0);
          assert.equal(await page.locator('.dashboard .icon[style*="seta-dir.svg"]').count(), 0);
          const circle = await page.locator('.home-pager-current .moment-result strong').first().boundingBox();
          assert.ok(Math.abs(circle.width - circle.height) < 1);
          assert.equal(await page.locator('.home-pager-current .home-main-match').evaluate(el => getComputedStyle(el).backgroundImage), 'none');
          await page.screenshot({ path: path.join(output, `home-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true, animations: 'disabled' });
        }
        assert.ok(!requests.includes('/jogadores') && !requests.includes('/times') && !requests.includes('/partidas'));
        const initialQueries = requests.filter(path => path === '/partidas/home').length;
        const historyGap = await page.locator('.home-pager-current .home-history-list').evaluate(el => parseFloat(getComputedStyle(el).rowGap));
        assert.ok(historyGap >= 12, 'Partidas do histórico devem ter separação própria');
        assert.ok(await page.locator('.home-pager-current .home-history-team.is-club').first().evaluate(el => {
          const probe = document.createElement('span');
          probe.style.backgroundColor = 'var(--fundo-card-sec)';
          el.append(probe);
          const matches = getComputedStyle(el).backgroundColor === getComputedStyle(probe).backgroundColor;
          probe.remove();
          return matches;
        }), 'Destaque do clube deve usar superfície neutra');
        assert.equal(await page.getByText('Arraste para trocar o sub', { exact: true }).count(), 0);
        async function swipeContent(selector, direction, expected) {
          const target = page.locator(selector).first();
          await target.scrollIntoViewIfNeeded();
          const box = await target.boundingBox();
          const x = box.x + box.width / 2;
          const y = box.y + box.height / 2;
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(x + direction * 80, y, { steps: 10 });
          assert.equal(await page.locator('.home-swipe-surface').evaluate(el => el.classList.contains('is-swiping')), true);
          assert.notEqual(await page.locator('.home-pager-track').evaluate(el => getComputedStyle(el).transform), 'matrix(1, 0, 0, 1, 0, 0)');
          await page.mouse.up();
          await page.locator('.home-pager-track').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {}))));
          await page.waitForFunction(expected => document.querySelector('.home-sub-strip [aria-pressed="true"]').textContent === expected, expected);
          assert.equal(await page.locator('.home-sub-strip [aria-pressed="true"]').innerText(), expected);
          assert.equal(new URL(page.url()).pathname, '/dashboard', 'Arrastar um link não deve abrir a partida');
        }
        await swipeContent('.home-pager-current .home-main-match', 1, 'SUB-7');
        await swipeContent('.home-pager-current .home-history-match', -1, 'SUB-8');
        await swipeContent('.home-pager-current .home-section-heading', 1, 'SUB-7');
        if (width < 761) {
          await page.locator('.home-pager-current .home-main-match').scrollIntoViewIfNeeded();
          const box = await page.locator('.home-pager-current .home-main-match').boundingBox();
          const client = await context.newCDPSession(page);
          const x = box.x + box.width / 2;
          const y = box.y + Math.min(box.height / 2, 160);
          await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
          for (let step = 1; step <= 8; step++) {
            await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - step * 10, y }] });
          }
          await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await page.waitForFunction(() => document.querySelector('.home-sub-strip [aria-pressed="true"]').textContent === 'SUB-8');
          await page.locator('.home-pager-track').scrollIntoViewIfNeeded();
          await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: 500 }] });
          for (let step = 1; step <= 8; step++) {
            await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 500 - step * 15 }] });
          }
          await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          assert.equal(await page.locator('.home-sub-strip [aria-pressed="true"]').innerText(), 'SUB-8', 'Rolagem vertical não troca o sub');
          await client.detach();
          await page.getByRole('button', { name: 'SUB-8', exact: true }).focus();
          await page.keyboard.press('Home');
        }
        const controlsWidth = await page.locator('.home-controls').evaluate(el => el.getBoundingClientRect().width);
        const contentWidth = await page.locator('.content').evaluate(el => el.clientWidth - parseFloat(getComputedStyle(el).paddingLeft) - parseFloat(getComputedStyle(el).paddingRight));
        assert.ok(Math.abs(controlsWidth - contentWidth) < 1, 'Seletor deve aproveitar toda a largura do conteúdo');
        if (width >= 1100) {
          assert.equal(await page.locator('.home-pager-current .home-history-list').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 2, 'Histórico desktop deve aproveitar duas colunas');
          assert.ok((await page.locator('.home-pager-current .home-history-match').first().boundingBox()).height < 320, 'Card com dois times deve manter densidade adequada');
        }
        await page.getByRole('button', { name: 'SUB-7', exact: true }).focus();
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.locator('.home-sub-strip [aria-pressed="true"]').innerText(), 'SUB-8');
        await page.keyboard.press('End');
        assert.equal(await page.locator('.home-sub-strip [aria-pressed="true"]').innerText(), 'SUB-10');
        await page.keyboard.press('Home');
        assert.equal(await page.locator('.home-sub-strip [aria-pressed="true"]').innerText(), 'SUB-7');
        assert.equal(await page.locator('.home-sub-strip button[tabindex="0"]').count(), 1);
        const strip = await page.locator('.home-sub-strip').boundingBox();
        const startX = strip.x + strip.width / 2;
        const y = strip.y + strip.height / 2;
        await page.mouse.move(startX, y);
        await page.mouse.down();
        await page.mouse.move(startX - 65, y, { steps: 8 });
        await page.mouse.up();
        await page.waitForFunction(() => document.querySelector('.home-sub-strip [aria-pressed="true"]').textContent === 'SUB-8');
        await page.getByRole('button', { name: 'SUB-8', exact: true }).focus();
        await page.keyboard.press('Home');
        if (width < 761) {
          const client = await context.newCDPSession(page);
          await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y }] });
          for (let step = 1; step <= 8; step++) {
            await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX - step * 8, y }] });
          }
          await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await page.waitForFunction(() => document.querySelector('.home-sub-strip [aria-pressed="true"]').textContent === 'SUB-8');
          await client.detach();
          await page.getByRole('button', { name: 'SUB-8', exact: true }).focus();
          await page.keyboard.press('Home');
        }
        await page.getByRole('button', { name: 'Próxima categoria', exact: true }).click();
        assert.equal(await page.locator('.home-sub-strip [aria-pressed="true"]').innerText(), 'SUB-8');
        await page.getByRole('button', { name: 'Base', exact: true }).click();
        await page.getByRole('button', { name: 'SUB-14', exact: true }).click();
        assert.equal(await page.locator('.home-sub-strip [aria-pressed="true"]').innerText(), 'SUB-14');
        await page.getByRole('button', { name: 'Base', exact: true }).focus();
        await page.keyboard.press('ArrowLeft');
        assert.equal(await page.getByRole('button', { name: 'Iniciação', exact: true }).getAttribute('aria-pressed'), 'true');
        await page.keyboard.press('ArrowRight');
        await page.getByRole('button', { name: 'SUB-14', exact: true }).click();
        assert.equal(requests.filter(path => path === '/partidas/home').length, initialQueries, 'Trocar categoria não deve gerar consultas extras');
        await page.getByRole('link', { name: 'Ver histórico completo' }).click();
        assert.equal(new URL(page.url()).searchParams.get('status'), 'FINALIZADA');
        assert.equal(new URL(page.url()).searchParams.get('categoria_id'), '6');
        console.log(`PASS Home ${width}px: temas, histórico separado/neutro, teclado, arraste no conteúdo mouse/toque, rolagem vertical e consultas resumidas`);
      } finally { await context.close(); }
    }
    const motion = await setup(1366);
    try {
      await motion.page.locator('.home-pager-current .home-main-match').waitFor();
      const beforeQueries = motion.requests.filter(path => path === '/partidas/home').length;
      const hero = await motion.page.locator('.home-pager-current .home-main-match').boundingBox();
      const trackWidth = await motion.page.locator('.home-pager-track').evaluate(el => el.clientWidth);
      const startX = hero.x + hero.width / 2;
      const startY = hero.y + 100;
      const initialIndicator = await motion.page.locator('.home-sub-indicator').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m41);
      const nextIndicator = await motion.page.locator('.home-sub-strip button').nth(1).evaluate(el => el.offsetLeft);
      await motion.page.mouse.move(startX, startY);
      await motion.page.mouse.down();
      await motion.page.evaluate(() => {
        window.__homeDragLayoutReads = 0;
        const watch = (element, property, prototype) => {
          const get = Object.getOwnPropertyDescriptor(prototype, property).get;
          Object.defineProperty(element, property, { configurable: true, get() {
            window.__homeDragLayoutReads++;
            return get.call(this);
          } });
        };
        watch(document.querySelector('.home-pager-track'), 'clientWidth', Element.prototype);
        document.querySelectorAll('.home-sub-strip button').forEach(button => {
          for (const property of ['offsetLeft', 'offsetTop', 'offsetWidth']) watch(button, property, HTMLElement.prototype);
        });
      });
      await motion.page.mouse.move(startX - trackWidth * .3, startY, { steps: 12 });
      await motion.page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      assert.equal(await motion.page.evaluate(() => window.__homeDragLayoutReads), 0, 'Movimentos do arraste não devem consultar medidas de layout');
      const paints = await motion.page.evaluate(async ({ startX, startY, trackWidth }) => {
        const surface = document.querySelector('.home-swipe-surface');
        const track = document.querySelector('.home-pager-track');
        let writes = 0;
        const observer = new MutationObserver(records => { writes += records.length; });
        observer.observe(track, { attributes: true, attributeFilter: ['style'] });
        for (let index = 0; index < 240; index++) {
          surface.dispatchEvent(new PointerEvent('pointermove', {
            bubbles: true, pointerId: 1, isPrimary: true, pointerType: 'mouse',
            clientX: startX - trackWidth * (.29 + index / 239 * .02), clientY: startY,
          }));
        }
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        observer.disconnect();
        return writes;
      }, { startX, startY, trackWidth });
      assert.equal(paints, 1, 'Rajada de movimentos deve produzir uma única atualização visual no frame');
      assert.equal(await motion.page.evaluate(() => window.__homeDragLayoutReads), 0);
      await motion.page.mouse.move(startX - trackWidth * .3, startY);
      await motion.page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      const progress = await motion.page.locator('.home-sub-indicator').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m41);
      assert.ok(Math.abs((progress - initialIndicator) / (nextIndicator - initialIndicator) - .3) < .02, 'Azul deve acompanhar exatamente o progresso do arraste');
      assert.equal(await motion.page.locator('.home-sub-strip [aria-pressed="true"]').innerText(), 'SUB-7', 'Categoria só confirma ao soltar');
      const currentBox = await motion.page.locator('.home-pager-current').boundingBox();
      const nextBox = await motion.page.locator('.home-pager-preview[data-offset="1"]').boundingBox();
      assert.ok(Math.abs(currentBox.x + currentBox.width - nextBox.x) < 1, 'As páginas devem deslizar lado a lado, sem lacuna');
      await motion.page.screenshot({ path: path.join(output, 'home-drag-progress.png') });
      await motion.page.mouse.move(startX - 20, startY, { steps: 8 });
      await motion.page.mouse.up();
      await motion.page.locator('.home-pager-track').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {}))));
      assert.equal(await motion.page.locator('.home-sub-strip [aria-pressed="true"]').innerText(), 'SUB-7', 'Arraste curto deve retornar sem trocar');
      assert.equal(motion.requests.filter(path => path === '/partidas/home').length, beforeQueries, 'Prévia não deve buscar dados novamente');
      await motion.page.evaluate(() => { window.__homeNeighbor = document.querySelector('.home-pager-preview[data-offset="1"] .home-main-match'); });
      await motion.page.getByRole('button', { name: 'Próxima categoria', exact: true }).click();
      assert.ok(await motion.page.evaluate(() => window.__homeNeighbor === document.querySelector('.home-pager-current .home-main-match')), 'Troca deve reaproveitar o DOM da página vizinha');
      console.log('PASS desempenho do arraste: 240 eventos agrupados em 1 atualização, zero leituras de layout e reaproveitamento da página vizinha');
      assert.ok(await motion.page.locator('.home-pager-track').evaluate(el => el.getAnimations().some(animation => animation.effect.getKeyframes()[0].transform === 'translateX(100%)')), 'Conteúdo deve deslizar na direção da próxima categoria');
      assert.ok(await motion.page.locator('.home-sub-indicator').evaluate(el => el.getAnimations().some(animation => animation.transitionProperty === 'transform')), 'Destaque do seletor deve deslizar, não saltar');
      await motion.page.locator('.home-pager-track').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {}))));
      await motion.page.getByRole('button', { name: 'SUB-8', exact: true }).focus();
      await motion.page.keyboard.press('Home');
      await motion.page.locator('.home-pager-track').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {}))));
      await motion.page.emulateMedia({ reducedMotion: 'reduce' });
      const box = await motion.page.locator('.home-pager-current .home-main-match').boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await motion.page.mouse.move(x, y);
      await motion.page.mouse.down();
      await motion.page.mouse.move(x + 80, y, { steps: 8 });
      assert.equal(await motion.page.locator('.home-pager-track').evaluate(el => el.getAnimations().filter(animation =>
        animation.playState === 'running' && Number(animation.effect.getTiming().duration) > 1).length), 0,
        'Movimento reduzido não deve manter animações com duração perceptível');
      await motion.page.mouse.up();
      await motion.page.locator('.home-pager-track').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {}))));
      assert.equal(await motion.page.locator('.home-sub-strip [aria-pressed="true"]').innerText(), 'SUB-7');
      const link = motion.page.locator('.home-pager-current .home-history-match').first();
      const href = await link.getAttribute('href');
      await link.focus();
      await motion.page.keyboard.press('Enter');
      await motion.page.waitForURL(url => url.pathname === href);
      console.log('PASS movimento reduzido e abertura de partida por teclado após arraste');
    } finally { await motion.context.close(); }
    const { context, page, state } = await setup(1366);
    try {
      await page.getByRole('heading', { name: 'Momento da categoria' }).waitFor();
      state.mode = 'slow';
      const refresh = page.waitForResponse(response => new URL(response.url()).pathname === '/partidas/home');
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      assert.equal(await page.locator('.home-pager-current .home-main-match').count(), 1);
      assert.equal(await page.locator('.home-skeleton').count(), 0);
      await refresh;
      state.mode = 'fail';
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await page.getByRole('alert').waitFor();
      assert.equal(await page.locator('.home-pager-current .home-history-match').count(), 5);
      state.mode = 'normal';
      await page.getByRole('button', { name: 'Tentar novamente' }).click();
      await page.getByRole('alert').waitFor({ state: 'detached' });
      console.log('PASS atualização e falha preservam cards e histórico; recuperação sem apagar a tela');
    } finally { await context.close(); }
    for (const mode of ['empty', 'fail']) {
      const { context, page } = await setup(390, 'TORCEDOR', mode);
      try {
        await page.locator('.home-skeleton').waitFor({ state: 'detached' });
        if (mode === 'fail') await page.getByRole('alert').waitFor();
        else await page.locator('.home-pager-current').getByText('Seu próximo jogo aparece aqui').waitFor();
        assert.equal(await page.locator('.home-pager-current .home-main-match').count(), 0);
        console.log(`PASS estado inicial ${mode}`);
      } finally { await context.close(); }
    }
    for (const role of ['ADMIN', 'TORCEDOR']) {
      const { context, page } = await setup(390, role, 'prepared');
      try {
        await page.locator('.home-pager-current .home-main-match').waitFor();
        assert.equal(await page.locator('.home-pager-current .home-preparation').count(), role === 'ADMIN' ? 1 : 0);
        assert.equal(await page.locator('.home-pager-current .home-versus').innerText(), 'VS');
        assert.equal(await page.locator('.home-pager-current .home-team .club-badge').first().innerText(), 'O');
        console.log(`PASS partida preparada e permissão ${role}`);
      } finally { await context.close(); }
    }
    for (const width of [320, 1366]) {
      const { context, page } = await setup(width, 'TORCEDOR', 'long');
      try {
        await page.locator('.home-pager-current .home-main-match').waitFor();
        await page.waitForFunction(() => document.querySelector('.home-pager-current .home-team:last-child .club-badge')?.textContent === 'S');
        assert.equal(await page.locator('.home-pager-current .home-team:first-child img').count(), 1);
        assert.equal(await page.locator('.home-pager-current .home-team:last-child img').count(), 0);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow com nomes longos ${width}`);
        await page.locator('.home-pager-current .home-history-match').first().focus();
        assert.ok(await page.locator('.home-pager-current .home-history-match').first().getAttribute('aria-label').then(label => label.includes('Campeonato Regional')));
        await page.screenshot({ path: path.join(output, `home-long-${width}.png`), fullPage: true });
        console.log(`PASS ${width}px: nomes longos, placar de dois dígitos, escudo válido/falho e descrição acessível`);
      } finally { await context.close(); }
    }
    assert.deepEqual(errors, []);
    console.log('PASS Home validada sem chamadas à API real.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
