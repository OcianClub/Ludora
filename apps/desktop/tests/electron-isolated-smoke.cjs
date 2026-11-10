// Processo Electron real + API e Socket simulados. Perfil e exportação temporários.
// Não conecta à API, não abre um banco e não altera a área de transferência real.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require('playwright');

async function main() {
  const desktop = path.resolve(__dirname, '..');
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'ludora-desktop-audit-'));
  const exportPath = path.join(profile, 'logs-auditoria.txt');
  const wrapper = path.join(profile, 'launch.cjs');
  await fs.writeFile(wrapper, `
    const { app, clipboard, dialog } = require('electron');
    app.setPath('userData', ${JSON.stringify(profile)});
    global.__fixture = { role: 'SUPERADMIN', clipboard: '', requests: [], cancelExport: false, login: 0 };
    clipboard.writeText = text => { global.__fixture.clipboard = text; };
    dialog.showSaveDialog = async () => ({ canceled: global.__fixture.cancelExport, filePath: ${JSON.stringify(exportPath)} });
    global.fetch = async (url, options = {}) => {
      global.__fixture.requests.push({ url, method: options.method });
      const route = new URL(url).pathname;
      if (route === '/admin/fixture-late') return new Promise(resolve => { global.__fixture.finishLate = () => resolve({ ok: false, status: 401, text: async () => JSON.stringify({ error: 'Sessão antiga inválida' }) }); });
      const usuario = { id: 1, nome: 'Auditoria isolada', email: 'audit@example.test', papel_plataforma: global.__fixture.role };
      const data = route === '/auth/login' ? { token: 'fixture-only-no-real-session-' + (++global.__fixture.login) }
        : route === '/admin/equipe/me' ? { usuario }
        : route === '/admin/overview' ? { totais: { clubes: 0, usuarios: 0, jogadores: 0, partidas: 0, partidasAoVivo: 0 }, clubes: [], conexoes: { principal: 0, admin: 1 } }
        : route === '/admin/equipe/diagnostico' ? { banco: 'disponivel', latenciaMs: 1, consultadoEm: new Date().toISOString(), emailConfigurado: false, paulistaHabilitado: false }
        : {};
      return { ok: true, status: 200, text: async () => JSON.stringify(data) };
    };
    const socketModule = require(${JSON.stringify(path.join(desktop, 'node_modules/socket.io-client'))});
    const { EventEmitter } = require('node:events');
    socketModule.io = () => {
      const socket = new EventEmitter(); socket.disconnect = () => {};
      setImmediate(() => {
        socket.emit('connect');
        socket.emit('snapshot', [1, 2, 3].map(id => ({ id, ts: '2026-11-09T20:00:00Z', tipo: 'http', nivel: 'info', mensagem: 'GET /admin/overview → 200', ms: id })));
      });
      return socket;
    };
    require(${JSON.stringify(path.join(desktop, 'out/main/index.js'))});
  `);
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_RENDERER_URL; delete env.LUDORA_DESKTOP_DEV_API;
  let app;
  try {
    app = await _electron.launch({ executablePath: require(path.join(desktop, 'node_modules/electron')), args: [wrapper], env });
    const page = await app.firstWindow(); page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    async function login() {
      await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('audit@example.test');
      await page.getByLabel('Senha', { exact: true }).fill('fixture-only');
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    }
    await login();
    await page.getByRole('heading', { name: 'Visão global', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
    assert.equal(await page.evaluate(() => typeof window.process), 'undefined');
    const preferences = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
    assert.equal(preferences.contextIsolation, true); assert.equal(preferences.nodeIntegration, false);
    assert.equal(preferences.sandbox, true); assert.equal(preferences.webSecurity, true);
    const history = await page.evaluate(() => window.ludora.logs.historico());
    assert.equal(history.entradas.length, 3);
    const invalid = await page.evaluate(() => window.ludora.logs.copiar(['1']));
    assert.equal(invalid.ok, false);
    const copy = await page.evaluate(() => window.ludora.logs.copiar([2, 999]));
    assert.deepEqual(copy, { ok: true, total: 1 });
    const clipboard = await app.evaluate(() => global.__fixture.clipboard);
    assert.match(clipboard, /2 ms/); assert.doesNotMatch(clipboard, /fixture-only/);
    const exported = await page.evaluate(() => window.ludora.logs.exportar([1, 3]));
    assert.deepEqual(exported, { ok: true, total: 2 });
    assert.equal((await fs.readFile(exportPath, 'utf8')).split('\n').length, 2);
    await app.evaluate(() => { global.__fixture.cancelExport = true; });
    assert.equal((await page.evaluate(() => window.ludora.logs.exportar([1]))).cancelado, true);
    const forbidden = await page.evaluate(() => window.ludora.api.requisicao('GET', '/usuarios'));
    assert.equal(forbidden.status, 400);
    assert.equal((await page.evaluate(() => window.ludora.config.definirApiUrl('http://servidor-inseguro.example'))).ok, false);
    assert.equal((await page.evaluate(() => window.ludora.auth.restaurar())).ok, true, 'Configuração inválida preserva sessão');
    await page.evaluate(() => { window.__late = window.ludora.api.requisicao('GET', '/admin/fixture-late'); });
    await page.waitForTimeout(100);
    await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
    await app.evaluate(() => { global.__fixture.role = 'SUPORTE'; });
    await login();
    await page.getByRole('heading', { name: 'Visão global', exact: true }).waitFor();
    await app.evaluate(() => global.__fixture.finishLate());
    await page.evaluate(() => window.__late);
    assert.equal((await page.evaluate(() => window.ludora.auth.restaurar())).ok, true, '401 atrasado da sessão anterior não encerra a sessão nova');
    assert.equal((await page.evaluate(() => window.ludora.logs.copiar([1]))).ok, false, 'Suporte não pode exportar logs administrativos');
    assert.equal(await page.getByRole('navigation').getByRole('link', { name: 'Logs ao vivo', exact: true }).count(), 0);
    assert.equal(await page.evaluate(async () => JSON.stringify(await window.ludora.auth.restaurar()).includes('fixture-only')), false, 'Token não passa pelo preload');
    assert.deepEqual(errors, []);
    console.log('PASS Electron real: login, isolamento, preload, IPC, permissões, configuração, copiar e exportar logs (serviços simulados)');
  } finally { if (app) await app.close(); /* Perfil isolado preservado para diagnóstico; nenhuma remoção recursiva. */ }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
