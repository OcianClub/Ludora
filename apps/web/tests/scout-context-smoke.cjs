const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { install } = require('./visual-fixture.cjs');

const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';
const player = {
  id_jogador: 101,
  nome: 'João Vítor',
  categoria_id: 1,
  categoria: 'sub-7',
  categoria_tipo: 'INICIACAO',
  posicao: 'Alas',
  idade: 7,
  numCamisa: 6,
  perfil_ml: 'Armador',
  nota_geral: 0,
  jogos_disputados: 25,
  gols: 8,
  assistencias: 16,
  defesas: 0,
  analise_scout: {
    versao: 2,
    grupo_tamanho: 5,
    convocacoes: 25,
    calculado_em: '2026-11-02T12:00:00Z',
  },
};

function context(query) {
  const single = query.has('partida_id');
  const championship = query.has('competicao_id');
  const goals = single ? 1 : championship ? 3 : 8;
  return {
    versao: 2,
    jogador_id: 101,
    total_partidas: single ? 1 : championship ? 6 : query.has('ano') ? 0 : 25,
    recorte: {
      tipo: single ? 'partida' : championship ? 'competicao' : 'geral',
      partida_id: single ? 105 : null,
      competicao_id: championship ? 2 : null,
      ano: query.has('ano') ? Number(query.get('ano')) : null,
      provisorio: single,
    },
    totais: {
      convocacoes: single ? 1 : championship ? 6 : query.has('ano') ? 0 : 25,
      titularidades: single ? 1 : 5,
      titularidades_desconhecidas: 0,
      gols: goals,
      assistencias: 2,
      defesas: 0,
      faltas: 1,
      amarelos: 1,
      vermelhos: 0,
      azuis: 1,
      gols_contra: 0,
    },
    partidas: query.has('ano')
      ? []
      : Array.from(
          { length: single ? 1 : championship ? 6 : 10 },
          (_, index) => ({
            id: 105 - index,
            data: `2026-10-${29 - index}`,
            adversario:
              index === 0
                ? 'Associação Esportiva de Nome Muito Extenso Sem EspaçoNoFinalParaTestar'
                : 'Santos',
            horario: '19:30',
            status: single ? 'AO_VIVO' : 'FINALIZADA',
            convocado: true,
            titular_inicial: true,
            gols: single
              ? 1
              : championship
                ? index % 2 === 0
                  ? 1
                  : 0
                : [1, 0, 2, 0, 1, 1, 0, 1, 0, 2][index],
            assistencias: index === 0 ? 2 : 0,
            defesas: 0,
            mandante: 'Ocian',
            visitante: 'Santos',
            gols_mandante: 2,
            gols_visitante: 1,
            competicao: {
              id: 2,
              nome: '[DEMO] Copa Ocian Iniciação Campeonato de Nome Muito Extenso',
              ano: 2026,
            },
            eventos: [
              {
                id: 1,
                tipo: 'GOL',
                periodo: 1,
                minuto: null,
                gol_contra: false,
              },
            ],
          }),
        ),
    opcoes: {
      temporadas: [2026, 2025],
      competicoes: [{ id: 2, nome: 'Copa Iniciação', ano: 2026 }],
      partidas: [
        {
          id: 105,
          data: '2026-10-29',
          nome: 'Ocian × Santos',
          status: 'AO_VIVO',
        },
      ],
    },
    por_tempo: [{ periodo: 1, gols: goals, assistencias: 2, defesas: 0 }],
    semelhantes: [],
    modelo: null,
  };
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const theme of ['dark', 'light'])
      for (const width of [320, 390, 820, 1440]) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
        });
        const failures = [];
        const requests = [];
        let failNext = false;
        page.on('pageerror', (error) => failures.push(error.message));
        await install(page);
        await page.route('**/jogadores/perfis*', (route) =>
          route.fulfill({ json: [player] }),
        );
        await page.route('**/jogadores/101/scout-contexto*', async (route) => {
          const query = new URL(route.request().url()).searchParams;
          requests.push(Object.fromEntries(query));
          if (failNext) {
            failNext = false;
            return route.fulfill({
              status: 503,
              json: { error: 'Falha simulada' },
            });
          }
          if (query.has('competicao_id'))
            await new Promise((resolve) => setTimeout(resolve, 150));
          await route.fulfill({ json: context(query) });
        });
        await page.addInitScript(
          ({ theme }) => {
            localStorage.setItem('ludora_token', 'visual-test-token');
            localStorage.setItem(
              'ludora_usuario',
              JSON.stringify({
                id: 1,
                nome: 'Alex',
                email: 'visual@example.test',
              }),
            );
            localStorage.setItem(
              'ludora_clube',
              JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }),
            );
            localStorage.setItem('ludora_clube_id', '2');
            localStorage.setItem('ludora_tema', theme);
          },
          { theme },
        );
        await page.goto(`${base}/elenco?categoria_id=1&atleta=101`);
        const dialog = page.getByRole('dialog', { name: 'Ficha do atleta' });
        await dialog
          .getByText('25 partidas com registro', { exact: true })
          .waitFor();
        assert.equal(
          await page.locator('html').getAttribute('data-theme'),
          theme,
        );
        assert.equal(
          await dialog
            .locator('.scout-recorded-totals > div')
            .filter({ hasText: 'Gols' })
            .locator('dd')
            .textContent(),
          '8',
        );
        await dialog.getByRole('img', { name: /Radar de eventos/ }).waitFor();
        assert.equal(
          await dialog.locator('input[type="number"]').count(),
          0,
          'Temporada não permite anos digitados',
        );
        const season = dialog.getByRole('combobox', { name: /Temporada/ });
        await season.click();
        assert.equal(
          await dialog
            .getByRole('option', { name: '1900', exact: true })
            .count(),
          0,
        );
        await dialog.getByRole('option', { name: '2025', exact: true }).click();
        await dialog.getByText('Ainda sem registros neste período').waitFor();
        assert.equal(await dialog.locator('.scout-recorded-totals').count(), 0);
        await dialog
          .getByRole('button', { name: 'Ver histórico completo' })
          .click();
        await dialog
          .getByText('25 partidas com registro', { exact: true })
          .waitFor();
        await dialog
          .locator('.athlete-disclosure')
          .filter({ hasText: 'Disciplina e escalação' })
          .locator('summary')
          .click();
        await dialog.getByText('Gols contra', { exact: true }).waitFor();
        await dialog
          .locator('.athlete-disclosure')
          .filter({ hasText: 'Disciplina e escalação' })
          .locator('summary')
          .click();
        await dialog.locator('.modal-body').evaluate((el) => {
          el.scrollTop = 0;
        });
        await page.screenshot({
          path: `test-results/scout-sheet-${theme}-${width}.png`,
          fullPage: true,
        });
        assert.equal(
          await dialog.locator('.athlete-trend-bars button').count(),
          10,
          'Gráfico preserva os dez jogos, sem agregar partidas diferentes',
        );
        assert.ok(
          await dialog
            .locator('.scout-history-table tbody tr')
            .evaluateAll((rows) =>
              rows.every((row) => {
                const first = row.querySelector('th').getBoundingClientRect();
                const text = [
                  ...row.querySelectorAll(
                    '.athlete-history-opponent, .athlete-history-competition',
                  ),
                ];
                return text.every(
                  (el) => el.getBoundingClientRect().right <= first.right + 1,
                );
              }),
            ),
          'Adversário e campeonato longos não invadem as colunas numéricas',
        );
        await dialog.locator('.scout-history-table').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/scout-sheet-history-${theme}-${width}.png` });
        await dialog
          .getByRole('button', { name: 'Campeonato', exact: true })
          .click();
        await dialog
          .getByText('6 partidas com registro', { exact: true })
          .waitFor();
        await dialog
          .getByRole('img', { name: /Radar de eventos: Gols 3/ })
          .waitFor();
        assert.equal(
          await dialog
            .locator('.scout-recorded-totals > div')
            .filter({ hasText: 'Gols' })
            .locator('dd')
            .textContent(),
          '3',
        );
        const combobox = dialog.getByRole('combobox');
        await combobox.focus();
        await combobox.press('ArrowDown');
        await dialog.getByRole('listbox').waitFor();
        await combobox.press('Escape');
        assert.equal(await dialog.getByRole('listbox').count(), 0);
        await dialog
          .getByRole('button', { name: 'Partida', exact: true })
          .click();
        await dialog.getByText(/Dados provisórios: esta partida/).waitFor();
        assert.equal(
          await dialog
            .locator('.scout-athlete-events')
            .getByText('Gol', { exact: true })
            .count(),
          1,
        );
        assert.equal(await dialog.getByText(/Médias nas últimas/).count(), 0);
        await dialog
          .getByRole('button', { name: 'Geral', exact: true })
          .click();
        await dialog
          .getByText('25 partidas com registro', { exact: true })
          .waitFor();
        // O recorte já foi consultado: invalida o cache para exercitar a falha HTTP.
        await page.evaluate(async () => {
          const api = await import('/src/services/api.ts');
          api.invalidateApiReads('/jogadores/101/scout-contexto');
        });
        failNext = true;
        await dialog
          .getByRole('button', { name: 'Campeonato', exact: true })
          .click();
        await dialog.locator('.athlete-load-error').waitFor();
        assert.equal(
          await dialog.locator('.scout-recorded-totals').count(),
          0,
          'Falha não mantém totais de outro recorte',
        );
        await dialog.getByRole('button', { name: 'Tentar novamente' }).click();
        await dialog
          .getByText('6 partidas com registro', { exact: true })
          .waitFor();
        await dialog
          .getByRole('button', { name: 'Geral', exact: true })
          .click();
        await dialog
          .getByText('25 partidas com registro', { exact: true })
          .waitFor();
        await dialog
          .locator('.scout-history-table .scout-match-link')
          .first()
          .click();
        await dialog.getByText(/Dados provisórios: esta partida/).waitFor();
        assert.ok(requests.some((q) => q.competicao_id === '2'));
        assert.ok(requests.some((q) => q.partida_id === '105'));
        assert.ok(requests.some((q) => q.ano === '2025'));
        assert.ok(
          await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
          'Modal sem overflow horizontal',
        );
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        assert.deepEqual(failures, []);
        await page.screenshot({
          path: `test-results/scout-v2-${theme}-${width}.png`,
          fullPage: true,
        });
        await page.close();
      }
    console.log(
      'PASS: Scout geral/campeonato/partida, radar, evolução, temporadas válidas, vazio, erro/retry, teclado e overflow em 320/390/820/1440 px, claro e escuro.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
