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
  const abas = { '/clubes': 'Clubes', '/usuarios': 'Usuários', '/paulista': 'Campeonato Paulista', '/chamados': 'Chamados', '/manutencao': 'Manutenção', '/banco': 'Banco e integrações', '/logs': 'Logs ao vivo', '/ajustes': 'Ajustes' };
  const abasPermitidas = { SUPORTE: ['/chamados', '/manutencao', '/ajustes'], DESENVOLVEDOR: Object.keys(abas), SUPERADMIN: Object.keys(abas) };
  const acessoDev = process.argv.includes('--acesso-dev')
    ? JSON.parse(await fs.readFile(path.join(root, '.local-demo/equipe/acesso-dev.json'), 'utf8')) : null;
  const bancoTeste = path.join(root, 'scripts/test-database.cjs');
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
      const nav = page.getByRole('navigation', { name: 'Navegação principal' });
      for (const [rota, nome] of Object.entries(abas)) {
        const permitido = abasPermitidas[conta.papel].includes(rota);
        assert.equal(await nav.getByRole('link', { name: nome, exact: true }).count(), Number(permitido), `${conta.papel} ${rota}`);
        if (!permitido) {
          await page.evaluate(value => { location.hash = '#' + value; }, rota);
          await page.waitForURL(/#\/visao$/);
        }
      }
      if (conta.papel !== 'SUPERADMIN') {
        const result = await page.evaluate(() => window.ludora.api.requisicao('POST', '/admin/clubes', {}));
        assert.equal(result.status, 403);
      }
      if (conta.papel === 'DESENVOLVEDOR') {
        await page.getByRole('link', { name: /Relatórios automáticos/ }).click();
        await page.waitForURL(/#\/chamados\?origem=AUTOMATICO$/);
        await nav.getByRole('link', { name: 'Visão global', exact: true }).click();
        await page.waitForURL(/#\/visao$/);
        if (acessoDev) {
          await nav.getByRole('link', { name: 'Logs ao vivo', exact: true }).click();
          const consoleApi = page.getByRole('log', { name: 'Registros da API' });
          await consoleApi.waitFor();
          const antes = await page.evaluate(async () => (await window.ludora.logs.historico()).entradas.at(-1)?.id || 0);
          const resultado = await page.evaluate(id => window.ludora.api.requisicao('GET', `/admin/clubes/${id}/resumo?debug=private`), acessoDev.clubeId);
          assert.equal(resultado.status, 200);
          await page.waitForFunction(async id => (await window.ludora.logs.historico()).entradas.some(e => e.id > id && e.caminho === '/admin/clubes/:id/resumo'), antes);
          const entradas = await page.evaluate(async () => (await window.ludora.logs.historico()).entradas);
          assert.ok(entradas.every(e => e.tipo === 'http' && e.usuarioId === undefined && e.clubeId === undefined));
          await page.screenshot({ path: path.join(out, 'DEV-logs.png'), fullPage: true });

          await nav.getByRole('link', { name: 'Banco e integrações', exact: true }).click();
          await page.getByText('Banco conectado', { exact: true }).waitFor();
          await nav.getByRole('link', { name: 'Manutenção', exact: true }).click();
          await page.getByRole('region', { name: 'Pausas registradas', exact: true }).waitFor();
          assert.equal(await page.getByRole('button', { name: 'Nova pausa', exact: true }).count(), 0);

          await nav.getByRole('link', { name: 'Clubes', exact: true }).click();
          await page.getByRole('searchbox', { name: 'Buscar clube' }).fill(`Harbor Club ${acessoDev.contaId}`);
          assert.equal(await page.getByRole('button', { name: 'Novo clube', exact: true }).count(), 0);
          await page.getByRole('link', { name: new RegExp(`Harbor Club ${acessoDev.contaId}`) }).click();
          await page.getByRole('heading', { name: `Harbor Club ${acessoDev.contaId}`, exact: true }).waitFor();
          assert.equal(await page.getByRole('button', { name: 'Editar clube', exact: true }).count(), 0);
          await page.getByRole('tab', { name: 'Convites', exact: true }).click();
          await page.getByText('c***@equipe.example.test', { exact: true }).waitFor();
          assert.equal(await page.getByRole('button', { name: 'Ver código', exact: true }).count(), 0);

          await nav.getByRole('link', { name: 'Usuários', exact: true }).click();
          await page.getByRole('searchbox', { name: 'Buscar usuários' }).fill(acessoDev.nome);
          await page.getByRole('button', { name: `Gerenciar ${acessoDev.nome}`, exact: true }).click();
          const modal = page.getByRole('dialog', { name: 'Detalhes da conta', exact: true });
          assert.equal(await modal.getByRole('button', { name: 'Encerrar sessões', exact: true }).count(), 0);
          assert.equal(await modal.getByRole('button', { name: 'Vincular a um clube', exact: true }).count(), 0);
          await modal.getByLabel('Nome de exibição').fill(`${acessoDev.nome} Desktop`);
          await modal.getByRole('button', { name: 'Salvar nome', exact: true }).click();
          await modal.getByText(`${acessoDev.nome} Desktop`, { exact: true }).waitFor();
          await page.screenshot({ path: path.join(out, 'DEV-conta.png'), fullPage: true });
          await page.keyboard.press('Escape');

          await page.evaluate(id => { location.hash = `#/paulista?evento=${id}`; }, acessoDev.eventoId);
          await page.getByRole('button', { name: 'Consultar Federação agora', exact: true }).click();
          await page.getByRole('dialog', { name: 'Consultar Federação agora', exact: true }).getByRole('button', { name: 'Confirmar', exact: true }).click();
          await page.getByRole('dialog', { name: 'Consultar Federação agora', exact: true }).waitFor({ state: 'hidden' });
          assert.equal(await page.getByRole('switch', { name: 'Acompanhamento automático', exact: true }).count(), 0);
          await nav.getByRole('link', { name: 'Visão global', exact: true }).click();
          console.log('PASS Electron Dev: logs ao vivo, banco, pausas, clube e convites, correção de nome e sincronização Paulista simulada.');
        }
      }
      for (const theme of ['light', 'dark']) {
        await page.getByRole('radio', { name: theme === 'light' ? 'Tema claro' : 'Tema escuro', exact: true }).click();
        await page.screenshot({ path: path.join(out, `${conta.papel}-${theme}.png`), fullPage: true });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      }
      await page.getByRole('button', { name: conta.papel === 'SUPERADMIN' ? 'Atualizar' : 'Atualizar diagnóstico', exact: true }).click();
      await page.getByText(/Disponível · \d+ ms/).waitFor();
      if (conta.papel === 'SUPORTE') {
        await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 700));
        await page.getByRole('button', { name: 'Atualizar diagnóstico', exact: true }).focus();
        await page.keyboard.press('Enter');
        await page.getByText(/Disponível · \d+ ms/).waitFor();
        await page.screenshot({ path: path.join(out, 'SUPORTE-900.png') });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        execFileSync(process.execPath, [bancoTeste, 'stop'], { stdio: 'ignore' });
        try {
          await page.getByRole('button', { name: 'Atualizar diagnóstico', exact: true }).click();
          await page.getByRole('alert').waitFor();
          await page.screenshot({ path: path.join(out, 'SUPORTE-falha.png') });
        } finally { execFileSync(process.execPath, [bancoTeste, 'start'], { stdio: 'ignore' }); }
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
