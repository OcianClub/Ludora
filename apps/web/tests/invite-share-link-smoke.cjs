const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await p.route('**/*', r => new URL(r.request().url()).origin === 'http://127.0.0.1:5189' ? r.continue() : r.abort());
    await require('./visual-fixture.cjs').install(p);
    await p.route('http://localhost:3000/convites/codigo/*', r => r.fulfill({ json: { convite: { id: 'open', email: '', possui_conta: true, papel: 'OLHEIRO', acesso_todas_categorias: false, expira_em: '2030-11-01', clube: { id: 2, nome: 'Ocian' }, categorias: [], convidado_por: 'Admin' } } }));
    await p.goto('http://127.0.0.1:5189/convite/ABCD-2345?entrar=1');
    await p.waitForURL('**/login');
    await p.getByText('Entre na sua conta para continuar com o código de convite.').waitFor();
    await p.getByLabel('E-mail', { exact: true }).fill('pessoa@example.test');
    await p.getByLabel('Senha', { exact: true }).fill('test1234');
    await p.getByRole('button', { name: 'Entrar', exact: true }).click();
    await p.waitForURL('**/convite/ABCD-2345');
    await p.getByRole('button', { name: 'Aceitar convite', exact: true }).waitFor();
    assert.ok(await p.getByText(/este código será utilizado/).isVisible());
    console.log('Link aberto preserva o convite durante o login');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
