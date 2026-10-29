const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const base = process.env.LUDORA_WEB_TEST_URL || 'http://127.0.0.1:5187';
const output = path.resolve(__dirname, '../../../test-results/web-access');
const user = { id: 7, nome: 'Pessoa de teste', email: 'pessoa@example.test' };
const club = { id: 2, nome: 'Clube de demonstração', meuPapel: 'TECNICO', cidade: 'São Paulo', estado: 'SP' };
const invite = {
  id: 'test-invite', email: 'pe***@example.test', possui_conta: false, papel: 'TECNICO',
  acesso_todas_categorias: false, expira_em: '2027-12-30T23:59:00Z', clube: club,
  convidado_por: 'Administrador', categorias: [{ id: 9, nome: 'sub-7' }],
};

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  let passed = 0;
  const errors = [];

  async function setup(width = 390, height = 844) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const calls = [];
    const state = { existing: false, expired: false, loginError: false, offline: false, codeError: false, profileUnauthorized: false, delay: 0 };
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (['fetch', 'xhr'].includes(request.resourceType()) && !url.pathname.startsWith('/@')) {
        calls.push({ method: request.method(), path: url.pathname, body: request.postDataJSON(), headers: request.headers() });
        if (state.offline) return route.abort('failed');
        const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
        if (url.pathname === '/auth/login') return state.loginError ? json({ error: 'E-mail ou senha inválidos' }, 401) : json({ ...user, token: 'mock-session', clubes: [club] });
        if (url.pathname === '/auth/cadastro/solicitar-codigo') return json({ cadastro_id: 'a'.repeat(64) }, 202);
        if (url.pathname === '/auth/registrar') return state.codeError ? json({ error: 'Código inválido, expirado ou já utilizado.' }, 400) : json({ mensagem: 'Conta criada', id: user.id }, 201);
        if (url.pathname === '/auth/recuperar-senha') return json({ mensagem: 'Se existir uma conta, enviaremos um código.' }, 202);
        if (url.pathname === '/auth/redefinir-senha') return state.codeError ? json({ error: 'Código inválido, expirado ou já utilizado.' }, 400) : json({ mensagem: 'Senha alterada' });
        if (url.pathname.startsWith('/convites/')) {
          if (request.method() === 'GET') return state.expired ? json({ error: 'Este convite expirou' }, 410) : json({ convite: { ...invite, possui_conta: state.existing } });
          return json({ token: 'mock-session', usuario: user, clube: { ...club, papel: 'TECNICO', categorias: invite.categorias, acesso_todas_categorias: false } });
        }
        if (url.pathname === '/usuarios/me') return state.profileUnauthorized ? json({ error: 'Token inválido' }, 401) : json({ ...user, clubes: [club] });
        if (url.pathname === '/notificacoes') return json({ notificacoes: [], totalNaoLidas: 0 });
        return json([]);
      }
      if (url.origin !== new URL(base).origin) return route.abort();
      return route.continue();
    });
    return { context, page, calls, state };
  }

  async function scenario(name, run) {
    const fixture = await setup();
    try { await run(fixture); passed++; console.log(`PASS ${name}`); }
    finally { await fixture.context.close(); }
  }

  try {
    await scenario('login valida campos, mostra senha e preserva erros de credenciais', async ({ page, state }) => {
      await page.goto(base + '/login');
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      assert.equal(await page.getByLabel('E-mail', { exact: true }).getAttribute('aria-invalid'), 'true');
      await page.getByLabel('E-mail', { exact: true }).fill(user.email);
      await page.getByLabel('Senha', { exact: true }).fill('segredo123');
      await page.getByRole('button', { name: 'Mostrar senha', exact: true }).click();
      assert.equal(await page.getByLabel('Senha', { exact: true }).getAttribute('type'), 'text');
      state.loginError = true;
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'E-mail ou senha inválidos' }).waitFor();
      state.loginError = false;
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.waitForURL('**/selecionar-clube');
    });

    await scenario('cadastro completo em três etapas, validações e um único envio', async ({ page, calls, state }) => {
      await page.goto(base + '/registrar');
      await page.getByLabel('Nome completo', { exact: true }).fill(user.nome);
      await page.getByLabel('E-mail', { exact: true }).fill(' PESSOA@example.test ');
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      await page.getByLabel('Crie uma senha', { exact: true }).fill('segredo123');
      await page.getByLabel('Confirme sua senha', { exact: true }).fill('diferente');
      await page.getByRole('button', { name: 'Enviar código de confirmação' }).click();
      await page.getByText('Repita a mesma senha para confirmar.').waitFor();
      await page.getByLabel('Confirme sua senha', { exact: true }).fill('segredo123');
      await page.getByRole('button', { name: 'Enviar código de confirmação' }).click();
      await page.getByRole('heading', { name: 'Confirme seu e-mail' }).waitFor();
      assert.equal(await page.getByRole('button', { name: /Reenviar código em/ }).isDisabled(), true);
      await page.getByLabel('Código de confirmação').fill('ABCD-2345');
      state.delay = 200;
      await page.getByRole('button', { name: 'Confirmar e criar conta' }).click();
      await page.waitForURL('**/login');
      const requests = calls.filter(call => call.path === '/auth/registrar');
      assert.equal(requests.length, 1);
      assert.equal(requests[0].body.codigo, 'ABCD2345');
      assert.equal(requests[0].body.cadastro_id, 'a'.repeat(64));
      assert.equal(requests[0].body.email, user.email);
      await page.getByRole('status').filter({ hasText: 'Conta criada' }).waitFor();
    });

    await scenario('editar e-mail invalida desafio anterior e solicita código para o endereço novo', async ({ page, calls }) => {
      await page.goto(base + '/registrar');
      await page.getByLabel('Nome completo').fill(user.nome);
      await page.getByLabel('E-mail', { exact: true }).fill(user.email);
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      await page.getByLabel('Crie uma senha', { exact: true }).fill('segredo123');
      await page.getByLabel('Confirme sua senha', { exact: true }).fill('segredo123');
      await page.getByRole('button', { name: 'Enviar código de confirmação' }).click();
      await page.getByRole('heading', { name: 'Confirme seu e-mail' }).waitFor();
      await page.getByRole('button', { name: 'Editar e-mail' }).click();
      await page.getByLabel('E-mail', { exact: true }).fill('outro@example.test');
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      await page.getByRole('button', { name: 'Enviar código de confirmação' }).click();
      await page.getByRole('heading', { name: 'Confirme seu e-mail' }).waitFor();
      assert.equal(calls.filter(call => call.path === '/auth/cadastro/solicitar-codigo').at(-1).body.email, 'outro@example.test');
    });

    await scenario('recuperação com código inválido e depois sucesso', async ({ page, state, calls }) => {
      await page.goto(base + '/login');
      await page.getByRole('link', { name: 'Esqueceu sua senha?' }).click();
      await page.getByLabel('E-mail', { exact: true }).fill(user.email);
      await page.getByRole('button', { name: 'Enviar código de recuperação' }).click();
      await page.getByLabel('Código de recuperação').fill('ABCD-2345');
      await page.getByLabel('Nova senha', { exact: true }).fill('segredo123');
      await page.getByLabel('Confirme a nova senha', { exact: true }).fill('segredo123');
      state.codeError = true;
      await page.getByRole('button', { name: 'Salvar nova senha' }).click();
      await page.getByRole('alert').filter({ hasText: 'Código inválido' }).waitFor();
      state.codeError = false;
      await page.getByRole('button', { name: 'Salvar nova senha' }).click();
      await page.waitForURL('**/login');
      assert.equal(calls.filter(call => call.path === '/auth/redefinir-senha').at(-1).body.codigo, 'ABCD2345');
      await page.getByRole('status').filter({ hasText: 'Senha alterada' }).waitFor();
    });

    await scenario('convite para nova conta mostra clube e aceita sem expor e-mail completo', async ({ page, calls }) => {
      await page.goto(base + '/login');
      await page.getByRole('link', { name: /Tem um código de convite/ }).click();
      await page.getByLabel('Código do convite').fill('ABCD-2345');
      await page.getByRole('button', { name: 'Consultar convite' }).click();
      await page.getByRole('heading', { name: club.nome }).waitFor();
      await page.getByLabel('Nome completo').fill(user.nome);
      await page.getByLabel('Crie uma senha', { exact: true }).fill('segredo123');
      await page.getByLabel('Confirme sua senha', { exact: true }).fill('segredo123');
      await page.getByRole('button', { name: 'Criar conta e aceitar convite' }).click();
      await page.getByRole('heading', { name: 'Você faz parte do time' }).waitFor();
      assert.ok(calls.some(call => call.path === '/convites/codigo/ABCD2345/aceitar'));
      assert.equal(await page.evaluate(() => localStorage.getItem('ludora_clube_id')), '2');
    });

    await scenario('convite existente continua após login e envia bearer', async ({ page, state, calls }) => {
      state.existing = true;
      await page.goto(base + '/convite/ABCD-2345');
      await page.getByRole('button', { name: 'Entrar para aceitar' }).click();
      await page.getByLabel('E-mail', { exact: true }).fill(user.email);
      await page.getByLabel('Senha', { exact: true }).fill('segredo123');
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.getByRole('button', { name: 'Aceitar convite', exact: true }).click();
      await page.getByRole('heading', { name: 'Você faz parte do time' }).waitFor();
      assert.equal(calls.find(call => call.path.endsWith('/aceitar-existente')).headers.authorization, 'Bearer mock-session');
    });

    await scenario('convite expirado e falha de conexão mostram recuperação', async ({ page, state }) => {
      state.expired = true;
      await page.goto(base + '/convite/ABCD-2345');
      await page.getByRole('alert').filter({ hasText: 'Este convite expirou' }).waitFor();
      state.expired = false;
      await page.getByRole('button', { name: 'Tentar novamente' }).click();
      await page.getByRole('heading', { name: club.nome }).waitFor();
      await page.goto(base + '/login');
      await page.getByLabel('E-mail', { exact: true }).fill(user.email);
      await page.getByLabel('Senha', { exact: true }).fill('segredo123');
      state.offline = true;
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Verifique sua internet' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Entrar', exact: true }).isEnabled(), true);
    });

    await scenario('sessão salva restaura clube sem redirecionar ao atualizar página', async ({ page, context }) => {
      await context.addInitScript(({ user, club }) => {
        localStorage.setItem('ludora_token', 'mock-session');
        localStorage.setItem('ludora_usuario', JSON.stringify(user));
        localStorage.setItem('ludora_clube', JSON.stringify(club));
        localStorage.setItem('ludora_clube_id', String(club.id));
      }, { user, club });
      await page.goto(base + '/dashboard');
      await page.locator('.current-club:visible strong').filter({ hasText: club.nome }).first().waitFor();
      assert.equal(new URL(page.url()).pathname, '/dashboard');
      await page.reload();
      await page.locator('.current-club:visible strong').filter({ hasText: club.nome }).first().waitFor();
      assert.equal(new URL(page.url()).pathname, '/dashboard');
    });

    await scenario('sessão expirada e JSON corrompido não interrompem o acesso ao convite', async ({ page, context, state }) => {
      state.existing = true;
      state.profileUnauthorized = true;
      await context.addInitScript(() => {
        localStorage.setItem('ludora_token', 'expired-session');
        localStorage.setItem('ludora_usuario', '{invalid');
        localStorage.setItem('ludora_clube', '{invalid');
      });
      await page.goto(base + '/convite/ABCD-2345');
      await page.getByRole('button', { name: 'Entrar para aceitar' }).waitFor();
      assert.equal(new URL(page.url()).pathname, '/convite/ABCD-2345');
    });

    await scenario('link longo consulta o convite sem transformar o token em código curto', async ({ page, calls }) => {
      await page.goto(base + '/convite/token/' + 'a'.repeat(43));
      await page.getByRole('heading', { name: club.nome }).waitFor();
      assert.ok(calls.some(call => call.path === '/convites/' + 'a'.repeat(43)));
    });

    for (const width of [320, 360, 390, 768, 1024, 1366, 1920]) {
      const { context, page } = await setup(width, width < 500 ? 740 : 900);
      try {
        for (const theme of ['Claro', 'Escuro']) {
          for (const route of ['/login', '/registrar', '/recuperar-senha', '/convite', '/convite/ABCD-2345']) {
            await page.goto(base + route);
            await page.getByRole('radio', { name: theme === 'Escuro' ? 'Tema escuro' : 'Tema claro' }).click();
            assert.equal(await page.locator('.auth-page .brand:visible').count(), 1);
            if (route.includes('ABCD')) await page.getByRole('heading', { name: club.nome }).waitFor();
            await page.waitForFunction(expected => {
              const input = document.querySelector('.access-input-row');
              return input && getComputedStyle(input).backgroundColor === expected;
            }, theme === 'Claro' ? 'rgb(253, 252, 248)' : 'rgb(20, 23, 31)');
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow ${width} ${theme} ${route}`);
            const fields = await page.locator('.access-input-row').all();
            for (const field of fields) {
              const rect = await field.boundingBox();
              assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1, `Campo cortado ${width} ${route}`);
            }
            if (route === '/login') await page.screenshot({ path: path.join(output, `login-${width}-${theme}.png`), fullPage: true, animations: 'disabled' });
          }
        }
        await page.goto(base + '/login');
        await page.evaluate(() => localStorage.removeItem('ludora_tema'));
        await page.reload();
        await page.emulateMedia({ colorScheme: 'light' });
        await page.waitForFunction(() => document.documentElement.style.colorScheme === 'light');
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.waitForFunction(() => document.documentElement.style.colorScheme === 'dark');
        passed++;
        console.log(`PASS responsividade ${width}px, interruptor claro/escuro, tema inicial do sistema e cinco rotas`);
      } finally { await context.close(); }
    }
    assert.deepEqual(errors, []);
    console.log(`PASS ${passed} cenários de acesso/responsividade; nenhuma chamada à API real.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
