// Interactive regression cases with strict, in-memory API responses. No real database writes.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5191';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [360, 1180]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(() => {
        localStorage.setItem('ludora_token', 'test');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
        localStorage.setItem('ludora_clube_id', '2');
        window.matchBoardRenders = 0;
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
          supportsFiber: true, renderers: new Map(),
          inject(renderer) { this.renderers.set(1, renderer); return 1; }, onCommitFiberUnmount() {},
          onCommitFiberRoot(_id, root) {
            function walk(fiber) {
              if (!fiber) return;
              if (fiber.type?.name === 'MatchLiveSession' && (fiber.flags & 1)) window.matchBoardRenders++;
              walk(fiber.child); walk(fiber.sibling);
            }
            walk(root.current);
          },
        };
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      await require('./visual-fixture.cjs').install(page);
      const lineup = (team, offset, name) => Array.from({ length: 6 }, (_, i) => ({
        jogador_id: offset + i, numCamisa: i + 1, titular: i < 5, titular_inicial: i < 5, time_id: team, ordem: i,
        jogador: { nome: `${name} ${i + 1}`, posicao: i === 0 ? 'Goleiro' : 'Fixo' },
      }));
      const players = lineup(13, 101, 'Ocian'), opponent = lineup(14, 201, 'Santos');
      const p = { id: 106, status: 'AO_VIVO', versao: 1, periodo_atual: 1, data: '2026-11-07', horario: '19:30', categoria_id: 1, categoria: { id: 1, nome: 'sub-7' }, mandante_id: 13, visitante_id: 14, mandante: { id: 13, nome: 'Ocian' }, visitante: { id: 14, nome: 'Santos' }, gols_mandante: 0, gols_visitante: 0, sumula_clube_id: 2, titulares_necessarios: 5 };
      let events = [], audits = [], nextId = 1, posts = 0, gets = 0, patches = 0, requests = 0;
      let operator = true, authorized = false, reject = 0, abortReply = false, substitutions = 0, transfers = 0;
      const saved = new Map(), removed = new Set();
      const data = () => ({ partida: p, organizador: { id: 2, nome: 'Ocian' }, minhaEquipeId: 1, podePreparar: true, podeSumula: operator, podeCorrigir: authorized, eventos: events, auditoria: audits, equipes: [
        { id: 1, clube_id: 2, time_id: 13, categoria_id: 1, clube: { id: 2, nome: 'Ocian' }, publicada_em: '2026-11-07', escalacao: players },
        { id: 2, clube_id: 3, time_id: 14, categoria_id: 2, clube: { id: 3, nome: 'Santos' }, publicada_em: '2026-11-07', escalacao: opponent },
      ] });
      await page.route('**/partidas/106/gestao', route => { gets++; return route.fulfill({ json: data() }); });
      await page.route('**/partidas/106/eventos', route => {
        posts++; const body = route.request().postDataJSON();
        assert.ok(p.status !== 'FINALIZADA' || body.motivo?.trim(), 'Inclusão pós-jogo exige motivo');
        if (reject) return route.fulfill({ status: reject, json: { error: 'O jogador saiu de campo em outro dispositivo.' } });
        if (saved.has(body.request_id)) return route.fulfill({ json: saved.get(body.request_id) });
        const player = [...players, ...opponent].find(row => row.jogador_id === body.jogador_id);
        const event = { ...body, id: nextId++, jogador: player?.jogador || null };
        events.unshift(event);
        if (body.tipo === 'GOL') p[body.time_id === 13 ? 'gols_mandante' : 'gols_visitante']++;
        let assist;
        if (body.assistencia_jogador_id) {
          const player = players.find(row => row.jogador_id === body.assistencia_jogador_id);
          assist = { id: nextId++, tipo: 'ASSISTENCIA', time_id: body.time_id, jogador_id: player.jogador_id, jogador: player.jogador, periodo: body.periodo };
          events.unshift(assist);
        }
        audits.unshift({ id: audits.length + 1, acao: 'EVENTO_REGISTRADO', criado_em: new Date().toISOString(), dados: { evento_id: event.id, assistencia_evento_id: assist?.id, evento: event } });
        saved.set(body.request_id, event); p.versao++;
        if (abortReply) { abortReply = false; return route.abort(); }
        return route.fulfill({ json: event });
      });
      await page.route('**/eventos/*', route => {
        if (route.request().method() !== 'DELETE') return route.fallback();
        const body = route.request().postDataJSON(), id = Number(new URL(route.request().url()).pathname.split('/').pop());
        if (removed.has(body.request_id)) return route.fulfill({ json: { ok: true } });
        assert.ok(p.status !== 'FINALIZADA' || body.motivo?.trim(), 'Pós-jogo exige motivo');
        const event = events.find(event => event.id === id);
        if (!event) return route.fulfill({ status: 404, json: { error: 'Evento removido em outro dispositivo.' } });
        const assistId = audits.find(entry => entry.dados?.evento_id === id)?.dados.assistencia_evento_id;
        if (event.tipo === 'GOL') p[event.time_id === 13 ? 'gols_mandante' : 'gols_visitante']--;
        events = events.filter(event => event.id !== id && event.id !== assistId); p.versao++;
        removed.add(body.request_id);
        return route.fulfill({ json: { ok: true } });
      });
      await page.route('**/partidas/106/eventos/*', route => {
        patches++; const body = route.request().postDataJSON();
        assert.ok(p.status !== 'FINALIZADA' || body.motivo?.trim(), 'Identificação finalizada exige justificativa');
        const event = events.find(event => event.id === Number(new URL(route.request().url()).pathname.split('/').pop()));
        event.jogador_id = body.jogador_id; event.jogador = players.find(row => row.jogador_id === body.jogador_id).jogador; p.versao++;
        return route.fulfill({ json: event });
      });
      await page.route('**/partidas/106/substituicoes', route => {
        substitutions++; const body = route.request().postDataJSON();
        const out = players.find(row => row.jogador_id === body.sai), into = players.find(row => row.jogador_id === body.entra);
        assert.ok(out.titular && !into.titular); out.titular = false; into.titular = true; p.versao++;
        return route.fulfill({ json: { ok: true } });
      });
      await page.route('**/partidas/106/correcoes', route => {
        requests++; assert.ok(route.request().postDataJSON().motivo.trim()); return route.fulfill({ json: { id: 'request-1' } });
      });
      await page.route('**/partidas/106/sumula', route => {
        transfers++; return route.fulfill({ json: { id: 'transfer-1' } });
      });
      async function open() {
        await page.goto(base + '/partidas/106');
        try { await page.locator('.live-ownership').waitFor(); }
        catch (error) { console.error({ errors, page: await page.locator('body').innerText() }); throw error; }
      }
      async function publish() {
        await page.clock.fastForward(5300);
        await page.waitForFunction(() => !document.querySelector('.live-review-queue') || /Dispensar|Conferir envio/.test(document.querySelector('.live-review-queue').textContent));
      }
      async function queueGoal(assist = false) {
        await page.getByRole('button', { name: 'Registrar gol do Ocian', exact: true }).click();
        const modal = page.getByRole('dialog', { name: 'Quem marcou pelo Ocian?', exact: true });
        await modal.locator('.live-player-options button:not(:disabled)').first().click();
        if (assist) {
          await modal.locator('.live-event-extra summary').click();
          await modal.getByRole('combobox', { name: 'Assistência (opcional)' }).click();
          await modal.getByRole('option', { name: '#2 · Ocian 2', exact: true }).click();
        }
        await modal.getByRole('button', { name: 'Registrar gol', exact: true }).click();
      }
      await open(); await page.clock.install();
      // A server-side rejection must be dismissible; an uncertain network reply must retain its ID.
      for (const status of [400, 409]) {
        reject = status; await queueGoal(); await publish();
        await page.getByRole('button', { name: 'Dispensar', exact: true }).click();
        assert.equal(p.gols_mandante, 0);
        assert.equal(await page.getByRole('button', { name: 'Finalizar partida', exact: true }).isEnabled(), true);
      }
      reject = 0; abortReply = true; await queueGoal(); await publish();
      const retry = page.getByRole('button', { name: 'Conferir envio', exact: true }); await retry.waitFor();
      assert.equal(p.gols_mandante, 1, 'Resposta perdida após commit mantém o gol');
      await retry.click(); await page.clock.fastForward(400); await page.locator('.live-review-queue').waitFor({ state: 'detached' });
      assert.equal(p.gols_mandante, 1); assert.equal(events.length, 1);

      // Goal + assist is one undo operation, not just removal of the assist.
      await queueGoal(true); await publish(); assert.equal(events.length, 3);
      await page.getByRole('button', { name: 'Desfazer último', exact: true }).click();
      let modal = page.getByRole('dialog', { name: 'Anular este gol?', exact: true }); await modal.waitFor();
      await modal.getByLabel('Motivo', { exact: true }).fill('');
      await modal.getByRole('button', { name: 'Anular gol', exact: true }).click(); await publish();
      assert.equal(p.gols_mandante, 1); assert.equal(events.length, 1, 'Anulação também remove a assistência vinculada');

      // The review timer must not rerender the complete match board every second.
      await queueGoal(); await page.clock.fastForward(400);
      const rendersBefore = await page.evaluate(() => window.matchBoardRenders);
      assert.ok(rendersBefore > 0, 'Instrumentação de renderização ativa');
      await page.clock.fastForward(3000);
      assert.equal(await page.evaluate(() => window.matchBoardRenders), rendersBefore, 'Contador atualiza apenas seu próprio componente');
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      console.log(`Renderização ${width}px: 0 renders do quadro nos 3s de contagem`);

      // Browser storage restrictions must not crash the queue or prevent cancellation.
      await page.evaluate(() => {
        window.originalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) { if (key.startsWith('ludora:event-review:')) throw new DOMException('Quota', 'QuotaExceededError'); return window.originalSetItem.call(this, key, value); };
      });
      await queueGoal(); await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await page.evaluate(() => { Storage.prototype.setItem = window.originalSetItem; });

      // A selection invalidated by realtime cannot be confirmed.
      await page.getByRole('button', { name: 'Fazer substituição', exact: true }).click();
      modal = page.getByRole('dialog', { name: 'Fazer substituição', exact: true });
      await modal.getByRole('group', { name: 'Titulares para sair' }).getByRole('button').first().click();
      await modal.getByRole('group', { name: 'Reservas para entrar' }).getByRole('button').first().click();
      players[0].titular = false; players[5].titular = true;
      const previousReads = gets;
      const synchronization = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/partidas/106/gestao'));
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await synchronization;
      await modal.getByRole('group', { name: 'Reservas para entrar' }).getByRole('button', { name: /Ocian 1/ }).waitFor();
      assert.ok(gets > previousReads);
      assert.equal(await modal.getByRole('button', { name: 'Confirmar troca', exact: true }).isDisabled(), true);
      await modal.getByRole('button', { name: 'Voltar', exact: true }).click();
      assert.equal(substitutions, 0);

      // Dragging and rapid repeated confirmation execute a single valid substitution.
      await page.getByRole('button', { name: 'Fazer substituição', exact: true }).click();
      modal = page.getByRole('dialog', { name: 'Fazer substituição', exact: true });
      const reserve = modal.getByRole('group', { name: 'Reservas para entrar' }).getByRole('button').first();
      const starter = modal.getByRole('group', { name: 'Titulares para sair' }).getByRole('button').first();
      await reserve.dragTo(starter);
      assert.equal(await reserve.getAttribute('aria-pressed'), 'true');
      assert.equal(await starter.getAttribute('aria-pressed'), 'true');
      await modal.getByRole('button', { name: 'Confirmar troca', exact: true }).evaluate(button => { button.click(); button.click(); });
      await modal.waitFor({ state: 'detached' }); assert.equal(substitutions, 1);

      // Stale authors cannot be saved after another operator takes them off the field.
      await page.getByRole('button', { name: 'Registrar gol do Ocian', exact: true }).click();
      modal = page.getByRole('dialog', { name: 'Quem marcou pelo Ocian?', exact: true });
      await modal.locator('.live-player-options button:not(:disabled)').first().click();
      const selectedName = await modal.locator('.live-player-options button[aria-pressed="true"] strong').innerText();
      const selected = players.find(player => player.jogador.nome === selectedName), replacement = players.find(player => !player.titular);
      selected.titular = false; replacement.titular = true;
      const authorSync = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/partidas/106/gestao'));
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await authorSync;
      await modal.locator('.live-player-options button[aria-pressed="true"]:disabled').waitFor();
      assert.equal(await modal.getByRole('button', { name: 'Registrar gol', exact: true }).isDisabled(), true);
      await modal.getByRole('button', { name: 'Voltar', exact: true }).click();

      operator = false; p.sumula_clube_id = 3; await open();
      await page.locator('.live-settings summary').click();
      assert.equal(await page.getByRole('button', { name: 'Corrigir placar com justificativa', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Responsável pela súmula', exact: true }).click();
      modal = page.getByRole('dialog', { name: 'Responsável pela súmula', exact: true });
      await modal.getByRole('button', { name: 'Solicitar responsabilidade', exact: true }).click();
      await modal.waitFor({ state: 'detached' }); assert.equal(transfers, 1);
      assert.equal(await page.getByRole('button', { name: 'Registrar gol do Ocian', exact: true }).count(), 0, 'Pedido de transferência não concede operação antes do aceite');
      operator = true; p.sumula_clube_id = 2;

      // Pending authors after the final whistle need a visible, required reason.
      p.status = 'FINALIZADA';
      events[0].jogador_id = null; events[0].jogador = null;
      await open();
      await page.locator('.live-timeline-event.has-pending').getByRole('button', { name: 'Identificar jogador', exact: true }).first().click();
      modal = page.getByRole('dialog', { name: 'Identificar jogador', exact: true });
      await modal.locator('.live-player-options button').first().click();
      assert.equal(await modal.getByRole('button', { name: 'Salvar autoria', exact: true }).isDisabled(), true);
      await modal.getByLabel('Motivo da correção', { exact: true }).fill('Autor identificado ao revisar a súmula');
      await modal.getByRole('button', { name: 'Salvar autoria', exact: true }).click();
      await modal.waitFor({ state: 'detached' }); assert.equal(patches, 1); assert.equal(p.gols_mandante, 1);

      // Non-operators request permission, then use the existing temporary authorization.
      operator = false; p.sumula_clube_id = 3; await open();
      assert.equal(await page.getByRole('button', { name: 'Adicionar evento com justificativa', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Solicitar edição da súmula', exact: true }).click();
      modal = page.getByRole('dialog', { name: 'Solicitar edição da súmula', exact: true });
      assert.equal(await modal.getByRole('button', { name: 'Enviar solicitação', exact: true }).isDisabled(), true);
      await modal.getByLabel('O que precisa ser corrigido?', { exact: true }).fill('Corrigir a autoria');
      await modal.getByRole('button', { name: 'Enviar solicitação', exact: true }).click();
      await modal.waitFor({ state: 'detached' }); assert.equal(requests, 1);
      authorized = true; await open();
      await page.getByRole('button', { name: 'Adicionar evento com justificativa', exact: true }).waitFor();
      assert.ok(await page.locator('.live-event-menu').count());
      const scoreBeforeCorrection = p.gols_mandante;
      await page.getByRole('button', { name: 'Adicionar evento com justificativa', exact: true }).click();
      modal = page.getByRole('dialog');
      await modal.getByRole('combobox', { name: /Tipo de evento/ }).click();
      await modal.getByRole('option', { name: 'Falta', exact: true }).click();
      await modal.locator('.live-player-options button').first().click();
      assert.equal(await modal.getByRole('button', { name: 'Registrar evento', exact: true }).isDisabled(), true);
      await modal.getByLabel('Motivo da correção', { exact: true }).fill('Falta conferida na súmula após autorização');
      await modal.getByRole('button', { name: 'Registrar evento', exact: true }).click();
      await modal.waitFor({ state: 'detached' });
      assert.equal(p.gols_mandante, scoreBeforeCorrection);
      const correctedEvent = events.find(event => event.tipo === 'FALTA');
      await page.locator(`[data-event-id="${correctedEvent.id}"] .live-event-menu summary`).click();
      await page.getByRole('button', { name: 'Remover evento', exact: true }).click();
      modal = page.getByRole('dialog', { name: 'Remover evento?', exact: true });
      assert.equal(await modal.getByRole('button', { name: 'Remover evento', exact: true }).isDisabled(), true);
      await modal.getByLabel('Motivo', { exact: true }).fill('Correção após conferência');
      await modal.getByRole('button', { name: 'Remover evento', exact: true }).click(); await publish();
      assert.equal(events.some(event => event.id === correctedEvent.id), false, 'Autorização permite remoção pós-jogo com justificativa');
      assert.equal(p.gols_mandante, scoreBeforeCorrection);
      assert.equal(await page.getByRole('button', { name: 'Desfazer último', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Finalizar partida', exact: true }).count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      console.log(`Auditoria OK ${width}px: rejeições, resposta perdida, desfazer gol/assist, fila, sincronização, pós-jogo e autorização (${posts} envios simulados)`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
