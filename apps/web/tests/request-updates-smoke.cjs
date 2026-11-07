const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const { chromium } = require('playwright');
const { install } = require('./visual-fixture.cjs');
const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5191';

// Transporte Engine.IO/Socket.IO simulado no navegador, sem acessar a API ou o banco.
async function realtime(page) {
  let next = 0;
  const clients = new Map();
  const fulfill = (route, body) => route.fulfill({ contentType: 'text/plain', body }).catch(() => {});
  await page.route('http://localhost:3000/socket.io/**', async route => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'POST') return fulfill(route, 'ok');
    const sid = url.searchParams.get('sid');
    if (!sid) {
      const id = 'fixture-' + ++next;
      clients.set(id, { connected: false, waiting: null, packets: [] });
      return fulfill(route, '0' + JSON.stringify({ sid: id, upgrades: [], pingInterval: 60000, pingTimeout: 20000, maxPayload: 1000000 }));
    }
    const client = clients.get(sid);
    if (!client) return route.fulfill({ status: 400, body: 'Unknown fixture session' });
    if (!client.connected) { client.connected = true; return fulfill(route, '40' + JSON.stringify({ sid })); }
    if (client.packets.length) return fulfill(route, client.packets.shift());
    client.waiting = route;
  });
  return {
    get connected() { return [...clients.values()].some(c => c.connected && c.waiting); },
    async emit() {
      const packet = '42' + JSON.stringify(['solicitacao_partida', { id: 'new-proposal' }]);
      await Promise.all([...clients.values()].map(client => {
        if (!client.waiting) { client.packets.push(packet); return; }
        const route = client.waiting; client.waiting = null; return fulfill(route, packet);
      }));
    },
  };
}
async function until(check) { for (let i = 0; i < 150; i++) { if (await check()) return; await delay(30); } throw Error('Condição de teste não atingida'); }

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [320, 820, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(() => {
        localStorage.setItem('ludora_token', 'fixture-test');
        localStorage.setItem('ludora_usuario', JSON.stringify({ id: 1, nome: 'Alex' }));
        localStorage.setItem('ludora_clube', JSON.stringify({ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }));
        localStorage.setItem('ludora_clube_id', '2');
        // Preferência antiga de visitante não deve impor esse modo a um gestor.
        localStorage.setItem('ludora_navigation_mode', 'publico');
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await install(page);
      const socket = await realtime(page);
      const proposal = id => ({ id, tipo: 'CRIACAO', origem_id: 3, destino_id: 2, respondente_id: 2, status: 'PENDENTE', versao: 1,
        origem: { id: 3, nome: 'Santos' }, destino: { id: 2, nome: 'Ocian' }, categoria_nome: 'SUB-7', dados: { data: '2026-11-17', horario: '20:00' } });
      let rows = [proposal('first')], reads = 0, inFlight = 0, maximum = 0, fail = false;
      await page.route('http://localhost:3000/partidas/solicitacoes', async route => {
        reads++; inFlight++; maximum = Math.max(maximum, inFlight);
        const snapshot = rows.slice(), status = fail ? 500 : 200;
        await delay(200); inFlight--;
        return route.fulfill({ status, json: status === 200 ? snapshot : { error: 'Falha temporária de teste' } });
      });
      await page.goto(base + '/partidas/solicitacoes');
      await page.locator('.shared-proposal').waitFor();
      await page.getByRole('button', { name: 'Atualizar solicitações' }).waitFor({ state: 'visible' });
      await until(() => socket.connected);
      assert.ok(reads <= 2, 'entrada faz a leitura inicial e, se necessário, reconcilia ao conectar');
      assert.equal(await page.locator('.public-header').count(), 0, 'gestor não é colocado como visitante');

      rows.push(proposal('manual'));
      await page.getByRole('button', { name: 'Atualizar solicitações' }).click();
      assert.equal(await page.locator('.shared-proposal').count(), 1, 'atualizar preserva os cards existentes');
      await until(async () => await page.locator('.shared-proposal').count() === 2);
      rows.push(proposal('socket'));
      await socket.emit();
      await until(async () => await page.locator('.shared-proposal').count() === 3);

      // Um evento enquanto uma leitura antiga está em voo exige uma leitura posterior.
      const start = reads;
      await page.getByRole('button', { name: 'Atualizar solicitações' }).click();
      await until(() => reads > start);
      rows.push(proposal('during-load'));
      await socket.emit();
      await until(async () => await page.locator('.shared-proposal').count() === 4);
      assert.equal(maximum, 1, 'consultas da tela não se sobrepõem');

      rows.push(proposal('focus'));
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await until(async () => await page.locator('.shared-proposal').count() === 5);
      fail = true;
      await page.getByRole('button', { name: 'Atualizar solicitações' }).click();
      await page.getByRole('alert').filter({ hasText: 'O serviço está indisponível' }).waitFor();
      assert.equal(await page.locator('.shared-proposal').count(), 5, 'falha temporária preserva a lista');
      fail = false;
      await page.getByRole('button', { name: 'Atualizar solicitações' }).click();
      await until(async () => await page.getByRole('alert').count() === 0);

      if (width === 1366) {
        const beforePoll = reads;
        rows.push(proposal('poll'));
        await page.waitForFunction(() => document.querySelectorAll('.shared-proposal').length === 6, undefined, { timeout: 18000 });
        assert.ok(reads > beforePoll, 'reconciliação automática funciona mesmo com socket conectado');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      console.log(`OK solicitações ${width}px: manual, socket, evento durante leitura, retorno à aba, falha transitória e sem consultas paralelas`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
