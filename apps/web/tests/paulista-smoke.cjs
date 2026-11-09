const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const base = 'http://localhost:5173', api = 'http://127.0.0.1:3009';
const out = path.resolve(__dirname, '../../../test-results/paulista-web');
async function choose(page, label, value) {
  await page.getByRole('combobox', { name: new RegExp('^' + label) }).click();
  await page.getByRole('option', { name: value, exact: true }).click();
}
(async () => {
  await fs.mkdir(out, { recursive: true });
  const login = await fetch(api + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'pilot@example.test', senha: 'LocalPilotFixture123!' }) });
  assert.equal(login.status, 200); const { token } = await login.json();
  const ctx = JSON.parse(await fs.readFile(path.resolve(out, '../paulista/ui-context.json')));
  assert.match(ctx.clube.nome, /TESTE ISOLADO/);
  const headers = { Authorization: `Bearer ${token}`, 'x-clube-id': String(ctx.clube.id), 'Content-Type': 'application/json' };
  const panel = await (await fetch(api + '/paulista/eventos/900', { headers })).json();
  const comps = await (await fetch(api + '/competicoes', { headers })).json();
  const official = comps.find(c => c.paulista_evento_id === 900); assert.ok(official);
  const demo = structuredClone(panel); demo.snapshot.id = 99000008; demo.snapshot.categoria = 'Sub-8'; demo.snapshot.divisao = 'A3'; demo.snapshot.fonte = 'https://example.test/fixture-sub8'; demo.jogosLocais = [];
  const model = panel.snapshot.jogos.find(j => j.mandanteId === 12423);
  demo.snapshot.classificacao = [];
  demo.snapshot.jogos = [
    { ...model, id: 'fixture-future', data: '2026-11-20', golsMandante: null, golsVisitante: null },
    { ...model, id: 'fixture-postponed', data: '2026-11-12', golsMandante: null, golsVisitante: null, ocorrencia: 'ADIADA' },
    { ...model, id: 'fixture-wo', data: '2026-11-01', golsMandante: 0, golsVisitante: 0, ocorrencia: 'WO' },
    { ...model, id: 'fixture-date', data: null, horario: null, golsMandante: null, golsVisitante: null },
  ];
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [390, 1366]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width === 390 });
      await context.addInitScript(({ token, ctx, theme }) => {
        localStorage.setItem('ludora_token', token); localStorage.setItem('ludora_usuario', JSON.stringify(ctx.usuario)); localStorage.setItem('ludora_clube', JSON.stringify(ctx.clube)); localStorage.setItem('ludora_clube_id', String(ctx.clube.id)); localStorage.setItem('ludora_tema', theme);
      }, { token, ctx, theme });
      const page = await context.newPage(), errors = [];
      let includeBase = false;
      const baseDemo = structuredClone(demo); baseDemo.snapshot.id = 99000012; baseDemo.snapshot.categoria = 'Sub-12'; baseDemo.snapshot.divisao = 'A1'; baseDemo.snapshot.jogos = []; baseDemo.snapshot.fonte = 'https://example.test/fixture-base';
      const rank = panel.snapshot.classificacao.find(r => r.equipeId === 12423 && /CLASSIFICA/i.test(r.fase));
      baseDemo.snapshot.classificacao = [ { ...rank, fase: '1ª FASE CLASSIFICAÇÃO - C', faseId: 'fixture-base-c', grupo: 'CHAVE C', posicao: 4 }, { ...rank, fase: '1ª FASE CLASSIFICAÇÃO - A', faseId: 'fixture-base-a', grupo: 'CHAVE A', equipeId: 12241, posicao: 1 }, { ...rank, fase: '1ª FASE CLASSIFICAÇÃO - B', faseId: 'fixture-base-b', grupo: 'CHAVE B', equipeId: 12149, posicao: 1 }, { ...rank, fase: '1ª FASE CLASSIFICAÇÃO - C', faseId: 'fixture-base-c', grupo: 'CHAVE C', equipeId: 12399, posicao: 1 } ];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.origin === base) return route.continue();
        if (!['localhost', '127.0.0.1'].includes(url.hostname)) return route.abort();
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': base, 'access-control-allow-headers': 'authorization,content-type,x-clube-id', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,PUT' } });
        let body;
        if (req.method() === 'GET' && url.pathname === '/paulista/eventos') body = [{ id: 900, ano: 2026, categoria: 'Sub-7', divisao: 'A2' }, { id: 99000008, ano: 2026, categoria: 'Sub-8', divisao: 'A3' }, ...(includeBase ? [{ id: 99000012, ano: 2026, categoria: 'Sub-12', divisao: 'A1' }] : [])];
        if (req.method() === 'GET' && url.pathname === '/paulista/eventos/900') body = panel;
        if (req.method() === 'GET' && url.pathname === '/paulista/eventos/99000008') body = demo;
        if (req.method() === 'GET' && url.pathname === '/paulista/eventos/99000012') body = baseDemo;
        if (req.method() === 'GET' && url.pathname === '/competicoes') body = [...comps, { id: 999999, nome: 'Friendly Cup · TESTE', ano: 2026, tipo: 'INICIACAO', clube_id: ctx.clube.id }];
        if (req.method() === 'GET' && /^\/competicoes\/999999\/(classificacao|inscricoes)$/.test(url.pathname)) body = [];
        if (body !== undefined) return route.fulfill({ status: 200, json: body, headers: { 'access-control-allow-origin': base } });
        const res = await fetch(api + url.pathname + url.search, { method: req.method(), headers, ...(req.postData() ? { body: req.postData() } : {}) });
        return route.fulfill({ status: res.status, body: await res.text(), headers: { 'content-type': 'application/json', 'access-control-allow-origin': base } });
      });
      try {
        await page.goto(base + '/competicoes');
        assert.equal(await page.locator('.competition-card').count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Nova competição', exact: true }).count(), 0);
        await page.getByRole('heading', { name: 'Campeonato Paulista', exact: true }).waitFor();
        await page.locator('.paulista-participation-position > strong').filter({ hasText: '12º' }).waitFor();
        assert.equal(await page.locator('.paulista-campaign-metrics dd').first().innerText(), '33');
        await page.getByLabel('Divisão oficial A2', { exact: true }).waitFor();
        assert.equal(await page.getByText('Conferência calculada pelo Ludora · 3/1/0 e saldo', { exact: true }).count(), 0);
        assert.equal(await page.getByText('Operação do piloto · Super Admin', { exact: true }).count(), 0);
        assert.equal(await page.locator('.paulista-source').count(), 0);
        assert.equal(await page.getByRole('combobox', { name: /^Fase/ }).count(), 0);
        const globe = page.getByRole('link', { name: 'Abrir página oficial da Federação Paulista de Futsal em nova aba', exact: true });
        assert.equal(await globe.getAttribute('target'), '_blank');
        await globe.hover(); await page.getByRole('tooltip').waitFor(); await page.mouse.move(0, 0);
        await globe.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); await page.getByRole('tooltip').waitFor();
        await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(out, `overview-${width}-${theme}.png`) });
        await page.getByRole('tab', { name: 'Base', exact: true }).click();
        await page.getByRole('heading', { name: 'Nenhuma participação confirmada', exact: true }).waitFor();
        assert.equal(await page.locator('.paulista-division').innerText(), '—');
        await page.getByRole('tab', { name: 'Iniciação', exact: true }).click();
        await page.getByRole('button', { name: 'Classificação', exact: true }).click();
        await page.getByRole('table').waitFor();
        assert.equal(await page.locator('.paulista-table-scroll tr.is-own td').first().innerText(), '12º');
        assert.equal(await page.locator('.paulista-table-scroll tr.is-own td').nth(1).innerText(), '33');
        await page.screenshot({ path: path.join(out, `ranking-${width}-${theme}.png`) });
        await page.getByRole('combobox', { name: /^Etapa da classificação/ }).click();
        await page.getByRole('option', { name: /Quartas.*Ocian/ }).click();
        assert.equal(await page.locator('.paulista-table-scroll tr.is-own td').first().innerText(), '1º');
        await page.getByRole('combobox', { name: /^Etapa da classificação/ }).click();
        await page.getByRole('option', { name: /Semifinal.*Ocian/ }).click();
        assert.equal(await page.locator('.paulista-table-scroll tr.is-own td').first().innerText(), '2º');
        await page.getByRole('button', { name: 'Chaveamento', exact: true }).click();
        await page.getByRole('heading', { name: 'Chave Prata', exact: true }).waitFor();
        const mapButton = page.getByRole('button', { name: 'Mapa', exact: true });
        if (await mapButton.count()) await mapButton.click();
        await page.locator('.react-flow__edge-path').first().waitFor({ state: 'attached' });
        assert.equal(await page.locator('.paulista-bracket-game').count(), 7);
        assert.equal(await page.locator('.react-flow__edge-path').count(), 6);
        assert.equal(await page.locator('.paulista-flow-phase').count(), 3);
        assert.equal(await page.locator('.paulista-bracket-game').filter({ hasText: /OURO|BRONZE|#365/ }).count(), 0);
        await page.getByRole('button', { name: 'Ajustar à tela', exact: true }).click();
        await page.screenshot({ path: path.join(out, `bracket-${width}-${theme}.png`) });
        await page.getByRole('button', { name: 'Jogos', exact: true }).click();
        await page.getByText('25 jogos encontrados · por data', { exact: true }).waitFor();
        assert.equal(await page.locator('.match-card').count(), 25);
        await choose(page, 'Jogos', 'Todos do campeonato');
        await page.getByRole('button', { name: 'Mostrar mais jogos', exact: true }).click();
        assert.equal(await page.locator('.match-card').count(), 50);
        const external = page.locator('.match-card').filter({ hasText: 'Santo André Futsal' }).first();
        if (width === 390) await external.getByRole('button', { name: 'Ver detalhes', exact: true }).tap(); else await external.getByRole('button', { name: 'Ver detalhes', exact: true }).click();
        await page.getByRole('dialog', { name: 'Detalhes oficiais da partida', exact: true }).waitFor();
        await page.goBack(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
        await choose(page, 'Jogos', 'Do meu clube');
        await page.locator('.match-card').first().focus(); await page.keyboard.press('Enter');
        await page.waitForURL(/\/partidas\/\d+/);
        await page.getByLabel('Dados oficiais da Federação Paulista', { exact: true }).waitFor();
        const normalId = Number(new URL(page.url()).pathname.split('/').at(-1));
        const before = await (await fetch(api + `/partidas/${normalId}/gestao`, { headers })).json();
        await page.getByRole('button', { name: 'Defesa', exact: true }).click();
        const eventDialog = page.getByRole('dialog'); await eventDialog.getByRole('button').filter({ hasText: 'Taylor Example · TESTE' }).click();
        await eventDialog.getByLabel('Motivo da correção', { exact: true }).fill('Conferência do teste isolado pela tela normal');
        await eventDialog.getByRole('button', { name: 'Registrar evento', exact: true }).click(); await eventDialog.waitFor({ state: 'hidden' });
        const after = await (await fetch(api + `/partidas/${normalId}/gestao`, { headers })).json();
        assert.equal(after.partida.gols_mandante, before.partida.gols_mandante); assert.equal(after.partida.gols_visitante, before.partida.gols_visitante);
        assert.deepEqual(after.paulista.jogo, before.paulista.jogo); assert.equal(after.eventos.length, before.eventos.length + 1);
        assert.equal(await page.getByRole('button', { name: 'Editar dados', exact: true }).count(), 0);
        await page.goBack(); await page.waitForURL(/competicoes(?:\/paulista)?/);
        await page.goto(base + '/partidas?status=FINALIZADA&fase=INICIACAO');
        await page.getByRole('heading', { name: 'Partidas', exact: true }).waitFor(); await page.locator('.match-official-label').first().waitFor();
        await page.goto(base + '/competicoes/paulista?evento=900&aba=jogos'); await page.getByRole('tab', { name: 'SUB-8', exact: true }).waitFor();
        await page.getByRole('tab', { name: 'SUB-8', exact: true }).click();
        await page.getByLabel('Divisão oficial A3', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Jogos', exact: true }).click();
        await choose(page, 'Situação', 'Adiadas'); assert.equal(await page.locator('.match-card').count(), 1);
        assert.ok((await page.locator('.match-card').innerText()).includes('Adiada'));
        await choose(page, 'Situação', 'W.O.'); assert.equal(await page.locator('.match-card').count(), 1);
        assert.ok(!(await page.locator('.match-card').innerText()).includes('Empate'));
        await choose(page, 'Situação', 'Sem resultado publicado'); assert.equal(await page.locator('.match-card').count(), 2);
        assert.equal(await page.locator('.match-score').filter({ hasText: /^0/ }).count(), 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        includeBase = true;
        await page.getByText('Atualização dos dados', { exact: true }).click(); await page.getByRole('button', { name: 'Atualizar consulta', exact: true }).click();
        await page.getByRole('tab', { name: 'Base', exact: true }).click(); await page.getByLabel('Divisão oficial A1', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Classificação', exact: true }).click(); assert.equal(await page.locator('.paulista-table-scroll tr.is-own td').first().innerText(), '4º'); await choose(page, 'Grupo/chave', 'Chave B');
        assert.equal(await page.locator('.paulista-table-scroll tbody tr').count(), 1); assert.equal(await page.locator('.paulista-table-scroll tr.is-own').count(), 0);
        await page.route('**/paulista/eventos/99000012', route => route.fulfill({ status: 503, json: { error: 'Falha simulada de teste' }, headers: { 'access-control-allow-origin': base } }));
        await page.getByText('Atualização dos dados', { exact: true }).click(); await page.getByRole('button', { name: 'Atualizar consulta', exact: true }).click();
        await page.getByRole('alert').filter({ hasText: /indisponível/ }).waitFor(); assert.equal(await page.locator('.match-card').count(), 0);
        assert.deepEqual(errors, []);
        console.log(`PASS web ${width} ${theme}: lista integrada, visão geral, categorias, classificação, chave Prata, 5 conexões verificadas, filtros, detalhes normal/leitura, voltar e ocorrências.`);
      } catch (e) { await page.screenshot({ path: path.join(out, `failure-${width}-${theme}.png`), fullPage: true }); throw e; }
      finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
