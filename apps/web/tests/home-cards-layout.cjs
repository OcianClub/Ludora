const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { install } = require('./visual-fixture.cjs');

const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';
const output = path.resolve(__dirname, '../../../test-results/home-cards-layout');
const crest = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#0E78FF"/></svg>');
const category = { id: 1, nome: 'sub-7', tipo: 'INICIACAO', clube_id: 2 };

function matches(mode) {
  if (mode === 'empty') return [];
  const long = mode === 'long';
  const match = {
    id: 106, data: '2026-10-29', horario: '19:30', status: 'AO_VIVO', emCasa: false,
    categoria: category, categoria_id: category.id, gols_mandante: 12, gols_visitante: 11,
    mandante: { id: 10, nome: long ? 'Associacao Esportiva de Desenvolvimento e Formacao de Atletas de Praia Grande' : 'Santos', escudo: crest },
    visitante: { id: 11, nome: long ? 'Sociedade Esportiva e Recreativa dos Atletas de Sao Vicente' : 'Ocian', escudo: null },
    local: long ? 'Ginasio Municipal de Esportes e Desenvolvimento de Atletas da Baixada Santista, Rua dos Esportes, 1000' : 'Ginasio Ocian',
    competicao: { nome: long ? 'Campeonato Regional de Futsal das Categorias de Formacao e Desenvolvimento Esportivo da Baixada Santista' : 'Copa de Futsal' },
    somente_leitura: false,
  };
  if (mode === 'prepared') return [{ ...match, status: 'PREPARADA', data: '2099-10-29' }];
  const history = Array.from({ length: 5 }, (_, i) => ({ ...match, id: 107 + i, status: 'FINALIZADA', data: `2026-10-${20 - i}` }));
  return [match, ...(mode === 'extras' ? [{ ...match, id: 120 }] : []), ...history];
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  let checked = 0;
  async function check(width, role, mode = 'normal', theme = 'dark') {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: width <= 760 });
    try {
      await context.addInitScript(({ role, theme }) => {
        localStorage.setItem('ludora_token', 'visual-test-only');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex Morgan', email: 'visual@example.test' }));
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: role, plano: 'DEMO' }));
        localStorage.setItem('ludora_clube_id', '2');
        localStorage.setItem('ludora_tema', theme);
      }, { role, theme });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        if (['xhr', 'fetch'].includes(route.request().resourceType())) return route.abort();
        if (new URL(route.request().url()).origin !== new URL(base).origin) return route.abort();
        return route.continue();
      });
      await install(page, { role });
      await page.route('**/partidas/home?**', route => route.fulfill({ json: matches(mode) }));
      await page.goto(base + '/dashboard');
      await page.locator('.home-moment .category-moment').waitFor();
      await page.evaluate(() => document.fonts.ready);
      if (role === 'ADMIN') await page.locator('.home-pending-items').waitFor();
      const name = `${width}-${role}-${mode}-${theme}`;
      const pageFits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
      if (!pageFits) {
        console.log(await page.evaluate(() => [...document.querySelectorAll('.dashboard *')].map(el => ({ tag: el.tagName, cls: el.className, right: el.getBoundingClientRect().right, width: el.getBoundingClientRect().width })).filter(el => el.right > innerWidth + 1).slice(0, 20)));
        await page.screenshot({ path: path.join(output, `overflow-${name}.png`), fullPage: true });
      }
      assert.ok(pageFits, `Overflow: ${name}`);
      assert.equal(await page.locator('.home-pending').count(), role === 'ADMIN' ? 1 : 0, `Role: ${name}`);
      const main = page.locator(mode === 'empty' ? '.home-feature > .home-empty' : '.home-main-match');
      const side = page.locator(role === 'ADMIN' ? '.home-pending-card' : '.category-moment');
      const [a, b] = await Promise.all([main.boundingBox(), side.boundingBox()]);
      if (width > 760) {
        assert.ok(Math.abs(a.y - b.y) < 1, `Card tops: ${name}: ${a.y}/${b.y}`);
        assert.ok(Math.abs(a.height - b.height) < 1, `Card heights: ${name}: ${a.height}/${b.height}`);
        assert.ok(b.x > a.x + a.width, `Side by side: ${name}`);
        if (role === 'ADMIN') {
          const upcoming = await page.locator('.home-upcoming-card').boundingBox();
          const moment = await page.locator('.category-moment').boundingBox();
          assert.ok(Math.abs(upcoming.y - moment.y) < 1, `Secondary card tops: ${name} ${upcoming.y}/${moment.y}`);
          assert.ok(Math.abs(upcoming.height - moment.height) < 1, `Secondary card heights: ${name}`);
        }
      } else {
        assert.ok(b.y >= a.y + a.height, `Stacked: ${name}`);
        if (role !== 'ADMIN') assert.ok(b.height < 270, `Natural mobile moment height: ${name}`);
      }
      for (const selector of ['.home-main-match', '.home-pending-card', '.category-moment']) {
        if (!await page.locator(selector).count()) continue;
        const overflow = await page.locator(selector).evaluate(el => {
          const card = el.getBoundingClientRect();
          return [...el.querySelectorAll('a, strong, small, .club-badge, .home-match-venue, .home-match-location')]
            .filter(child => child.getClientRects().length && getComputedStyle(child).position !== 'absolute')
            .some(child => { const r = child.getBoundingClientRect(); return r.left < card.left - 1 || r.right > card.right + 1 || r.bottom > card.bottom + 1; });
        });
        assert.equal(overflow, false, `Card content overflow: ${name} ${selector}`);
      }
      if (mode !== 'empty') {
        assert.equal(await page.locator('.home-team.is-club').count(), 1);
        assert.equal(await page.locator('.home-team.is-club .club-badge').innerText(), mode === 'long' ? 'S' : 'O', 'Initial without crest');
        assert.equal(await page.locator('.home-main-match .club-badge img').count(), 1, 'Saved crest');
        assert.ok(await page.locator('.home-match-cta').getAttribute('href') === '/partidas/106');
        await page.locator('.home-match-cta').focus();
        assert.ok(await page.locator('.home-match-cta').evaluate(el => el === document.activeElement), 'Keyboard CTA focus');
      }
      if (mode === 'normal') {
        assert.equal(await page.locator('.moment-result').count(), 5);
        assert.equal(await page.locator('.home-history-table tbody tr').count(), 5);
        assert.ok((await page.getByRole('link', { name: 'Ver agenda', exact: true }).getAttribute('href')).includes('status=PROXIMAS'));
      }
      if (mode === 'extras') assert.equal(await page.locator('.home-extra-live a').count(), 1);
      if (mode === 'prepared' && role === 'ADMIN') assert.equal(await page.locator('.home-preparation').count(), 1);
      if ([390, 1366].includes(width) && ['normal', 'long'].includes(mode)) {
        await page.locator('.home-match-cta').evaluate(el => el.blur());
        await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
      }
      checked++;
    } finally {
      await context.close();
    }
  }
  try {
    for (const width of [320, 360, 390, 768, 1024, 1366, 1920]) {
      for (const role of ['ADMIN', 'TORCEDOR']) await check(width, role);
    }
    for (const mode of ['long', 'empty', 'extras', 'prepared']) {
      for (const width of [320, 768, 1366]) {
        for (const role of ['ADMIN', 'TORCEDOR']) await check(width, role, mode);
      }
    }
    for (const role of ['ADMIN', 'TORCEDOR']) await check(1366, role, 'normal', 'light');
    assert.deepEqual(errors, [], 'Browser runtime errors');
    console.log(`Home cards: ${checked} scenarios passed; desktop/tablet/mobile, roles, themes, empty/long/multiple/prepared matches.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
