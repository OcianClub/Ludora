const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { install } = require('./visual-fixture.cjs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  try {
    for (const width of [320, 820, 1440]) for (const theme of ['dark', 'light']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      try {
        await context.addInitScript(theme => {
          localStorage.setItem('ludora_token', 'visual-test-only');
          localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
          localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
          localStorage.setItem('ludora_clube_id', '2');
          localStorage.setItem('ludora_tema', theme);
        }, theme);
        await page.route('**/*', route => ['xhr','fetch'].includes(route.request().resourceType()) || new URL(route.request().url()).origin !== new URL(base).origin ? route.abort() : route.continue());
        await install(page);
        await page.goto(base + '/jogadores');
        await page.locator('.alunos-page').waitFor();
        assert.equal(await page.locator('[title]').count(), 0, 'Sem balões nativos duplicados');
        await page.getByRole('button', { name: '+ Adicionar aluno', exact: true }).hover();
        await page.waitForTimeout(600);
        if (width > 760) assert.equal(await page.getByRole('tooltip').count(), 0, 'Ação já tem texto visível');
        await page.mouse.move(width - 2, 880);
        await page.getByRole('tooltip').waitFor({ state: 'hidden' });
        assert.equal(await page.locator('.position-symbol .tooltip-target').count(), 0, 'Sem foco extra em ícone acompanhado da posição');
        const filter = width >= 1100 ? page.getByRole('button', { name: /^Definir camisa de/ }).first()
          : page.getByRole('button', { name: 'Filtros', exact: true });
        await filter.hover();
        await page.getByRole('tooltip').waitFor();
        assert.equal(await page.getByRole('tooltip').innerText(), width >= 1100 ? 'Definir número da camisa' : 'Filtros');
        await filter.click();
        await page.getByRole('tooltip').waitFor({ state: 'hidden' });
        await page.getByRole('dialog').waitFor();
        assert.equal(await page.locator('[title]').count(), 0);
        await page.getByRole('button', { name: 'Fechar janela' }).click();
        await page.waitForTimeout(600);
        assert.equal(await page.getByRole('tooltip').count(), 0, 'Não reabre depois de clicar');
        await page.evaluate(() => {
          const root = document.createElement('div');
          root.id = 'tooltip-probes';
          Object.assign(root.style, { position: 'fixed', top: '15px', left: '10px', zIndex: '9999', display: 'grid', gap: '10px', background: 'var(--fundo)', padding: '10px' });
          root.innerHTML = '<button id="tip-unmarked" aria-label="Acessibilidade preservada">Ação com texto</button>'
            + '<button id="tip-icon" data-tooltip="Explica o ícone" aria-label="Abrir ajuda" aria-describedby="existing-help">◎</button>'
            + '<span id="existing-help">Ajuda existente</span>'
            + '<button id="tip-mode" data-tooltip="Lista" data-tooltip-icon-only><span>Lista</span></button>'
            + '<button id="tip-overflow-host"><span id="tip-overflow" data-tooltip="Nome completo do clube que foi cortado" data-tooltip-overflow style="display:block;max-width:95px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">Nome completo do clube que foi cortado</span></button>'
            + '<button id="tip-short" data-tooltip="Curto" data-tooltip-overflow>Curto</button>'
            + '<button id="tip-disabled" disabled data-tooltip="Não mostrar">Indisponível</button>';
          document.body.append(root);
        });
        for (const selector of ['#tip-unmarked', '#tip-mode', '#tip-short', '#tip-disabled']) {
          await page.locator(selector).hover();
          await page.waitForTimeout(650);
          assert.equal(await page.getByRole('tooltip').count(), 0, selector + ': sem informação redundante');
        }
        const icon = page.locator('#tip-icon');
        await icon.hover();
        await page.waitForTimeout(150);
        assert.equal(await page.getByRole('tooltip').count(), 0, 'Atraso impede flashes ao cruzar controles');
        await page.getByRole('tooltip').waitFor();
        const box = await page.getByRole('tooltip').boundingBox();
        assert.ok(box.x >= 11 && box.x + box.width <= width - 11, 'Cabe no viewport');
        assert.match(await icon.getAttribute('aria-describedby'), /existing-help.*ludora-tooltip/);
        await page.getByRole('tooltip').hover();
        await page.waitForTimeout(200);
        assert.equal(await page.getByRole('tooltip').count(), 1, 'Pode passar o mouse sobre a ajuda');
        await page.mouse.move(width - 2, 880);
        await page.getByRole('tooltip').waitFor({ state: 'hidden' });
        assert.equal(await icon.getAttribute('aria-describedby'), 'existing-help');
        await page.keyboard.press('Tab');
        await icon.focus();
        await page.getByRole('tooltip').waitFor();
        await page.keyboard.press('Escape');
        await page.getByRole('tooltip').waitFor({ state: 'hidden' });
        assert.equal(await icon.evaluate(el => el === document.activeElement), true, 'Escape mantém o foco');
        await page.locator('#tip-overflow').hover();
        await page.getByRole('tooltip').waitFor();
        assert.equal(await page.getByRole('tooltip').innerText(), 'Nome completo do clube que foi cortado');
        await page.evaluate(() => { document.querySelector('#tip-overflow').style.maxWidth = '1000px'; window.dispatchEvent(new Event('resize')); });
        await page.getByRole('tooltip').waitFor({ state: 'hidden' });
        await page.mouse.move(width - 2, 880);
        await page.locator('#tip-overflow').hover();
        await page.waitForTimeout(600);
        assert.equal(await page.getByRole('tooltip').count(), 0, 'Texto completo não repete balão');
        await page.evaluate(() => {
          const dialog = document.createElement('dialog');
          dialog.innerHTML = '<button id="tip-dialog" data-tooltip="Ajuda dentro do modal">◎</button>';
          dialog.style.padding = '24px'; document.body.append(dialog); dialog.showModal();
        });
        await page.locator('#tip-dialog').hover();
        await page.getByRole('tooltip').waitFor();
        assert.ok(await page.getByRole('tooltip').evaluate(el => !!el.closest('dialog')), 'Ajuda no topo do modal');
        await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
        await page.getByRole('tooltip').waitFor({ state: 'hidden' });
        console.log(`PASS tooltips ${width}px ${theme}: sem redundância, overflow, foco, Escape, hover, cliques e modal`);
      } finally { await context.close(); }
    }
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    try {
      const page = await context.newPage();
      await page.goto(base + '/login');
      await page.getByRole('heading', { name: 'Bem-vindo de volta' }).waitFor();
      await page.evaluate(() => {
        const button = document.createElement('button'); button.id = 'touch-tip'; button.setAttribute('data-tooltip', 'Ajuda apenas no mouse'); button.setAttribute('aria-label', 'Ação acessível'); button.textContent = '◎';
        Object.assign(button.style, { position: 'fixed', top: '10px', left: '10px', width: '44px', height: '44px' }); document.body.append(button);
      });
      await page.locator('#touch-tip').tap();
      await page.waitForTimeout(700);
      assert.equal(await page.getByRole('tooltip').count(), 0, 'Toque não deixa tooltip preso');
      assert.equal(await page.locator('#touch-tip').getAttribute('aria-label'), 'Ação acessível');
      console.log('PASS touch: sem balões presos, nomes acessíveis mantidos');
    } finally { await context.close(); }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
