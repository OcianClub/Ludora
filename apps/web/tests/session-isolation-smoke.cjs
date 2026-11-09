const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { install } = require('./visual-fixture.cjs');

const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';
const user = { id: 1, nome: 'Alex Morgan', email: 'visual@example.test' };
const clubs = [{ id: 2, nome: 'Ocian', meuPapel: 'ADMIN' }, { id: 3, nome: 'Santos', meuPapel: null }];

async function seed(page) {
  await page.goto(base + '/login');
  await page.evaluate(({ user, club }) => {
    localStorage.setItem('ludora_token', 'old-test-session');
    localStorage.setItem('ludora_usuario', JSON.stringify(user));
    localStorage.setItem('ludora_clube', JSON.stringify(club));
    localStorage.setItem('ludora_clube_id', String(club.id));
  }, { user, club: clubs[0] });
}

async function writer(context) {
  const page = await context.newPage();
  await page.route(base + '/session-writer', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Session test writer</title>' }));
  await page.goto(base + '/session-writer');
  return page;
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  let passed = 0;
  try {
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const page = await context.newPage();
      await install(page);
      await seed(page);
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      await page.route('http://localhost:3000/usuarios/me', async route => {
        await gate;
        await route.fulfill({ json: { ...user, nome: 'Perfil confirmado', clubes: clubs } }).catch(() => {});
      });
      await page.goto(base + '/selecionar-clube');
      await page.getByRole('button', { name: 'Acessar Santos', exact: true }).click();
      await page.waitForURL('**/clubes/3');
      release();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('ludora_usuario')).nome === 'Perfil confirmado');
      const selected = await page.evaluate(() => ({ id: localStorage.getItem('ludora_clube_id'), club: JSON.parse(localStorage.getItem('ludora_clube')) }));
      assert.equal(selected.id, '3');
      assert.equal(selected.club.id, 3, 'perfil inicial lento não deve restaurar o clube anterior');
      assert.equal(selected.club.meuPapel, null);
      passed++;
      console.log('PASS clube selecionado preservado durante verificação inicial lenta');

      const other = await writer(context);
      await other.evaluate(() => {
        for (const key of ['ludora_token', 'ludora_usuario', 'ludora_clube', 'ludora_clube_id']) localStorage.removeItem(key);
      });
      await page.waitForFunction(() => !localStorage.getItem('ludora_usuario'));
      await page.getByRole('button', { name: 'Menu da conta', exact: true }).click();
      await page.getByRole('link', { name: 'Entrar na conta', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem('ludora_usuario')), null);
      passed++;
      console.log('PASS logout em outra aba encerra acesso e remove dados salvos');
      await context.close();
    }
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await install(page);
      await page.route('http://localhost:3000/notificacoes/preferencias', route => route.fulfill({ json: { preferencias: [] } }));
      await seed(page);
      let release;
      let oldRequests = 0;
      const gate = new Promise(resolve => { release = resolve; });
      const newUser = { id: 22, nome: 'Nova conta', email: 'nova@example.test' };
      await page.route('http://localhost:3000/usuarios/me', async route => {
        const old = route.request().headers().authorization === 'Bearer old-test-session';
        if (old) { oldRequests++; await gate; }
        await route.fulfill({ json: { ...(old ? user : newUser), clubes: clubs, notificacoes_ativas: true } }).catch(() => {});
      });
      await page.goto(base + '/perfil');
      await page.waitForFunction(() => document.querySelector('.perfil-page'));
      assert.ok(oldRequests > 0);
      const other = await writer(context);
      await other.evaluate(({ user, club }) => {
        localStorage.setItem('ludora_usuario', JSON.stringify(user));
        localStorage.setItem('ludora_clube', JSON.stringify(club));
        localStorage.setItem('ludora_clube_id', String(club.id));
        localStorage.setItem('ludora_token', 'new-test-session');
      }, { user: newUser, club: clubs[1] });
      await page.getByLabel('Nome', { exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelector('input[autocomplete="name"]')?.value === 'Nova conta');
      release();
      await page.waitForTimeout(150);
      assert.equal(await page.getByLabel('Nome', { exact: true }).inputValue(), newUser.nome);
      assert.equal(await page.getByLabel('E-mail', { exact: true }).inputValue(), newUser.email);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ludora_usuario')).id), newUser.id);
      passed++;
      console.log('PASS troca de conta entre abas remonta formulário e descarta perfil antigo');
      await context.close();
    }
    console.log(`${passed} cenários de isolamento de sessão passaram.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
