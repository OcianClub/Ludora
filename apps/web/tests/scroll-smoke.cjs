// Vite na porta 5187; Playwright disponível no workspace ou via NODE_PATH.
// Somente HTTP simulado, sem contas ou banco reais.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 760, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 600 }, hasTouch: width < 761 });
      try {
        await context.addInitScript(() => {
          localStorage.setItem('ludora_token', 'visual-test-only');
          localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex Morgan', email: 'visual@example.test' }));
          localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
          localStorage.setItem('ludora_clube_id', '2');
        });
        const page = await context.newPage();
        page.setDefaultTimeout(10000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => {
          if (['xhr', 'fetch'].includes(route.request().resourceType())) return route.abort();
          return new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort();
        });
        await require('./visual-fixture.cjs').install(page);
        await page.route('**/notificacoes/*/lida', route => route.fulfill({ json: { ok: true } }));
        // A ficha deve continuar liberando o scroll também no estado de erro.
        await page.route('**/jogadores/*/scout-contexto', route => route.fulfill({ status: 503, json: { error: 'offline' } }));
        await page.goto(base + '/dashboard');

        // Simula uma navegação SPA externa ao modal, como histórico/deep link.
        async function navigate(path) {
          await page.evaluate(path => {
            history.pushState({ usr: null, key: crypto.randomUUID(), idx: (history.state?.idx ?? 0) + 1 }, '', path);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }, path);
          await page.waitForURL(base + path);
          await page.locator('#main-content > div').first().waitFor();
        }
        async function unlocked(label, wheel = false) {
          await page.waitForFunction(() => !document.querySelector('dialog[open]') && document.body.style.position !== 'fixed');
          const styles = await page.evaluate(() => ({
            body: document.body.style.overflow, root: document.documentElement.style.overflow,
            top: document.body.style.top, left: document.body.style.left, width: document.body.style.width,
          }));
          assert.deepEqual(styles, { body: '', root: '', top: '', left: '', width: '' }, label);
          if (wheel) {
            await page.getByRole('heading', { name: 'Momento da categoria', exact: true }).waitFor();
            await page.waitForFunction(() => document.documentElement.scrollHeight > innerHeight);
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.mouse.move(width / 2, 400);
            await page.mouse.wheel(0, 350);
            await page.waitForFunction(() => window.scrollY > 0).catch(async error => {
              console.error(label, await page.evaluate(() => ({ y: scrollY, height: document.documentElement.scrollHeight, body: document.body.getAttribute('style'), root: document.documentElement.getAttribute('style'), target: document.elementFromPoint(innerWidth / 2, 400)?.outerHTML.slice(0, 400) })));
              throw error;
            });
            if (width < 761) {
              const cdp = await context.newCDPSession(page);
              await page.evaluate(() => window.scrollTo(0, 0));
              await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 450 }] });
              for (const y of [400, 350, 300, 250, 200]) {
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y }] });
              }
              await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
              await page.waitForFunction(() => window.scrollY > 0);
              await cdp.detach();
            }
          }
        }
        const bell = () => page.getByRole('button', { name: /^Notificações,/ });
        for (const close of ['button', 'escape', 'route', 'back', 'query-back']) {
          await navigate('/perfil');
          await navigate('/dashboard');
          if (close === 'query-back') await navigate('/dashboard?fase=BASE');
          await bell().click();
          const drawer = page.getByRole('dialog', { name: 'Notificações', exact: true });
          await drawer.waitFor();
          if (close === 'button') await drawer.getByRole('button', { name: 'Fechar janela' }).click();
          else if (close === 'escape') await page.keyboard.press('Escape');
          else if (close === 'route') await navigate('/jogadores');
          else {
            await page.goBack();
            await page.waitForURL(close === 'query-back' ? '**/dashboard' : '**/perfil');
          }
          await unlocked(`notificações: ${close}`);
          await navigate('/dashboard');
          await unlocked(`home depois de notificações: ${close}`, true);
        }
        await bell().click();
        await page.locator('.notification-row').first().click();
        await page.waitForURL('**/partidas/105');
        await unlocked('abrir partida pelo aviso');

        const cases = [
          ['/times', /Adicionar time/, 'Adicionar time'],
          ['/competicoes', /Nova competição/, 'Nova competição'],
          ['/jogadores', /^\+ Adicionar aluno$/, 'Adicionar aluno'],
          ['/membros', 'Gerenciar acesso', 'Acesso de James Walker'],
          ['/elenco', 'Mais filtros', 'Filtrar elenco'],
          ['/elenco', /^Ver ficha de /, 'Ficha do atleta'],
          ['/partidas', width < 761 ? /^Filtros/ : 'Mais filtros', width < 761 ? 'Filtrar partidas' : 'Mais filtros'],
          ['/partidas', 'Nova partida', 'Organizar partida'],
          ['/partidas/105', 'Editar partida', 'Editar partida'],
          ['/partidas/105', 'Editar placar', 'Editar placar'],
          ['/partidas/105', 'Excluir partida', 'Confirmar exclusão'],
        ];
        for (const [route, trigger, title] of cases) {
          for (const close of ['escape', 'unmount']) {
            await navigate(route);
            await page.getByRole('button', { name: trigger, exact: typeof trigger === 'string' }).filter({ visible: true }).last().click();
            await page.getByRole('dialog', { name: title, exact: true }).waitFor();
            assert.equal(await page.evaluate(() => document.body.style.position), 'fixed', title);
            if (close === 'escape') await page.keyboard.press('Escape');
            else await navigate('/dashboard');
            await unlocked(`${title}: ${close}`);
          }
        }
        await navigate('/partidas');
        await page.getByRole('button', { name: 'Nova partida', exact: true }).filter({ visible: true }).click();
        await page.getByRole('button', { name: 'Selecionar categoria da partida' }).click();
        await page.getByRole('dialog', { name: 'Categoria da partida', exact: true }).waitFor();
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => document.body.style.position), 'fixed', 'Modal pai mantém o bloqueio');
        await page.keyboard.press('Escape');
        await unlocked('fechar modais sobrepostos');
        await page.getByRole('button', { name: 'Nova partida', exact: true }).filter({ visible: true }).click();
        await page.getByRole('button', { name: 'Selecionar categoria da partida' }).click();
        await page.getByRole('dialog', { name: 'Categoria da partida', exact: true }).waitFor();
        await navigate('/dashboard');
        await unlocked('desmontar pai e filho juntos');
        if (width < 761) {
          await page.getByRole('button', { name: 'Mais opções de navegação' }).click();
          await page.setViewportSize({ width: 1024, height: 600 });
          await unlocked('fechar Mais ao mudar para desktop');
          await page.setViewportSize({ width, height: 600 });
        }
        await navigate('/dashboard');
        await unlocked('home depois de todos os modais', true);
        assert.deepEqual(errors, []);
        console.log(`PASS ${width}px: notificações, histórico, navegação SPA, modais de gestão/scout/partidas, sobreposição e ${width < 761 ? 'touch e ' : ''}wheel`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
