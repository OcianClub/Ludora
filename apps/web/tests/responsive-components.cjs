const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { prepare } = require('./responsive-audit.cjs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5188';
const output = path.resolve(
  __dirname,
  '../../../test-results/responsive-audit',
);

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  try {
    for (const [width, height] of [
      [320, 480],
      [600, 360],
      [820, 600],
    ]) {
      const { page, context } = await prepare(browser, width, height);
      await page.goto(base + '/dashboard', { waitUntil: 'domcontentloaded' });
      await page.evaluate(async () => {
        const [react, dom, { Choice }, { FilterSelect }, { Toast }, { Modal }] =
          await Promise.all([
            import('/node_modules/.vite/deps/react.js'),
            import('/node_modules/.vite/deps/react-dom_client.js'),
            import('/src/components/CollectionControls.tsx'),
            import('/src/components/FilterSelect.tsx'),
            import('/src/components/Toast.tsx'),
            import('/src/components/UI.tsx'),
          ]);
        const h = (react.default || react).createElement;
        const { createRoot } = dom.default || dom;
        document.getElementById('root').style.display = 'none';
        const host = document.createElement('div');
        host.style.cssText = 'padding:16px;max-width:100%;';
        document.body.append(host);
        const root = createRoot(host);
        window.renderAudit = (kind) =>
          root.render(
            kind === 'toast'
              ? h(Toast, {
                  message:
                    'Não foi possível salvar o jogador ' +
                    'Albuquerque'.repeat(16),
                  onClose() {},
                  action: { label: 'Tentar novamente', onClick() {} },
                })
              : kind === 'modal'
                ? h(
                    Modal,
                    {
                      open: true,
                      title: 'NomeDeEquipe'.repeat(18),
                      onClose() {},
                      footer: h(
                        'div',
                        null,
                        h(
                          'button',
                          { className: 'btn btn-primary btn-md' },
                          'Confirmar alterações',
                        ),
                      ),
                    },
                    h('p', null, 'albuquerque'.repeat(40)),
                  )
                : h(
                    'div',
                    {
                      style: {
                        paddingTop: `${innerHeight - 155}px`,
                        maxWidth: 260,
                      },
                    },
                    h(kind === 'choice' ? Choice : FilterSelect, {
                      label: 'Temporada',
                      value: '',
                      emptyLabel: 'Todas',
                      onChange() {},
                      options: Array.from({ length: 15 }, (_, i) => ({
                        value: `${i}`,
                        label:
                          i === 0
                            ? 'Campeonato'.repeat(12)
                            : `Temporada ${2026 - i}`,
                      })),
                    }),
                  ),
          );
      });
      for (const kind of ['choice', 'filter', 'toast', 'modal']) {
        await page.evaluate((kind) => window.renderAudit(kind), kind);
        await page.waitForTimeout(100);
        if (kind === 'choice' || kind === 'filter')
          await page
            .getByRole('button', { name: /Temporada/ })
            .or(page.getByRole('combobox', { name: /Temporada/ }))
            .click();
        await page.waitForTimeout(120);
        const result = await page.evaluate((kind) => {
          const el = document.querySelector(
            kind === 'choice'
              ? '.choice-options'
              : kind === 'filter'
                ? '.schedule-select-options'
                : kind === 'toast'
                  ? '.ludora-toast'
                  : 'dialog[open]',
          );
          const b = el.getBoundingClientRect();
          const outside =
            b.left < 0 ||
            b.right > innerWidth + 1 ||
            b.top < 0 ||
            b.bottom > innerHeight + 1;
          return {
            kind,
            outside,
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            internalOverflow: el.scrollWidth > el.clientWidth + 1,
            style: el.getAttribute('style'),
            rootTop: el.parentElement.getBoundingClientRect().top,
            scrollY,
            rect: { x: b.x, y: b.y, width: b.width, height: b.height },
          };
        }, kind);
        results.push({ width, height, ...result });
        await page.screenshot({
          path: path.join(output, `component-${width}-${kind}.png`),
        });
        if (kind === 'choice' || kind === 'filter') {
          const trigger = page.locator(
            kind === 'choice' ? '.choice-trigger' : '.schedule-select-trigger',
          );
          await trigger.focus();
          await trigger.press('ArrowDown');
          await page.keyboard.press('End');
          await page.keyboard.press('Enter');
          await page.waitForTimeout(50);
          assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
          assert.ok(
            await trigger.evaluate((el) => el === document.activeElement),
          );
        }
        await page.keyboard.press('Escape');
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(
    path.join(output, process.env.AUDIT_REPORT || 'components.json'),
    JSON.stringify(results, null, 2),
  );
  const issues = results.filter(
    (r) => r.outside || r.overflow || r.internalOverflow,
  );
  console.log(JSON.stringify({ checks: results.length, issues }, null, 2));
  assert.equal(issues.length, 0);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
