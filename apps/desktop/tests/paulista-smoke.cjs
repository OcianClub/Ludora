// Electron real: perfil isolado, login pela API de teste, IPC de produção intacto.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require('playwright');
const root = path.resolve(__dirname, '../../..'), out = path.join(root, 'test-results/paulista');
(async () => {
  const profile = path.join(out, 'electron-profile-' + Date.now()); await fs.mkdir(profile, { recursive: true });
  await fs.writeFile(path.join(profile, 'config.json'), JSON.stringify({ apiUrl: 'http://127.0.0.1:3009' }));
  const wrapper = path.join(root, 'apps/desktop/.paulista-smoke-main.cjs');
  await fs.writeFile(wrapper, `const {app}=require('electron');app.setPath('userData',${JSON.stringify(profile)});require('./out/main/index.js');`);
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await _electron.launch({ executablePath: require('electron'), args: [wrapper, '--disable-gpu'], env });
    const page = await app.firstWindow(); page.setDefaultTimeout(20_000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.getByLabel('E-mail', { exact: true }).fill('pilot@example.test');
    await page.getByLabel('Senha', { exact: true }).fill('LocalPilotFixture123!');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByRole('link', { name: 'Campeonato Paulista', exact: true }).click();
    await page.getByRole('heading', { name: 'Campeonato Paulista', exact: true }).waitFor();
    await page.getByRole('button', { name: /^Acompanhados/ }).click();
    await page.getByRole('button').filter({ hasText: 'Paulista 2026 · A2 · Sub-7' }).click();
    await page.getByRole('heading', { name: 'Divergências e alterações oficiais', exact: true }).waitFor();
    await page.getByText('Oficial: 1 × 1 · Local: 9 × 1', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Manter oficial e registrar decisão', exact: true }).first().click();
    const modal = page.getByRole('dialog', { name: 'Manter dado oficial', exact: true });
    await modal.getByLabel('Motivo da decisão').fill('Conferido pelo teste Electron; dados locais preservados');
    await modal.getByRole('checkbox').check();
    await modal.getByRole('button', { name: 'Registrar decisão', exact: true }).click();
    await modal.waitFor({ state: 'hidden' });
    await page.getByText('PLACAR · CONFERIDA', { exact: true }).waitFor();
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => { localStorage.setItem('ludora_tema', theme); document.documentElement.setAttribute('data-theme', theme); }, theme);
      await page.screenshot({ path: path.join(out, `electron-paulista-${theme}.png`) });
    }
    await page.getByRole('link', { name: 'Clubes', exact: true }).click();
    await page.getByRole('button', { name: 'Novo clube', exact: true }).click();
    await page.getByLabel('Nome do clube', { exact: true }).fill('ADC MARVEL · TESTE');
    await page.getByRole('button', { name: /Continuar|Próximo/ }).click();
    await page.getByRole('heading', { name: 'Reaproveitar histórico de adversário', exact: true }).waitFor();
    await page.getByText(/jogos conhecidos/).first().waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS Electron: login real isolado, IPC, navegação, catálogo, revisão auditada, claro/escuro e candidatos no cadastro.');
  } finally { if (app) await app.close(); await fs.unlink(wrapper).catch(() => undefined); }
})().catch(e => { console.error(e); process.exitCode = 1; });
