const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const { Server } = require(path.resolve(__dirname, '../../../services/api/node_modules/socket.io'));

// HTTP de partidas/cadastro controlado; Socket.IO real entre duas abas, sem banco.
(async () => {
  const server = http.createServer();
  const io = new Server(server, { cors: { origin: '*' }, allowUpgrades: false, transports: ['polling'] });
  io.on('connection', socket => socket.join('clube:2'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [390, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      await context.addInitScript(() => {
        localStorage.setItem('ludora_token', 'fixture'); localStorage.setItem('ludora_tema', 'dark');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
        localStorage.setItem('ludora_clube_id', '2');
      });
      const players = Array.from({ length: 8 }, (_, i) => ({ id: 100 + i, nome: `Atleta ${i + 1}`, numCamisa: i === 7 ? null : i + 1,
        posicao: i === 1 ? 'Goleiro' : 'Fixo', categoria_id: 1, ativo: true, dtNasc: '2019-01-01' }));
      let lineup = players.slice(0, 6).map((j, i) => ({ jogador_id: j.id, numCamisa: j.numCamisa, titular: i < 5 }));
      const historical = structuredClone(lineup);
      const errors = [];
      const pages = await Promise.all([context.newPage(), context.newPage(), context.newPage()]);
      for (const page of pages) {
        page.on('pageerror', e => errors.push(e.message));
        page.on('dialog', dialog => dialog.accept());
        await require('./visual-fixture.cjs').install(page);
        await page.route(/\/socket\.io\//, async route => {
          try {
            const url = new URL(route.request().url()); url.hostname = '127.0.0.1'; url.port = String(port);
            const response = await route.fetch({ url: url.toString(), timeout: 35000 });
            await route.fulfill({ response });
          } catch { await route.abort().catch(() => {}); }
        });
        await page.route('**/jogadores?*', route => {
          const query = new URL(route.request().url()).searchParams;
          return route.fulfill({ json: query.get('resumo') === 'true' ? [{ categoria_id: 1, total: players.length, semCamisa: players.filter(j => j.numCamisa == null).length }] : players });
        });
        await page.route(/\/jogadores\/10[0-7]$/, route => {
          const j = players.find(j => j.id === Number(route.request().url().split('/').pop()));
          const body = route.request().postDataJSON();
          const conflict = players.find(p => p.id !== j.id && p.numCamisa === body.numCamisa);
          if (conflict && !body.confirmar_camisa) return route.fulfill({ status: 409, json: { error: 'Camisa em uso', conflito_camisa: {
            jogador_id: conflict.id, nome: conflict.nome, camisa: body.numCamisa, categoria: 'sub-7', camisa_anterior: j.numCamisa } } });
          const changes = [{ id: j.id, numCamisa: body.numCamisa, categoria_id: 1 }];
          if (conflict) { conflict.numCamisa = j.numCamisa; changes.push({ id: conflict.id, numCamisa: conflict.numCamisa, categoria_id: 1 }); }
          j.numCamisa = body.numCamisa;
          const removed = lineup.filter(r => players.find(j => j.id === r.jogador_id).numCamisa == null).map(r => r.jogador_id);
          lineup = lineup.flatMap(r => { const n = players.find(j => j.id === r.jogador_id).numCamisa; return n == null ? [] : [{ ...r, numCamisa: n }]; });
          io.to('clube:2').emit('elenco_atualizado', { clube_id: 2, jogadores: changes });
          io.to('clube:2').emit('partida_atualizada', { id: 106 });
          return route.fulfill({ json: { ...j, camisas_atualizadas: changes, escalacoes_atualizadas: [{ partida_id: 106, removidos: removed }] } });
        });
        await require('./shared-match-fixture.cjs').install(page, { players, lineup: () => lineup });
        await page.route('**/partidas/107/gestao', route => route.fulfill({ json: {
          partida: { id: 107, status: 'FINALIZADA', gols_mandante: 2, gols_visitante: 1, categoria_id: 1, data: '2026-11-01', horario: '19:30',
            mandante_id: 13, visitante_id: 14, sumula_clube_id: 2, organizador_id: 2, periodo_atual: 1, mandante: { nome: 'Ocian' }, visitante: { nome: 'Aurora' } },
          minhaEquipeId: 1, podePreparar: true, podeSumula: true, organizador: { id: 2, nome: 'Ocian' }, eventos: [], auditoria: [],
          equipes: [{ id: 1, clube_id: 2, time_id: 13, categoria_id: 1, pronta: true, publicada_em: '2026-11-01', clube: { id: 2, nome: 'Ocian' }, escalacao: historical.map(r => ({ ...r, jogador: players.find(j => j.id === r.jogador_id) })) }],
        } }));
      }
      const [students, preparation, finished] = pages;
      const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5191';
      await Promise.all([students.goto(base + '/jogadores'), preparation.goto(base + '/partidas/106'), finished.goto(base + '/partidas/107')]);
      await preparation.getByRole('navigation', { name: 'Etapas da preparação' }).getByRole('button', { name: 'Escalação', exact: true }).click();
      await preparation.getByRole('button', { name: 'Convocar Atleta 7', exact: true }).click(); // Rascunho ainda não salvo.
      const historicalShirt = finished.locator('.lineup-row').filter({ hasText: 'Atleta 1' }).locator('.lineup-shirt');
      await historicalShirt.waitFor();
      assert.equal((await historicalShirt.innerText()).trim(), '01');
      await students.getByRole('button', { name: 'Editar camisa de Atleta 1', exact: true }).click();
      await students.getByRole('textbox', { name: 'Camisa de Atleta 1', exact: true }).fill('9');
      await students.getByRole('textbox', { name: 'Camisa de Atleta 1', exact: true }).press('Enter');
      await preparation.waitForFunction(() => document.querySelector('[data-lineup-id="100"] .lineup-shirt')?.textContent.trim() === '09');
      assert.equal(await preparation.locator('[data-lineup-id="106"]').count(), 1, 'atualização externa preserva convocação não salva');
      assert.equal((await historicalShirt.innerText()).trim(), '01', 'partida encerrada mantém a camisa histórica');
      // Pelo elenco da preparação, transferir a camisa do titular atualiza Jogadores em outra aba.
      await preparation.getByRole('button', { name: 'Definir camisa de Atleta 8', exact: true }).click();
      await preparation.getByRole('textbox', { name: 'Número da camisa', exact: true }).fill('9');
      await preparation.getByRole('button', { name: 'Salvar camisa', exact: true }).click();
      await preparation.getByRole('button', { name: 'Confirmar troca', exact: true }).click();
      await preparation.getByRole('button', { name: 'Definir camisa de Atleta 1', exact: true }).waitFor();
      await students.getByRole('button', { name: 'Definir camisa de Atleta 1', exact: true }).waitFor();
      await preparation.waitForFunction(() => !document.querySelector('[data-lineup-id="100"]'));
      assert.equal(await preparation.locator('[data-lineup-id="106"]').count(), 1);
      // Transferir a camisa de um reserva também o retira, sem apagar outro rascunho.
      await students.getByRole('button', { name: 'Definir camisa de Atleta 1', exact: true }).click();
      await students.getByRole('textbox', { name: 'Camisa de Atleta 1', exact: true }).fill('6');
      await students.getByRole('textbox', { name: 'Camisa de Atleta 1', exact: true }).press('Enter');
      await students.getByRole('button', { name: 'Confirmar troca', exact: true }).click();
      await preparation.waitForFunction(() => !document.querySelector('[data-lineup-id="105"]'));
      assert.equal(await preparation.locator('[data-lineup-id="106"]').count(), 1);
      // Um evento perdido durante desconexão é recuperado ao conectar novamente.
      players[4].numCamisa = 42;
      lineup = lineup.map(r => r.jogador_id === 104 ? { ...r, numCamisa: 42 } : r);
      for (const socket of io.sockets.sockets.values()) socket.conn.close();
      await preparation.waitForFunction(() => document.querySelector('[data-lineup-id="104"] .lineup-shirt')?.textContent.trim() === '42');
      await students.waitForFunction(() => document.querySelector('[aria-label="Editar camisa de Atleta 5"]')?.textContent.includes('42'));
      assert.equal(await preparation.locator('[data-lineup-id="106"]').count(), 1);
      await finished.reload();
      await historicalShirt.waitFor();
      assert.equal((await historicalShirt.innerText()).trim(), '01');
      assert.deepEqual(errors, []);
      console.log(`Cross-page shirts OK ${width}px: Jogadores ↔ preparação, Socket.IO + reconnection, dirty draft, removed starter/reserve, finalized snapshot`);
      await context.close();
    }
  } finally { await browser.close(); await new Promise(resolve => io.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
