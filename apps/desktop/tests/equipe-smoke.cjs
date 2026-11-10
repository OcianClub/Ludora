const { _electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

async function main() {
  const root = process.cwd();
  const out = path.join(root, 'test-results/equipe');
  await fs.mkdir(out, { recursive: true });
  const contas = JSON.parse(await fs.readFile(path.join(root, '.local-demo/equipe/contas.json'), 'utf8'));
  const profile = path.join(out, 'profile-' + Date.now());
  await fs.mkdir(profile, { recursive: true });
  await fs.writeFile(path.join(profile, 'config.json'), JSON.stringify({ apiUrl: 'http://127.0.0.1:3018' }));
  const wrapper = path.join(profile, 'launch.cjs');
  const entry = path.join(root, 'apps/desktop/out/main/index.js');
  await fs.writeFile(wrapper, `const { app } = require('electron'); app.setPath('userData', ${JSON.stringify(profile)}); require(${JSON.stringify(entry)});`);
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_RENDERER_URL;
  const app = await _electron.launch({ executablePath: require(path.join(root, 'apps/desktop/node_modules/electron')), args: [wrapper], env });
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(20000);
    for (const conta of contas) {
      await page.getByLabel('E-mail', { exact: true }).fill(conta.email);
      await page.getByLabel('Senha', { exact: true }).fill(conta.senha);
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      if (conta.papel === 'USUARIO') {
        await page.getByText('Esta conta não tem acesso ao painel interno Ludora.', { exact: true }).waitFor();
        continue;
      }
      await page.getByRole('link', { name: 'Visão global', exact: true }).click();
      await page.getByText(/Disponível · \d+ ms/).waitFor();
      if (conta.papel !== 'SUPERADMIN') {
        assert.equal(await page.getByRole('link', { name: 'Usuários', exact: true }).count(), 0);
        const result = await page.evaluate(() => window.ludora.api.requisicao('POST', '/admin/clubes', {}));
        assert.equal(result.status, 403);
        await page.evaluate(() => { location.hash = '#/usuarios'; });
        await page.waitForURL(/#\/visao$/);
      }
      for (const theme of ['light', 'dark']) {
        await page.getByRole('radio', { name: theme === 'light' ? 'Tema claro' : 'Tema escuro', exact: true }).click();
        await page.screenshot({ path: path.join(out, `${conta.papel}-${theme}.png`), fullPage: true });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      }
      await page.getByRole('button', { name: 'Atualizar diagnóstico', exact: true }).click();
      await page.getByText(/Disponível · \d+ ms/).waitFor();
      if (conta.papel === 'SUPORTE') {
        await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 700));
        await page.getByRole('button', { name: 'Atualizar diagnóstico', exact: true }).focus();
        await page.keyboard.press('Enter');
        await page.getByText(/Disponível · \d+ ms/).waitFor();
        await page.screenshot({ path: path.join(out, 'SUPORTE-900.png') });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        execFileSync('docker', ['stop', '-t', '2', 'ludora-equipe-tests'], { stdio: 'ignore' });
        try {
          await page.getByRole('button', { name: 'Atualizar diagnóstico', exact: true }).click();
          await page.getByRole('alert').waitFor();
          await page.screenshot({ path: path.join(out, 'SUPORTE-falha.png') });
        } finally { execFileSync('docker', ['start', 'ludora-equipe-tests'], { stdio: 'ignore' }); }
        for (let attempt = 0; attempt < 20; attempt++) {
          try { execFileSync('docker', ['exec', 'ludora-equipe-tests', 'pg_isready', '-U', 'postgres'], { stdio: 'ignore' }); break; }
          catch { await new Promise(resolve => setTimeout(resolve, 250)); }
        }
        for (let attempt = 0; attempt < 20; attempt++) {
          await page.getByRole('button', { name: 'Atualizar diagnóstico', exact: true }).click();
          await page.waitForFunction(() => [...document.querySelectorAll('button')]
            .some(button => button.textContent?.trim() === 'Atualizar diagnóstico' && !button.disabled));
          if (await page.getByText(/Disponível · \d+ ms/).count()) break;
          await new Promise(resolve => setTimeout(resolve, 350));
        }
        await page.getByText(/Disponível · \d+ ms/).waitFor();
        await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1360, 860));
      }
      await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
    }
    console.log('PASS Electron real: três papéis, dois temas, API e banco reais isolados, bloqueio de conta de clube e chamada IPC negada.');
  } finally { await app.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
