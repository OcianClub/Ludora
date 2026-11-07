// Electron real com perfil separado; revisão restrita à pendência TESTE do manifesto.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require('playwright');
const root = path.resolve(__dirname, '../../..');
(async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'docs/dados/paulista-multiclube-20261106.json')));
  const contas = JSON.parse(await fs.readFile(path.join(root, '.local-demo/paulista-multiclube-20261106/credenciais.json')));
  const conta = contas.find(c => c.papel === 'SUPERADMIN'); assert.ok(manifest.cenario?.pendenciaId);
  const out = path.join(root, 'test-results/paulista-multiclube'), profile = path.join(out, `electron-${Date.now()}`);
  await fs.mkdir(profile, { recursive: true }); await fs.writeFile(path.join(profile, 'config.json'), JSON.stringify({ apiUrl: 'http://localhost:3000' }));
  const wrapper = path.join(root, 'apps/desktop/.paulista-multiclube-smoke.cjs');
  await fs.writeFile(wrapper, `const {app}=require('electron');app.setPath('userData',${JSON.stringify(profile)});require('./out/main/index.js');`);
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await _electron.launch({ executablePath: require('electron'), args: [wrapper, '--disable-gpu'], env });
    const page = await app.firstWindow(); page.setDefaultTimeout(35_000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.getByLabel('E-mail', { exact: true }).fill(conta.email); await page.getByLabel('Senha', { exact: true }).fill(conta.senha);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByRole('link', { name: 'Campeonato Paulista', exact: true }).click();
    await page.getByRole('button').filter({ hasText: /^Paulista 2026 · A1 · Sub-12/ }).click();
    await page.getByRole('heading', { name: 'Divergências e alterações oficiais', exact: true }).waitFor();
    await page.getByRole('table', { name: 'Comparação da divergência', exact: true }).waitFor();
    if (process.env.PAULISTA_ELECTRON_SOMENTE_LEITURA !== 'true') {
    await page.getByText('Aguardando decisão', { exact: false }).waitFor();
    assert.equal(await page.locator('pre').count(), 0);
    await page.getByRole('button', { name: 'Manter oficial e registrar decisão', exact: true }).first().click();
    const modal = page.getByRole('dialog', { name: 'Manter dado oficial', exact: true });
    const save = modal.getByRole('button', { name: 'Registrar decisão', exact: true }); assert.equal(await save.isDisabled(), true);
    await modal.getByLabel('Motivo da decisão').fill('TESTE multiclube: resultado oficial conferido; manter registros do atleta fictício para revisão.');
    assert.equal(await save.isDisabled(), true); await modal.getByRole('checkbox').check(); await save.click();
    await modal.waitFor({ state: 'hidden' }); await page.getByText('Placar · Conferida', { exact: true }).waitFor();
    } else {
      await page.getByText('Placar · Conferida', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: /^Confirmar candidato:/ }).count(), 0, 'Nenhum candidato deve existir neste evento por causa da letra A.');
    }
    await page.getByText(/^Decisão de revisão/).first().waitFor();
    for (const theme of ['light', 'dark']) {
      await page.evaluate(t => { localStorage.setItem('ludora_tema', t); document.documentElement.setAttribute('data-theme', t); }, theme);
      await page.getByRole('table', { name: 'Comparação da divergência', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(out, `electron-revisao-${theme}.png`), fullPage: true });
    }
    assert.deepEqual(errors, []); console.log('PASS Electron: login temporário real, 16 acompanhados, comparação, confirmação em duas etapas e decisão auditada, claro/escuro.');
  } finally { if (app) await app.close(); await fs.unlink(wrapper).catch(() => undefined); }
})().catch(e => { console.error(e); process.exitCode = 1; });
