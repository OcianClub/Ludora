const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { install } = require('./visual-fixture.cjs');

const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5188';
const output = path.resolve(
  __dirname,
  '../../../test-results/responsive-audit',
);
const routes = [
  '/login',
  '/registrar',
  '/recuperar-senha',
  '/convite',
  '/selecionar-clube',
  '/dashboard',
  '/partidas',
  '/partidas/solicitacoes',
  '/partidas/106',
  '/jogadores',
  '/jogadores/101',
  '/jogadores/101/partidas',
  '/jogadores/101/campeonatos',
  '/elenco',
  '/times',
  '/competicoes',
  '/membros',
  '/perfil',
  '/clube',
];
const sizes = process.env.AUDIT_WIDTHS
  ? process.env.AUDIT_WIDTHS.split(',').map((w) => [Number(w), 900])
  : [
      [320, 740],
      [360, 780],
      [390, 844],
      [480, 800],
      [600, 900],
      [768, 1024],
      [820, 900],
      [1024, 768],
      [1180, 720],
      [1366, 768],
      [1440, 900],
      [1920, 1080],
      [2560, 1080],
      [844, 390],
    ];

async function prepare(
  browser,
  width,
  height,
  theme = 'dark',
  { longContent = false, role = 'ADMIN', clubeNome = 'Ocian' } = {},
) {
  const context = await browser.newContext({
    viewport: { width, height },
    hasTouch: width <= 760,
    reducedMotion: 'reduce',
    colorScheme: theme,
  });
  await context.addInitScript(
    ({ theme, role, clubeNome }) => {
      localStorage.setItem('ludora_token', 'responsive-test-only');
      localStorage.setItem(
        'ludora_usuario',
        JSON.stringify({
          id: 1,
          nome: 'Alex Morgan',
          email: 'visual@example.test',
        }),
      );
      localStorage.setItem(
        'ludora_clube',
        JSON.stringify({ id: 2, nome: clubeNome, meuPapel: role }),
      );
      localStorage.setItem('ludora_clube_id', '2');
      localStorage.setItem('ludora_tema', theme);
    },
    { theme, role, clubeNome },
  );
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.route('**/*', (route) => {
    if (['xhr', 'fetch'].includes(route.request().resourceType()))
      return route.abort();
    return new URL(route.request().url()).origin === new URL(base).origin
      ? route.continue()
      : route.abort();
  });
  let data;
  await install(page, {
    role,
    decorate: (fixture) => {
      data = fixture;
      fixture.clubes[0].nome = clubeNome;
      if (longContent) {
        fixture.clubes[0].nome =
          'Associação Esportiva Comunitária de Praia Grande';
        fixture.usuario.nome = 'Alexandre Henrique dos Santos de Albuquerque';
        fixture.usuario.email = 'alexandre.henrique.albuquerque@exemplo.test';
        fixture.times.forEach((time) => {
          time.nome += ' Associação Esportiva Comunitária';
        });
        fixture.jogadores.forEach((player) => {
          player.nome += ' Henrique dos Santos de Albuquerque';
        });
        fixture.competicoes.forEach((competition) => {
          competition.nome += ' Campeonato Regional das Categorias de Formação';
        });
      }
    },
    onUnknown: (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/times/contexto')
        return route.fulfill({ json: [] });
      if (url.pathname.startsWith('/convites'))
        return route.fulfill({ json: { convites: [] } });
      if (url.pathname.includes('preferencias'))
        return route.fulfill({ json: { preferencias: [] } });
      return route.fulfill({
        status: 404,
        json: { error: 'Registro indisponível no cenário de teste' },
      });
    },
  });
  await require('./shared-match-fixture.cjs').install(page, {
    players: data.jogadores,
    lineup: () =>
      data.jogadores
        .filter((p) => p.categoria_id === 1 && p.numCamisa)
        .map((p, i) => ({
          jogador_id: p.id,
          numCamisa: p.numCamisa,
          titular: i < 5,
        })),
  });
  return { page, context, data };
}

async function inspect(page) {
  return page.evaluate(() => {
    const withinScroller = (el) => {
      for (
        let parent = el.parentElement;
        parent && parent !== document.body;
        parent = parent.parentElement
      ) {
        const style = getComputedStyle(parent);
        if (
          ['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX) &&
          parent.scrollWidth > parent.clientWidth + 1
        )
          return true;
      }
      return false;
    };
    const outside = [
      ...document.querySelectorAll(
        'h1,h2,h3,button,input,select,textarea,article,dialog[open]',
      ),
    ]
      .filter(
        (el) =>
          el.checkVisibility({
            checkOpacity: true,
            checkVisibilityCSS: true,
          }) && !el.closest('[inert],[aria-hidden="true"]'),
      )
      .filter((el) => {
        const box = el.getBoundingClientRect();
        return (
          box.width > 0 &&
          box.height > 0 &&
          box.bottom > 0 &&
          box.top < innerHeight &&
          (box.left < -2 || box.right > innerWidth + 2) &&
          !withinScroller(el)
        );
      })
      .slice(0, 10)
      .map((el) => ({
        tag: el.tagName,
        class: el.className,
        text: (el.textContent || el.getAttribute('placeholder') || '')
          .trim()
          .slice(0, 65),
      }));
    const sidebar = document.querySelector('.sidebar');
    const workspace = document.querySelector('.workspace');
    const occluded =
      sidebar?.checkVisibility() &&
      workspace &&
      sidebar.getBoundingClientRect().right >
        workspace.getBoundingClientRect().left + 1;
    const modal = document.querySelector('dialog[open]');
    const box = modal?.getBoundingClientRect();
    const modalOutside =
      box &&
      (box.top < -1 ||
        box.bottom > innerHeight + 1 ||
        box.left < -1 ||
        box.right > innerWidth + 1);
    return {
      overflow:
        document.documentElement.scrollWidth > innerWidth + 1 || !!occluded,
      outside,
      modalOutside: !!modalOutside,
      mainWidth: document
        .querySelector('.workspace-content')
        ?.getBoundingClientRect().width,
    };
  });
}

async function snapshot(page, label, results, screen) {
  const issues = await inspect(page);
  results.push({ ...screen, state: label, ...issues });
  if (
    issues.overflow ||
    issues.outside.length ||
    issues.modalOutside ||
    process.env.AUDIT_SCREENSHOTS === 'all'
  ) {
    await page.screenshot({
      path: path.join(
        output,
        `${screen.width}-${screen.height}-${screen.route.replace(/\W+/g, '-')}-${label}.png`,
      ),
    });
  }
}

async function run() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  const failures = [];
  try {
    const queue = [...sizes];
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (queue.length) {
          const [width, height] = queue.shift();
          const { page, context } = await prepare(
            browser,
            width,
            height,
            process.env.AUDIT_THEME || 'dark',
            { longContent: process.env.AUDIT_LONG === '1' },
          );
          page.on('pageerror', (error) =>
            failures.push({ width, height, error: error.message }),
          );
          for (const route of routes) {
            const screen = { width, height, route };
            try {
              await page.goto(base + route, {
                waitUntil: 'domcontentloaded',
                timeout: 30000,
              });
              await page
                .locator('.route-loading, .loading-skeleton, .route-skeleton')
                .first()
                .waitFor({ state: 'hidden' });
              await page.waitForTimeout(160);
              if (process.env.AUDIT_EXPANDED === '1' && width > 760) {
                const expand = page.getByRole('button', {
                  name: 'Expandir navegação',
                  exact: true,
                });
                if (await expand.count()) await expand.click();
              }
              await snapshot(page, 'page', results, screen);
              await page.evaluate(() =>
                scrollTo(0, document.documentElement.scrollHeight),
              );
              await snapshot(page, 'bottom', results, screen);
              await page.evaluate(() => scrollTo(0, 0));
              if (
                [
                  '/jogadores',
                  '/partidas',
                  '/competicoes',
                  '/times',
                  '/membros',
                ].includes(route)
              ) {
                const add = page
                  .getByRole('button', {
                    name: /^(\+ Adicionar aluno|Adicionar jogador|Novo jogador|Nova partida|Organizar partida|\+ Nova competição|Adicionar time|Novo time|Convidar pessoa|Convidar)$/,
                  })
                  .filter({ visible: true })
                  .first();
                if (await add.count()) {
                  await add.click();
                  await page.getByRole('dialog').first().waitFor();
                  await snapshot(page, 'create-dialog', results, screen);
                  const choice = page
                    .getByRole('dialog')
                    .last()
                    .locator('[aria-expanded="false"]')
                    .filter({ visible: true })
                    .first();
                  if (await choice.count()) {
                    await choice.click();
                    await snapshot(page, 'create-options', results, screen);
                  }
                  await page.keyboard.press('Escape');
                  await page.keyboard.press('Escape');
                }
              }
              if (width > 760 && width <= 1050 && route === '/dashboard') {
                const toggle = page.locator('.sidebar-toggle');
                if (await toggle.count()) {
                  await toggle.click();
                  await snapshot(page, 'sidebar-expanded', results, screen);
                }
              }
            } catch (error) {
              failures.push({ ...screen, error: error.message });
              await page.screenshot({
                path: path.join(
                  output,
                  `failure-${width}-${route.replace(/\W+/g, '-')}.png`,
                ),
              });
            }
          }
          await context.close();
          console.log(`AUDITED ${width}x${height}`);
        }
      }),
    );
  } finally {
    await browser.close();
  }
  const issues = results.filter(
    (r) => r.overflow || r.outside.length || r.modalOutside,
  );
  fs.writeFileSync(
    path.join(output, process.env.AUDIT_REPORT || 'report.json'),
    JSON.stringify({ results, issues, failures }, null, 2),
  );
  console.log(
    JSON.stringify({
      checks: results.length,
      issues: issues.length,
      failures: failures.length,
    }),
  );
  if (process.env.AUDIT_STRICT === '1' && (issues.length || failures.length))
    process.exitCode = 1;
}

module.exports = { prepare, inspect, snapshot };
if (require.main === module)
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
