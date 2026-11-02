const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { prepare, inspect } = require('./responsive-audit.cjs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5188';
const output = path.resolve(
  __dirname,
  '../../../test-results/responsive-audit',
);

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [],
    failures = [];
  async function check(page, name) {
    await page.waitForTimeout(120);
    const result = { name, ...page.viewportSize(), ...(await inspect(page)) };
    results.push(result);
    await page.screenshot({
      path: path.join(
        output,
        `content-${page.viewportSize().width}-${name}.png`,
      ),
    });
    if (result.overflow || result.outside.length || result.modalOutside)
      failures.push(result);
  }
  try {
    for (const width of [320, 820, 1440]) {
      const { page, context, data } = await prepare(
        browser,
        width,
        740,
        'dark',
        { longContent: true },
      );
      page.on('pageerror', (error) =>
        failures.push({ width, error: error.message }),
      );
      const goto = async (route) => {
        await page.goto(base + route, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(180);
      };
      try {
        for (const state of ['loading', 'empty', 'error']) {
          let release;
          const gate = new Promise((resolve) => {
            release = resolve;
          });
          await page.route(
            'http://localhost:3000/competicoes',
            async (route) => {
              if (state === 'loading') await gate;
              return route.fulfill({
                status: state === 'error' ? 503 : 200,
                json:
                  state === 'error'
                    ? {
                        error:
                          'Não foi possível carregar as competições. Tente novamente em instantes.',
                      }
                    : [],
              });
            },
          );
          await goto('/competicoes');
          if (state === 'loading')
            await page.locator('.loading-skeleton').waitFor();
          if (state === 'empty')
            await page
              .getByText('Nenhuma competição corresponde aos filtros.')
              .waitFor();
          if (state === 'error')
            await page.getByRole('alert').first().waitFor();
          await check(page, `competition-${state}`);
          release();
          await page.unroute('http://localhost:3000/competicoes');
        }
        const players = data.jogadores.filter(
          (p) => p.categoria_id === 1 && p.numCamisa,
        );
        const rows = players.map((player, i) => ({
          jogador_id: player.id,
          jogador: player,
          numCamisa: player.numCamisa,
          titular: i < 5,
          ordem: i,
        }));
        const match = {
          id: 106,
          status: 'AO_VIVO',
          versao: 1,
          titulares_necessarios: 5,
          periodo_atual: 1,
          sumula_clube_id: 2,
          data: '2026-11-02',
          horario: '19:30',
          local: 'Ginásio da Associação Esportiva de Praia Grande',
          categoria_id: 1,
          categoria: data.categorias[0],
          mandante_id: 13,
          visitante_id: 14,
          mandante: { id: 13, nome: 'Ocian' },
          visitante: { id: 14, nome: 'Santos' },
          gols_mandante: 2,
          gols_visitante: 1,
        };
        await page.route('**/partidas/106/gestao', (route) =>
          route.fulfill({
            json: {
              partida: match,
              organizador: { id: 2, nome: 'Ocian' },
              minhaEquipeId: 1,
              podePreparar: true,
              podeSumula: true,
              eventos: [
                {
                  id: 1,
                  tipo: 'GOL',
                  time_id: 13,
                  jogador_id: rows[0].jogador_id,
                  jogador: rows[0].jogador,
                  periodo: 1,
                },
              ],
              auditoria: [],
              equipes: [
                {
                  id: 1,
                  clube_id: 2,
                  time_id: 13,
                  categoria_id: 1,
                  clube: { id: 2, nome: 'Ocian' },
                  publicada_em: '2026-11-02',
                  pronta: true,
                  escalacao: rows,
                },
                {
                  id: 2,
                  clube_id: 3,
                  time_id: 14,
                  categoria_id: 1,
                  clube: { id: 3, nome: 'Santos' },
                  publicada_em: '2026-11-02',
                  pronta: true,
                  escalacao: rows.map((p) => ({
                    ...p,
                    jogador_id: p.jogador_id + 100,
                  })),
                },
              ],
            },
          }),
        );
        await goto('/partidas/106');
        await page.locator('.live-score-card').waitFor();
        await check(page, 'live');
        for (const [name, label] of [
          ['goal', 'Registrar gol do Ocian'],
          ['substitution', 'Fazer substituição'],
          ['finish', 'Finalizar partida'],
        ]) {
          await page.getByRole('button', { name: label, exact: true }).click();
          await page.getByRole('dialog').last().waitFor();
          await check(page, name);
          await page.keyboard.press('Escape');
        }
        match.status = 'FINALIZADA';
        await goto('/partidas/106');
        await page
          .getByRole('button', { name: 'Compartilhar resultado', exact: true })
          .waitFor();
        await check(page, 'finished');
        await page
          .getByRole('button', { name: 'Compartilhar resultado', exact: true })
          .click();
        await check(page, 'share-result');
      } catch (error) {
        failures.push({ width, error: error.message });
      }
      await context.close();
      const common = await prepare(browser, width, 740, 'light', {
        role: 'TORCEDOR',
      });
      await common.page.goto(base + '/dashboard', {
        waitUntil: 'domcontentloaded',
      });
      await common.page.locator('.home-main-match').first().waitFor();
      await check(common.page, 'visitor-home');
      assert.equal(await common.page.locator('.home-pending').count(), 0);
      await common.context.close();
    }
    const { page, context } = await prepare(browser, 683, 384);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 683,
      height: 384,
      deviceScaleFactor: 2,
      mobile: false,
    });
    for (const route of [
      '/dashboard',
      '/partidas',
      '/elenco',
      '/jogadores',
      '/membros',
      '/clube',
      '/perfil',
    ]) {
      await page.goto(base + route, { waitUntil: 'domcontentloaded' });
      await check(page, 'zoom200-' + route.slice(1));
    }
    await context.close();
  } finally {
    await browser.close();
  }
  fs.writeFileSync(
    path.join(output, 'content-states.json'),
    JSON.stringify({ results, failures }, null, 2),
  );
  console.log(JSON.stringify({ checks: results.length, failures }));
  assert.equal(failures.length, 0);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
