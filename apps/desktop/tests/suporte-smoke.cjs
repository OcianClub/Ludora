const { chromium, _electron } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

async function main() {
  const root = process.cwd();
  const out = path.join(root, 'test-results/suporte');
  await fs.mkdir(out, { recursive: true });
  const contas = JSON.parse(await fs.readFile(path.join(root, '.local-demo/equipe/contas.json'), 'utf8'));
  const conta = contas.find(c => c.papel === 'USUARIO');
  const login = await fetch('http://127.0.0.1:3018/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(conta) });
  const session = await login.json(); assert.equal(login.status, 200);
  console.log('PASS login do cliente no banco isolado.');
  const emailConvite = `coach-${Date.now()}@equipe.example.test`;
  if (process.argv.includes('--email-isolado')) {
    const admin = await fetch('http://127.0.0.1:3018/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contas.find(c => c.papel === 'SUPERADMIN')) });
    assert.equal(admin.status, 200);
    const { token } = await admin.json();
    const convite = await fetch(`http://127.0.0.1:3018/admin/clubes/${session.clubes[0].clube_id}/convites`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: emailConvite, papel: 'TECNICO', acesso_todas_categorias: true, entrega: 'codigo' }),
    });
    assert.equal(convite.status, 201);
    console.log('PASS convite de teste preparado.');
  }
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const subject = 'Invitation delivery ' + Date.now();
  let id;
  let webPage;
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultTimeout(15000);
    webPage = page;
    await page.addInitScript(s => {
      localStorage.setItem('ludora_token', s.token);
      localStorage.setItem('ludora_usuario', JSON.stringify(s.usuario));
      const c = s.clubes[0];
      localStorage.setItem('ludora_clube_id', String(c.clube_id));
      localStorage.setItem('ludora_clube', JSON.stringify({ id: c.clube_id, nome: c.nome, meuPapel: c.papel }));
    }, session);
    await page.goto('http://localhost:5198/dashboard');
    console.log('Web aberto para envio do chamado.');
    await page.getByRole('button', { name: 'Suporte e ajuda', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Suporte e ajuda' });
    await modal.getByLabel('Assunto', { exact: true }).fill(subject);
    await modal.getByLabel('O que aconteceu?', { exact: true }).fill('The invitation did not arrive after the administrator sent it.');
    const sent = page.waitForResponse(r => r.url().endsWith('/suporte') && r.request().method() === 'POST');
    await modal.getByRole('button', { name: 'Enviar chamado', exact: true }).click();
    const response = await sent; assert.equal(response.status(), 201); id = (await response.json()).id;
    console.log('PASS chamado do cliente criado pelo Web.');
    await modal.getByText('Protocolo ' + id, { exact: true }).waitFor();
    for (const theme of ['light', 'dark']) {
      await page.evaluate(async value => (await import('/src/styles/theme.ts')).setThemePreference(value), theme);
      await page.screenshot({ path: path.join(out, `cliente-${theme}.png`), fullPage: true });
    }
    const occurrence = page.waitForResponse(r => r.url().endsWith('/suporte/ocorrencias'));
    await page.evaluate(() => { window.dispatchEvent(new ErrorEvent('error', { error: new Error('Synthetic isolated test') })); });
    assert.equal((await occurrence).status(), 201);
  } catch (error) {
    if (webPage) { await webPage.screenshot({ path: path.join(out, 'web-falha.png'), fullPage: true }); console.error((await webPage.locator('body').innerText()).slice(-1200)); }
    throw error;
  } finally { await browser.close(); }
  const profile = path.join(out, 'profile-' + Date.now());
  await fs.mkdir(profile); await fs.writeFile(path.join(profile, 'config.json'), JSON.stringify({ apiUrl: 'http://127.0.0.1:3018' }));
  const wrapper = path.join(profile, 'launch.cjs');
  await fs.writeFile(wrapper, `const {app}=require('electron');app.setPath('userData',${JSON.stringify(profile)});require(${JSON.stringify(path.join(root, 'apps/desktop/out/main/index.js'))});`);
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_RENDERER_URL;
  const app = await _electron.launch({ executablePath: require(path.join(root, 'apps/desktop/node_modules/electron')), args: [wrapper], env });
  const page = await app.firstWindow();
  try {
    page.setDefaultTimeout(15000);
    let reenvioVerificado = false;
    for (const etapa of ['ENCAMINHAR', 'DEVOLVER', 'FINALIZAR']) {
      const role = etapa === 'DEVOLVER' ? 'DESENVOLVEDOR' : 'SUPORTE';
      console.log(`Electron validando ${etapa} com ${role}.`);
      const account = contas.find(c => c.papel === role);
      await page.getByLabel('E-mail', { exact: true }).fill(account.email);
      await page.getByLabel('Senha', { exact: true }).fill(account.senha);
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.getByRole('link', { name: 'Chamados', exact: true }).click();
      if (role !== 'DESENVOLVEDOR') {
        await page.getByRole('searchbox', { name: 'Buscar chamados' }).fill(subject);
        const card = page.getByRole('button', { name: new RegExp(subject) });
        await card.waitFor();
        for (const theme of ['light', 'dark']) {
          await page.getByRole('radio', { name: theme === 'light' ? 'Tema claro' : 'Tema escuro', exact: true }).click();
          await page.getByRole('button', { name: 'Mais filtros', exact: true }).click();
          const dialog = page.getByRole('dialog', { name: 'Filtrar chamados' });
          const situation = dialog.getByRole('button', { name: /^Situação:/ });
          await situation.focus(); await situation.press('ArrowDown');
          await dialog.getByRole('menuitemradio', { name: 'Novo', exact: true }).waitFor();
          await page.screenshot({ path: path.join(out, `filtros-${theme}.png`) });
          await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
          await dialog.waitFor({ state: 'hidden' });
          await page.screenshot({ path: path.join(out, `fila-${theme}.png`) });
        }
        if (!reenvioVerificado) {
          await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 700));
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          await page.screenshot({ path: path.join(out, 'fila-900.png') });
          await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1360, 860));
        }
        await page.getByRole('button', { name: 'Mais filtros', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Filtrar chamados' });
        await dialog.getByRole('button', { name: /^Origem:/ }).click();
        await dialog.getByRole('menuitemradio', { name: 'Detectado pelo sistema', exact: true }).click();
        await dialog.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
        await page.getByRole('heading', { name: 'Nenhum chamado encontrado' }).waitFor();
        await page.getByRole('button', { name: 'Remover filtro Detectado pelo sistema' }).click();
        await card.click();
      } else {
        await page.getByRole('button', { name: new RegExp(subject) }).click();
      }
      await page.getByText('Protocolo ' + id, { exact: true }).waitFor();
      if (etapa === 'ENCAMINHAR' && process.argv.includes('--email-isolado')) {
        await page.getByText('Convite não recebido', { exact: true }).click();
        await page.getByLabel('E-mail usado no convite').fill(emailConvite);
        await page.getByRole('button', { name: 'Localizar convite', exact: true }).click();
        const select = page.getByRole('combobox', { name: /Convite do clube/ });
        await select.click();
        await page.getByRole('option', { name: /c\*\*\*@equipe.example.test.*pendente/ }).first().click();
        await page.getByRole('button', { name: 'Reenviar convite', exact: true }).click();
        await page.getByText('Resultado: aceito pelo provedor', { exact: true }).waitFor();
        await page.screenshot({ path: path.join(out, 'convite-reenviado.png') });
        reenvioVerificado = true;
      }
      if (etapa === 'DEVOLVER') {
        await page.getByRole('button', { name: 'Contexto e diagnóstico', exact: true }).click();
        await page.getByRole('heading', { name: 'Relatório técnico vinculado', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Devolver ao suporte', exact: true }).click();
        await page.getByLabel('O que foi corrigido ou precisa ser conferido?').fill('Correção conferida. Solicitar validação do cliente.');
        await page.getByRole('button', { name: 'Confirmar decisão', exact: true }).click();
        await page.getByRole('heading', { name: 'Caixa de desenvolvimento' }).waitFor();
      } else if (etapa === 'ENCAMINHAR') {
        await page.getByRole('button', { name: 'Encaminhar aos desenvolvedores', exact: true }).click();
        await page.getByLabel('Passos para reproduzir o problema').fill('Open invitations, submit and observe the delivery failure.');
        await page.getByRole('button', { name: 'Confirmar decisão', exact: true }).click();
        await page.getByText('Alteração registrada no histórico.', { exact: true }).waitFor();
      } else {
        await page.getByText('Correção conferida. Solicitar validação do cliente.', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Finalizar chamado', exact: true }).click();
        await page.getByLabel('Como o problema foi resolvido?').fill('Corrigimos o envio e conferimos a entrega.');
        await page.getByRole('button', { name: 'Confirmar decisão', exact: true }).click();
        await page.getByText('Corrigimos o envio e conferimos a entrega.', { exact: true }).waitFor();
      }
      for (const theme of ['light', 'dark']) {
        await page.getByRole('radio', { name: theme === 'light' ? 'Tema claro' : 'Tema escuro', exact: true }).click();
        await page.screenshot({ path: path.join(out, `${etapa}-${theme}.png`), fullPage: true });
      }
      await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
    }
    console.log('PASS Web abre chamado; Suporte encaminha; Desenvolvimento consulta e devolve; Suporte finaliza; dois temas.');
  } catch (error) {
    await page.screenshot({ path: path.join(out, 'desktop-falha.png'), fullPage: true });
    console.error((await page.locator('body').innerText()).slice(-1500));
    throw error;
  } finally { await app.close(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
