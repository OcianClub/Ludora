const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5191';
const output = path.resolve(__dirname, '../../../test-results/match-insights');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 390, 820, 1440]) for (const theme of ['dark', 'light']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await context.addInitScript(theme => {
        if (!localStorage.getItem('guestSmoke')) {
          localStorage.setItem('ludora_token', 'test'); localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
        }
        localStorage.setItem('ludora_tema', theme);
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' })); localStorage.setItem('ludora_clube_id', '2');
      }, theme);
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      let visual;
      await require('./visual-fixture.cjs').install(page, { decorate: data => { visual = data; } });
      await page.route('**/publico/clubes/2/*', route => route.fulfill({ json: visual[new URL(route.request().url()).pathname.split('/').pop()] || [] }));
      const players = [101, 102, 103, 104, 105, 106].map((id, i) => ({ jogador_id: id, numCamisa: i + 1, titular: i < 5, time_id: 13, ordem: i, jogador: { id, nome: `Atleta ${i + 1}`, posicao: 'Fixo' } }));
      const opponent = players.map(player => ({ ...player, jogador_id: player.jogador_id + 100, time_id: 14 }));
      const p = { id: 106, status: 'AO_VIVO', data: '2026-11-07', horario: '19:30', local: 'Ginásio', categoria_id: 1, categoria: { id: 1, nome: 'sub-7' }, mandante_id: 13, visitante_id: 14, mandante: { id: 13, nome: 'Ocian com um nome muito longo para conferir o layout' }, visitante: { id: 14, nome: 'Santos com nome longo para testar o truncamento' }, gols_mandante: 3, gols_visitante: 1, periodo_atual: 2, versao: 1, sumula_clube_id: 2, titulares_necessarios: 5 };
      const events = [
        { id: 1, tipo: 'GOL', time_id: 13, jogador_id: 101, jogador: players[0].jogador, periodo: 1 },
        { id: 2, tipo: 'GOL', time_id: 13, jogador_id: 102, jogador: players[1].jogador, periodo: 2 },
        { id: 3, tipo: 'GOL', time_id: 13, jogador_id: 201, jogador: opponent[0].jogador, gol_contra: true, periodo: 1 },
        { id: 4, tipo: 'GOL', time_id: 14, jogador_id: 202, jogador: opponent[1].jogador, periodo: 2 },
        { id: 5, tipo: 'DEFESA', time_id: 13, jogador_id: 103, jogador: players[2].jogador, periodo: 1 },
      ];
      let guest = false, external = false, matchReads = 0, pollReads = 0, writes = 0, loseReply = false, managerBlocked = false;
      let votes = { MANDANTE: 1, EMPATE: 1, VISITANTE: 1 }, own = null, revision = 1;
      const poll = () => {
        const total = Object.values(votes).reduce((a, b) => a + b), percentuais = Object.fromEntries(Object.entries(votes).map(([key, count]) => [key, Math.floor(count / total * 100)]));
        let missing = 100 - Object.values(percentuais).reduce((a,b) => a+b); const ranked = Object.keys(votes).sort((a,b) => (votes[b]/total*100%1)-(votes[a]/total*100%1));
        for (let i=0;i<missing;i++) percentuais[ranked[i]]++;
        return { partida_id: 106, revisao: revision, status: p.status, aberta: p.status === 'AO_VIVO', total, votos: votes, percentuais, meuVoto: guest ? null : own, podeVotar: guest ? undefined : !managerBlocked };
      };
      await page.route(url => url.origin !== new URL(base).origin && /\/(?:publico\/)?partidas\/106(?:\/gestao)?$/.test(url.pathname), route => {
        matchReads++;
        return route.fulfill({ json: { clube: { id: 2, nome: 'Ocian' }, partida: p, organizador: { id: 2, nome: 'Ocian' }, minhaEquipeId: guest ? undefined : 1, podePreparar: !guest, podeSumula: !guest, eventos: events, auditoria: [], equipes: [
          { id: 1, clube_id: 2, time_id: 13, categoria_id: 1, clube: { id: 2, nome: 'Ocian' }, publicada_em: '2026-11-07', pronta: true, escalacao: players },
          ...external ? [] : [{ id: 2, clube_id: 3, time_id: 14, categoria_id: 2, clube: { id: 3, nome: 'Santos' }, publicada_em: '2026-11-07', pronta: true, escalacao: opponent }],
        ] } });
      });
      await page.route('**/partidas/106/palpite', route => {
        if (route.request().method() === 'PUT') {
          writes++; const next = route.request().postDataJSON().escolha;
          if (own) votes[own]--; votes[next]++; own = next; revision++;
          if (loseReply) { loseReply = false; return route.abort(); }
        } else pollReads++;
        return route.fulfill({ json: poll() });
      });
      await page.clock.install();
      await page.goto(base + '/partidas/106');
      await page.locator('.match-insights').waitFor({timeout:15000}).catch(async error => { console.log(page.url(), (await page.locator('body').innerText()).slice(-2500), errors); await page.screenshot({path:path.join(output,'failure.png')}); throw error; }); await page.locator('.match-poll-options').waitFor();
      assert.deepEqual(await page.locator('.live-timeline-event').evaluateAll(nodes => nodes.map(node => Number(node.dataset.eventId))), [4,2,5,3,1], 'Agrupa por tempo e mantém os mais recentes no topo de cada grupo');
      const homeBounds = await page.locator('.live-timeline-event[data-event-id="2"]').boundingBox();
      const awayBounds = await page.locator('.live-timeline-event[data-event-id="4"]').boundingBox();
      assert.ok(awayBounds.x > homeBounds.x, 'Mandante à esquerda e visitante à direita');
      assert.equal(await page.locator('.live-timeline-period').count(), 2);
      assert.match(await page.locator('.live-timeline-event[data-event-id="3"]').innerText(), /A favor de Ocian/);
      const eventMenu = page.locator('.live-timeline-event .live-event-menu').first();
      await eventMenu.locator('summary').click();
      const menuBounds = await eventMenu.locator(':scope > div').boundingBox();
      assert.ok(menuBounds.x >= 0 && menuBounds.x + menuBounds.width <= width + 1, 'Menu do evento continua dentro da tela');
      await page.keyboard.press('Escape');
      assert.equal(await eventMenu.getAttribute('open'), null);
      assert.equal(await page.locator('.match-highlights-columns > section').count(), 1, 'Somente destaques do Ludora');
      assert.equal(await page.locator('.match-fan-highlight').count(), 0, 'Sem votação de atleta');
      assert.match(await page.locator('.match-insights-comparison').innerText(), /Faltas cometidas/);
      assert.equal(await page.locator('.highlight-category .highlight-ties').count(), 1);
      await page.locator('.highlight-category .highlight-ties').click(); await page.getByRole('dialog', { name: /participação em gols/i }).waitFor(); await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Como são calculados os destaques e as estatísticas' }).click();
      assert.match(await page.getByRole('dialog', { name: 'Como interpretar o Raio-X' }).innerText(), /0,6/); await page.keyboard.press('Escape');
      await page.locator('.match-insights-periods button').nth(2).click();
      assert.equal(await page.locator('.match-insights-metric').first().locator('dd strong').first().innerText(), '1');
      await page.locator('.match-insights-periods button').first().click();
      const initialReads = matchReads;
      await page.locator('.match-poll-options button').first().click();
      await page.waitForFunction(() => document.querySelector('.match-poll-options button')?.getAttribute('aria-pressed') === 'true');
      assert.equal(await page.locator('.match-poll-options button strong').first().innerText(), '50%');
      assert.equal(matchReads, initialReads, 'Votar não deve recarregar toda a partida');
      loseReply = true; await page.locator('.match-poll-options button').nth(1).click();
      await page.waitForFunction(() => document.querySelector('.match-poll-feedback')?.textContent.includes('confirmado'));
      assert.equal(writes, 2); assert.ok(pollReads >= 2); assert.equal(own, 'EMPATE');
      assert.equal(Object.values(votes).reduce((a,b) => a+b), 4);
      votes.VISITANTE++; revision++;
      await page.evaluate(payload => window.dispatchEvent(new CustomEvent('ludora:match-poll-changed', { detail: payload })), { ...poll(), meuVoto: undefined });
      await page.waitForFunction(() => document.querySelector('.match-poll header p')?.textContent.includes('5 palpites'));
      await page.evaluate(payload => window.dispatchEvent(new CustomEvent('ludora:match-poll-changed', { detail: payload })), { ...poll(), revisao: 0, total: 0, votos: { MANDANTE: 0, EMPATE: 0, VISITANTE: 0 }, percentuais: { MANDANTE: 0, EMPATE: 0, VISITANTE: 0 } });
      assert.match(await page.locator('.match-poll header p').innerText(), /5 palpites/);
      assert.equal(matchReads, initialReads);
      await page.waitForFunction(() => { const button = document.querySelector('.match-poll-options button'); return button && Math.abs(button.querySelector('.match-poll-fill').getBoundingClientRect().height / button.clientHeight - .2) < .015; });
      const fill = await page.locator('.match-poll-options button').first().evaluate(node => {
        const button = node.getBoundingClientRect(), bar = node.querySelector('.match-poll-fill').getBoundingClientRect();
        return { ratio: bar.height / node.clientHeight, bottom: Math.abs(bar.bottom - button.bottom), height: button.height,
          crest: node.querySelector('.club-badge').getBoundingClientRect().width };
      });
      assert.ok(Math.abs(fill.ratio - .2) < .015, 'O preenchimento vertical representa 20%');
      assert.ok(fill.bottom <= 1, 'A barra cresce a partir da base do botão');
      if (width > 1100) { assert.ok(fill.height < 90, 'Botão desktop mais compacto'); assert.equal(fill.crest, 30); }
      assert.ok(await page.locator('.match-poll-fill').first().evaluate(node => parseFloat(getComputedStyle(node).transitionDuration) < .001), 'Respeita movimento reduzido');
      if (width === 1440 && theme === 'dark') {
        await page.emulateMedia({reducedMotion:'no-preference'});
        assert.equal(await page.locator('.match-poll-fill').first().evaluate(node => getComputedStyle(node).transitionDuration), '0.4s', 'Anima a subida/descida da porcentagem');
        await page.emulateMedia({reducedMotion:'reduce'});
      }
      const layout = () => page.evaluate(() => Object.fromEntries(['.match-insights','.live-workspace','.live-main','.live-side-panel','.live-timeline','.live-timeline-items','.match-poll','.live-ownership'].map(selector => { const rect = document.querySelector(selector).getBoundingClientRect(); return [selector,{top:rect.top+scrollY,height:rect.height}]; })));
      const position = () => page.locator('.match-insights').evaluate(node => node.getBoundingClientRect().top + scrollY);
      const beforeEvents = await position(), savedEvents = [...events], previousLayout = await layout();
      for (let i = 0; i < 45; i++) events.push({ id: 100 + i, tipo: 'DEFESA', time_id: 13, jogador_id: 101, jogador: players[0].jogador, periodo: 2 });
      await page.clock.fastForward(16000);
      await page.waitForFunction(() => document.querySelectorAll('.live-timeline-event').length === 50);
      assert.ok(Math.abs(await position() - beforeEvents) <= 1, `Novos lances não deslocam o Raio-X: ${JSON.stringify({width, before:previousLayout,after:await layout()})}`);
      const scrollable = page.getByRole('region', { name: 'Acontecimentos da partida' });
      assert.ok(await scrollable.evaluate(node => { node.scrollTop = node.scrollHeight; return node.scrollTop > 0; }), 'Os lances continuam acessíveis por rolagem interna');
      events.splice(0);
      await page.clock.fastForward(16000);
      await page.getByText('Nenhum evento registrado', {exact:true}).waitFor();
      assert.ok(Math.abs(await position() - beforeEvents) <= 1, 'O estado vazio mantém a mesma altura');
      events.push(...savedEvents);
      await page.clock.fastForward(16000);
      await page.waitForFunction(() => document.querySelectorAll('.live-timeline-event').length === 5);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      for (const selector of ['.match-poll','.match-insights-comparison','.match-highlights']) assert.equal(await page.locator(selector).evaluate(node => node.scrollWidth > node.clientWidth + 1), false, selector + ' overflow');
      await page.locator('.match-insights').screenshot({ path: path.join(output, `${width}-${theme}.png`) });
      await page.locator('.match-poll').screenshot({ path: path.join(output, `${width}-${theme}-poll.png`) });
      await page.locator('.live-timeline').screenshot({ path: path.join(output, `${width}-${theme}-events.png`) });
      if (width === 390 && theme === 'dark') {
        p.status = 'FINALIZADA'; await page.reload(); await page.locator('.match-poll-options').waitFor();
        assert.equal(await page.locator('.match-poll-options button:not(:disabled)').count(), 0);
        assert.match(await page.locator('.match-poll').innerText(), /votação encerrada/);
        managerBlocked = true; p.status = 'AO_VIVO';
        const managerPoll = page.waitForResponse(response => response.url().endsWith('/partidas/106/palpite'));
        await page.reload(); await managerPoll;
        await page.getByRole('button', { name: /Registrar gol/ }).first().waitFor();
        await page.locator('.match-poll').waitFor({state:'hidden'});
        assert.equal(writes, 2, 'Gestor da partida não registra palpite');
        guest = true; external = true; p.status = 'AO_VIVO';
        await page.evaluate(() => { localStorage.setItem('guestSmoke','true'); localStorage.removeItem('ludora_token'); localStorage.removeItem('ludora_usuario'); });
        await page.reload(); await page.locator('.match-insights').waitFor({timeout:15000}).catch(async error => { console.log('guest',page.url(), (await page.locator('body').innerText()).slice(-2200), errors); throw error; }); await page.locator('.match-poll-options').waitFor();
        assert.equal(await page.locator('.match-poll-options button:not(:disabled)').count(), 0);
        await page.getByRole('link', { name: /Entrar para dar um palpite/ }).waitFor();
        assert.equal(await page.locator('.match-highlights .highlight-player').filter({hasText:'Santos'}).count(), 0, 'Não inventa destaques de elenco externo');
        assert.equal(await page.getByRole('button', { name: /Registrar gol/ }).count(), 0);
      }
      assert.deepEqual(errors, []); console.log(`OK comparativo/destaques/votação ${width}px ${theme}`); await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
