const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { install } = require('./visual-fixture.cjs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5191';

async function checkHeader(page, insideClub) {
  assert.equal(await page.locator('.public-club-switcher').count(), insideClub ? 1 : 0, 'clube só aparece dentro de suas páginas');
  assert.equal(await page.locator('.public-top-nav').count(), insideClub ? 1 : 0, 'descoberta não mostra links de um clube salvo');
  assert.equal(await page.locator('.public-club-context').count(), 0, 'não há faixa extra abaixo da navegação');
  assert.equal(await page.getByRole('link', { name: 'Trocar clube', exact: true }).count(), 0, 'Clubes já está disponível na navegação, sem ação redundante no header');
  if (insideClub) {
    assert.deepEqual(await page.locator('.public-top-nav a').allTextContents(), ['Visão geral', 'Partidas', 'Campeonatos', 'Clubes']);
    assert.equal(await page.locator('.public-header .public-current-club').count(), 1);
    const active = page.locator('.public-top-nav .active');
    if (await active.count()) assert.equal(await active.evaluate(el => getComputedStyle(el).boxShadow), 'none', 'navegação superior sem sublinhado azul');
    if ((await page.viewportSize()).width > 760) {
      const offset = await page.locator('.public-top-nav').evaluate(el => {
        const nav = el.getBoundingClientRect(), header = el.closest('.public-header-inner').getBoundingClientRect();
        return Math.abs((nav.left + nav.right) / 2 - (header.left + header.right) / 2);
      });
      assert.ok(offset < 1, `links centralizados no cabeçalho: desvio ${offset}px`);
    }
  }
  const overlaps = await page.locator('.public-header-inner').evaluate(el => {
    const nodes = [...el.querySelectorAll('.public-brand, .public-current-club, .public-switch-club, .public-top-nav a, .public-header-actions > button, .account-trigger')];
    const rects = nodes.map(node => node.getBoundingClientRect()).filter(rect => rect.width && rect.height);
    return rects.some((a, i) => rects.slice(i + 1).some(b => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1));
  });
  assert.equal(overlaps, false, 'logo, clube, links e ações não se sobrepõem');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'cabeçalho sem overflow');
}

async function checkMatchCenter(page) {
  const offset = await page.locator('.partida-detalhe').evaluate(el => {
    const main = el.closest('main'), a = el.getBoundingClientRect(), b = main.getBoundingClientRect();
    return Math.abs((a.left + a.right) / 2 - (b.left + b.right) / 2);
  });
  assert.ok(offset < 1, `detalhes centralizados no conteúdo: desvio ${offset}px`);
  if (await page.locator('.partida-detalhe[data-live="true"]').count()) {
    const widthDifference = await page.locator('.partida-detalhe').evaluate(el => {
      const main = el.closest('main'), style = getComputedStyle(main);
      return Math.abs(el.getBoundingClientRect().width - (main.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)));
    });
    assert.ok(widthDifference < 1, 'partida ao vivo ocupa toda a largura útil em ambos os modos');
  }
}

async function fixture(page, role = 'ADMIN') {
  let data;
  const writes = [], unexpected = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await install(page, { role, decorate: value => { data = value; }, onUnknown: route => {
    unexpected.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 404, json: { error: 'Endpoint privado não disponível ao visitante' } });
  } });
  await page.route('http://localhost:3000/health', r => r.fulfill({ json: { status: 'ok' } }));
  await page.route('http://localhost:3000/clubes', r => r.fulfill({ json: data.clubes.map(c => ({ ...c, meuPapel: r.request().headers().authorization ? c.meuPapel : null })) }));
  await page.route('http://localhost:3000/clubes/*/seguir', r => { writes.push(r.request().url()); return r.fulfill({ json: { papel: 'TORCEDOR', seguidores: 5 } }); });
  await page.route('http://localhost:3000/publico/**', async route => {
    const url = new URL(route.request().url()), endpoint = url.pathname;
    assert.equal(route.request().method(), 'GET');
    assert.equal(route.request().headers().authorization, undefined, 'consulta pública não envia token');
    const club = data.clubes.find(c => c.id === Number(endpoint.split('/')[3]));
    const match = endpoint.match(/^\/publico\/partidas\/(\d+)$/);
    let response;
    if (endpoint === '/publico/partidas/ao-vivo') response = [];
    else if (match) {
      const p = data.partidas.find(p => p.id === Number(match[1]));
      if (p) response = { clube: { ...data.clubes[0], meuPapel: null }, partida: { ...p, versao: 1, periodo_atual: 1, organizador_id: 2, sumula_clube_id: 2 },
        organizador: data.clubes[0], podePreparar: false, podeSumula: false, auditoria: [], minhaEquipeId: 1,
        equipes: [{ id: 1, clube_id: 2, time_id: p.mandante_id, categoria_id: 1, categoria: data.categorias[0], clube: data.clubes[0], pronta: true, publicada_em: '2026-11-06', escalacao: [{ jogador_id: 101, numCamisa: 1, titular: true, ordem: 1, time_id: p.mandante_id, jogador: { id: 101, nome: 'Daniel Young', posicao: 'Fixo' } }] }],
        eventos: [{ id: 1, partida_id: p.id, tipo: 'GOL', periodo: 1, time_id: p.mandante_id, jogador_id: 101, jogador: { id: 101, nome: 'Daniel Young' } }] };
    } else if (club) {
      if (/\/categorias$/.test(endpoint)) response = data.categorias;
      else if (/\/paulista$/.test(endpoint)) response = require('./paulista-public-fixture.cjs').eventos();
      else if (/\/times$/.test(endpoint)) response = data.times;
      else if (/\/partidas(?:\/home)?$/.test(endpoint)) response = data.partidas;
      else if (/\/competicoes$/.test(endpoint)) response = data.competicoes;
      else if (/\/classificacao$/.test(endpoint)) response = [];
      else response = { ...club, meuPapel: null };
    }
    return route.fulfill({ status: response ? 200 : 404, json: response || { error: 'Não encontrado' } });
  });
  return { data, writes, unexpected, errors };
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 768, 1024, 1200, 1440, 1920]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', colorScheme: 'dark' });
      await context.addInitScript(() => {
        localStorage.setItem('ludora_clube_id', '2');
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
      });
      const page = await context.newPage(), f = await fixture(page);
      page.setDefaultTimeout(12000);
      await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Encontre o seu clube' }).waitFor();
      await page.getByRole('button', { name: 'Acessar Ocian', exact: true }).waitFor();
      await checkHeader(page, false);
      assert.equal(await page.locator('.public-header-actions > *').count(), 1, 'descoberta mostra apenas perfil ao lado do logo');
      await page.getByRole('button', { name: 'Menu da conta' }).click();
      const menu = page.getByRole('dialog', { name: 'Conta e aparência' });
      await menu.getByText('Acompanhe ainda mais de perto').waitFor();
      await menu.getByRole('radio', { name: 'Tema claro' }).click();
      await menu.getByRole('radio', { name: 'Tema escuro' }).click();
      assert.equal(await menu.getByRole('link', { name: 'Entrar na conta' }).count(), 1);
      await page.screenshot({ path: path.resolve(__dirname, `../../../test-results/public-access/guest-menu-${width}.png`) });
      await page.keyboard.press('Escape'); assert.equal(await menu.count(), 0);
      await page.getByRole('button', { name: 'Menu da conta' }).click();
      await page.mouse.click(4, 4); assert.equal(await menu.count(), 0, 'menu fecha ao clicar fora');
      await page.getByRole('button', { name: 'Seguir Ocian', exact: true }).click();
      const followDialog = page.getByRole('dialog', { name: 'Salve seus clubes favoritos' });
      await followDialog.waitFor();
      assert.ok((await followDialog.getByRole('link', { name: 'Entrar e seguir' }).boundingBox()).height >= 44, 'ação de login tem tamanho de botão');
      assert.equal(await followDialog.evaluate(el => el.scrollWidth > el.clientWidth), false);
      await page.screenshot({ path: path.resolve(__dirname, `../../../test-results/public-access/follow-login-${width}.png`) });
      assert.equal(f.writes.length, 0, 'seguir sem login não modifica o servidor');
      await page.getByRole('button', { name: 'Continuar explorando' }).click();
      await page.getByRole('button', { name: 'Acessar Ocian', exact: true }).click();
      await page.locator('.home-history-table').waitFor();
      await checkHeader(page, true);
      assert.equal(await page.locator('.sidebar').count(), 0);
      assert.equal(await page.getByText('Pendências', { exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Gerenciar clube' }).count(), 0);
      await page.screenshot({ path: path.resolve(__dirname, `../../../test-results/public-access/overview-${width}.png`), fullPage: true });
      for (const route of ['/clubes/2/partidas', '/clubes/2/competicoes', '/partidas/105', '/partidas/100', '/partidas/107']) {
        console.log('Checking', width, route);
        await page.goto(base + route, { waitUntil: 'domcontentloaded' });
        if (route.includes('competicoes')) await page.locator('.paulista-overview-screen').waitFor();
        else if (route.endsWith('/partidas')) await page.locator('.match-card').first().waitFor();
        else try { await page.getByRole('heading', { name: /Ocian|Detalhes da partida|Resumo da partida/ }).first().waitFor(); }
        catch (error) { console.log(await page.locator('body').innerText(), f.unexpected, f.errors); throw error; }
        assert.equal(await page.getByRole('button', { name: /Adicionar evento|Registrar gol|Finalizar partida|Iniciar preparação|Fazer substituição/ }).count(), 0);
        assert.equal(await page.locator('.live-audit').count(), 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${route} ${width}px sem overflow`);
        await checkHeader(page, true);
        if (/^\/partidas\/\d+$/.test(route)) {
          await checkMatchCenter(page);
          if (route === '/partidas/105') await page.screenshot({ path: path.resolve(__dirname, `../../../test-results/public-access/live-${width}.png`), fullPage: true });
        }
      }
      assert.deepEqual(f.unexpected, [], 'visitante não consulta endpoints privados');
      await page.goto(base + '/jogadores', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Entre para continuar' }).waitFor();
      assert.deepEqual(f.unexpected, []);
      assert.deepEqual(f.errors, []);
      console.log(`OK visitante ${width}px: menu, tema, clubes, home, jogos, campeonato, link ao vivo/finalizada/agendada`);
      await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await context.newPage(), f = await fixture(page);
    await page.goto(base + '/selecionar-clube');
    await page.getByRole('button', { name: 'Seguir Santos', exact: true }).click();
    await page.getByRole('link', { name: 'Entrar e seguir' }).click();
    await page.getByLabel('E-mail', { exact: true }).fill('visual@example.test');
    await page.getByLabel('Senha', { exact: true }).fill('teste123');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByRole('heading', { name: 'Encontre o seu clube' }).waitFor();
    await checkHeader(page, false);
    assert.equal(f.writes.length, 1, 'login retoma seguir exatamente uma vez');
    await page.getByRole('button', { name: 'Acessar Ocian', exact: true }).click();
    await page.locator('.sidebar').waitFor();
    await page.reload();
    await page.locator('.sidebar').waitFor();
    assert.equal(await page.locator('.public-layout').count(), 0, 'gestor entra e retorna na visão gerencial por padrão');
    await page.getByRole('link', { name: 'Ver como visitante', exact: true }).first().click();
    await page.locator('.home-history-table').waitFor();
    await page.reload();
    await page.locator('.public-header').waitFor();
    for (const width of [320, 390, 768, 1024, 1101, 1200, 1280, 1281, 1366, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await checkHeader(page, true);
      const sizes = await page.locator('.public-header-actions').evaluate(el => [...el.querySelectorAll('.notifications-trigger, .account-trigger')].map(button => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height, icon: button.querySelector('.icon').getBoundingClientRect().width })));
      assert.equal(sizes.length, 2);
      assert.deepEqual(sizes[0], sizes[1], `sino e perfil têm o mesmo tamanho no topo em ${width}px`);
      if (width > 760) {
        const manage = await page.getByRole('button', { name: 'Gerenciar clube', exact: true }).boundingBox();
        assert.equal(manage.height, sizes[1].height, 'gerenciar acompanha a altura dos demais controles');
      }
    }
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.getByRole('button', { name: 'Gerenciar clube', exact: true }).click();
    await page.locator('.sidebar').waitFor();
    await require('./shared-match-fixture.cjs').install(page, { players: f.data.jogadores, lineup: () => [], match: () => ({ status: 'AO_VIVO' }) });
    await page.goto(base + '/partidas/106');
    await page.locator('.partida-detalhe').waitFor();
    await checkMatchCenter(page);
    await page.getByRole('button', { name: 'Expandir navegação', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.layout').dataset.sidebarExpanded === 'true' && Math.abs(document.querySelector('.workspace').getBoundingClientRect().left - 238) < 1 && Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width - 238) < 1);
    await checkMatchCenter(page);
    await page.screenshot({ path: path.resolve(__dirname, '../../../test-results/public-access/manager-live-1366.png'), fullPage: true });
    await page.getByRole('link', { name: 'Ver como visitante', exact: true }).first().click();
    await page.locator('.public-header').waitFor();
    assert.equal(await page.locator('.sidebar').count(), 0);
    await page.goto(base + '/jogadores');
    await page.locator('.sidebar').waitFor();
    await page.getByRole('heading', { name: 'Jogadores', exact: true }).waitFor();
    assert.deepEqual(f.errors, []);
    console.log('OK login retoma seguir; gestor alterna entre consulta pública e gestão');
    await context.close();
    const viewer = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await viewer.addInitScript(() => {
      localStorage.setItem('ludora_token', 'viewer-test-only');
      localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Visitante', email: 'viewer@example.test' }));
      localStorage.setItem('ludora_clube_id', '2');
      localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'TORCEDOR' }));
      localStorage.setItem('ludora_navigation_mode', 'gestao');
    });
    const viewerPage = await viewer.newPage(), vf = await fixture(viewerPage, 'TORCEDOR');
    await viewerPage.goto(base + '/dashboard'); await viewerPage.locator('.home-history-table').waitFor();
    vf.data.clubes[0].nome = 'Associação Esportiva Comunitária de Praia Grande';
    await viewerPage.goto(base + '/clubes/2'); await viewerPage.locator('.home-history-table').waitFor();
    for (const width of [320, 768, 1024, 1101, 1200, 1280, 1281, 1440]) {
      await viewerPage.setViewportSize({ width, height: 900 });
      await checkHeader(viewerPage, true);
    }
    await viewerPage.goto(base + '/selecionar-clube');
    await viewerPage.getByRole('heading', { name: 'Encontre o seu clube' }).waitFor();
    await checkHeader(viewerPage, false);
    assert.equal(await viewerPage.locator('.sidebar').count(), 0);
    assert.equal(await viewerPage.getByRole('button', { name: 'Gerenciar clube', exact: true }).count(), 0);
    assert.equal(await viewerPage.getByText('Pendências', { exact: true }).count(), 0);
    assert.deepEqual(vf.unexpected, []); assert.deepEqual(vf.errors, []);
    console.log('OK torcedor autenticado mantém navegação pública e consultas de leitura');
    await viewer.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
