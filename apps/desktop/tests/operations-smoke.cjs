// Auditoria do renderer compilado, sem chamadas à API nem alterações no banco.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../out/renderer');
const output = path.resolve(__dirname, '../../../test-results/desktop-operations');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' };

function fixture({ theme }) {
  localStorage.setItem('ludora_tema', theme);
  window.__calls = []; window.__writes = []; window.__failWrite = false; window.__logListeners = new Set();
  window.__logExports = []; window.__configWrites = 0;
  window.__failDb = false; window.__dbDelay = 0;
  const noop = () => () => {};
  const admin = { id: 1, nome: 'Admin de teste', email: 'admin@example.test', papel_plataforma: 'SUPERADMIN' };
  const clubes = ['Ocian', 'Santos', 'Associação com nome longo para testar a distribuição dos elementos'].map((nome, i) => ({ id: i + 1, nome, escudo: null, cidade: 'Praia Grande', estado: 'SP', ativo: i !== 2, plano: 'DEMO', membros: 3, jogadores: 120, categorias: 8, partidas: 100, competicoes: 2, endereco: null, cnpj: null }));
  const overview = { clubes, totais: { clubes: 3, usuarios: 20, jogadores: 360, partidas: 300, partidasAoVivo: 2 }, conexoes: { principal: 2, admin: 1 } };
  const contas = [{ ...admin, clubes: [], suspenso: false }, { id: 2, nome: 'Alex de teste', email: 'alex@example.test', papel_plataforma: 'USUARIO', suspenso: false, clubes: [{ clube_id: 1, nome: 'Ocian', papel: 'TECNICO' }] }];
  contas.push({ id: 3, nome: 'Conta de nome muito extenso para testar truncamento', email: 'nome.extenso@example.test', papel_plataforma: 'USUARIO', suspenso: true, clubes: [{ clube_id: 1, nome: 'Ocian', papel: 'TECNICO' }, { clube_id: 2, nome: 'Santos', papel: 'MESARIO' }] });
  let pausas = [];
  let chamados = [{ id: 'ch-1', assunto: 'Problema visual na partida', descricao: 'Descrição detalhada para testar o atendimento.', criadoEm: '2026-11-09T20:00:00Z', revisao: 1, regra: 'MANUAL', fila: 'SUPORTE', status: 'NOVO', origem: 'CLIENTE', tipo: 'ERRO', prioridade: 'NORMAL', ocorrencias: 1, clube: { nome: 'Ocian' }, clubeId: 1, restrito: false, rota: '/partidas', servico: 'web', versao: '0.0.1', historico: [] }];
  const operacoes = [{ value: 'CRIAR_PARTIDA', label: 'Criação de partidas', escopos: ['GLOBAL', 'CLUBE'] }];
  const entry = id => ({ id, ts: '2026-11-09T20:00:00Z', tipo: 'http', nivel: 'info', mensagem: `GET /admin/clubes/${id} → 200`, ms: 10 });
  window.__emitLogs = (inicio, count) => { for (let i = inicio; i < inicio + count; i++) window.__logListeners.forEach(fn => fn(entry(i))); };
  window.ludora = {
    auth: { restaurar: async () => ({ ok: true, usuario: admin, persistente: true }), aoExpirar: callback => { window.__expire = callback; return () => {}; }, sair: async () => {}, entrar: async () => ({ ok: true, usuario: admin, persistente: true }) },
    config: { obter: async () => ({ apiUrl: 'http://localhost:3000', apiUrlPadrao: 'http://localhost:3000', versao: '0.0.1', plataforma: 'win32', armazenamentoSeguro: true }), definirApiUrl: async () => { window.__configWrites++; return { ok: false, erro: 'URL inválida' }; } },
    logs: { historico: async () => ({ estado: 'conectado', entradas: [entry(1), entry(2)] }), aoMudarEstado: noop,
      aoReceber: fn => { window.__logListeners.add(fn); return () => window.__logListeners.delete(fn); },
      copiar: async ids => { window.__logExports.push(ids); return { ok: true, total: ids.length }; },
      exportar: async ids => { window.__logExports.push(ids); return { ok: true, total: ids.length }; } },
    api: { requisicao: async (method, route, body) => {
      window.__calls.push({ method, route });
      const url = new URL(route, 'http://fixture'); const p = url.pathname;
      await new Promise(resolve => setTimeout(resolve, 80));
      if (p === '/admin/db/status') {
        await new Promise(resolve => setTimeout(resolve, window.__dbDelay));
        if (window.__failDb) return { ok: false, status: 503, data: { error: 'Banco indisponível no teste' } };
      }
      if (method !== 'GET') {
        window.__writes.push({ method, route, body });
        if (window.__failWrite) return { ok: false, status: 503, data: { error: 'Falha simulada. Dados preservados.' } };
        if (p === '/admin/equipe/chamados') { chamados = [{ ...chamados[0], id: 'ch-2', assunto: body.assunto, descricao: body.descricao }, ...chamados]; return { ok: true, status: 200, data: { id: 'ch-2' } }; }
        if (p === '/admin/equipe/manutencao') pausas.push({ id: 'pausa-1', ...body, ativa: true, inicio: new Date().toISOString(), revisao: 1, historico: [] });
        return { ok: true, status: 200, data: {} };
      }
      let data;
      if (p === '/admin/overview') data = overview;
      else if (/^\/admin\/clubes\/\d+\/membros$/.test(p)) data = { categorias: [{ id: 7, nome: 'sub-7', tipo: 'INICIACAO', ativa: true, faixaIdade: 7 }], membros: [{ usuario: contas[1], papel: 'TECNICO', acesso_todas_categorias: true, categorias: [] }] };
      else if (p === '/admin/usuarios') data = contas.filter(u => `${u.nome} ${u.email}`.toLowerCase().includes((url.searchParams.get('busca') || '').toLowerCase()));
      else if (p === '/admin/equipe/chamados/filtros') data = { clubes: clubes.map(c => ({ value: c.id, label: c.nome })), responsaveis: [], contagens: { '': chamados.length, NOVO: chamados.length, ATRASADO: 0, RECORRENTE: 0, MEUS: 0 } };
      else if (p === '/admin/equipe/chamados/clubes') data = clubes.map(c => ({ value: c.id, label: c.nome }));
      else if (p === '/admin/equipe/chamados') data = chamados;
      else if (p.startsWith('/admin/equipe/chamados/')) data = chamados.find(c => c.id === p.split('/').at(-1));
      else if (p === '/admin/equipe/manutencao') data = { pausas, clubes, eventos: [], operacoes, chamado: null };
      else if (p === '/admin/equipe/diagnostico') data = { banco: 'disponivel', latenciaMs: 90, consultadoEm: '2026-11-09T20:00:00Z', emailConfigurado: true, paulistaHabilitado: true };
      else if (p === '/admin/paulista') data = { rotina: { descobertaEm: '2026-11-09T20:00:00Z', proximaEm: null, erro: null }, catalogo: [], clubes, fila: [], recentes: [] };
      else if (p === '/admin/db/status') data = { conectado: true, latenciaMs: 90, versaoPostgres: 'PostgreSQL 17.6', migracoes: { aplicadas: 25, locais: 25, pendentes: [], falhas: [] }, tabelas: { clubes: 3, jogadores: 360, partidas: 300 } };
      else if (p === '/admin/sistema') data = { ambiente: 'development', node: 'v22', uptimeSegundos: 3600, memoriaMB: 120, superAdmins: 2, conexoes: { principal: 2 }, integracoes: { scoutIA: { configurado: true, acessivel: true, ms: 3 }, email: { configurado: true }, supabaseStorage: { configurado: false } } };
      else throw new Error(`Fixture ausente: ${route}`);
      return { ok: true, status: 200, data };
    } },
  };
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + new URL(req.url, 'http://fixture').pathname.replace(/\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, data) => { res.writeHead(error ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(error ? 'Not found' : data); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const scenario of [{ width: 1440, height: 900, theme: 'dark' }, { width: 900, height: 700, theme: 'light' }, { width: 640, height: 480, theme: 'dark' }]) {
      const context = await browser.newContext({ viewport: scenario });
      const page = await context.newPage(); page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(fixture, scenario);
      const base = `http://127.0.0.1:${server.address().port}/#/`;
      for (const [route, title] of [['visao', 'Visão global'], ['clubes', 'Clubes'], ['usuarios', 'Usuários'], ['visao', 'Visão global'], ['chamados', 'Chamados'], ['manutencao', 'Manutenção'], ['paulista', 'Campeonato Paulista'], ['banco', 'Banco e integrações'], ['logs', 'Logs ao vivo'], ['ajustes', 'Ajustes']]) {
        await page.goto(base + route);
        await page.getByRole('heading', { level: 1, name: title, exact: true }).waitFor();
        await page.waitForTimeout(350);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${route}: sem overflow horizontal`);
        assert.equal(await page.locator('.admin-content').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, `${route}: conteúdo cabe na janela`);
        if (route === 'banco') {
          const sections = await page.locator('.desktop-bank-page .desktop-section-heading h2').allTextContents();
          assert.deepEqual(sections, ['Banco de dados', 'Integrações', 'Servidor', 'Registros por tabela']);
          assert.equal(await page.getByText('Upload não verificado nesta consulta.', { exact: true }).count(), 0, 'Armazenamento não configurado não é tratado como verificado');
          await page.getByText('Envio não verificado nesta consulta.', { exact: true }).waitFor();
          await page.getByText('Banco conectado', { exact: true }).waitFor();
          await page.evaluate(() => { window.__dbDelay = 500; window.__failDb = true; });
          await page.getByRole('button', { name: 'Verificar agora', exact: true }).click();
          assert.equal(await page.getByRole('button', { name: 'Verificando…', exact: true }).isDisabled(), true);
          assert.equal(await page.getByText('Banco conectado', { exact: true }).count(), 1, 'A atualização mantém o diagnóstico anterior visível');
          await page.getByRole('heading', { name: 'Não foi possível consultar todos os serviços', exact: true }).waitFor();
          assert.equal(await page.getByText('Banco conectado', { exact: true }).count(), 1, 'Uma falha parcial preserva os dados anteriores com aviso');
          await page.evaluate(() => { window.__dbDelay = 0; window.__failDb = false; });
          await page.getByRole('button', { name: 'Verificar agora', exact: true }).click();
          await page.getByRole('heading', { name: 'Não foi possível consultar todos os serviços', exact: true }).waitFor({ state: 'detached' });
          await page.getByRole('button', { name: 'Verificar agora', exact: true }).waitFor();
        }
        await page.screenshot({ path: path.join(output, `${route}-${scenario.width}-${scenario.theme}.png`), fullPage: true });
      }
      await page.goto(base + 'clubes');
      await page.getByRole('searchbox', { name: 'Buscar clube', exact: true }).fill('Ocian');
      await page.locator('.club-directory-card').first().click();
      await page.getByRole('heading', { level: 1, name: 'Ocian', exact: true }).waitFor();
      await page.getByRole('link', { name: '← Clubes', exact: true }).click();
      assert.equal(await page.getByRole('searchbox', { name: 'Buscar clube', exact: true }).inputValue(), 'Ocian');

      await page.goto(base + 'usuarios');
      await page.getByRole('button', { name: /Alex de teste/ }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Contas por clubes', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Blocos', exact: true }).count(), 0);
      const heights = await page.locator('.desktop-user-line').evaluateAll(rows => rows.map(row => row.getBoundingClientRect().height));
      assert.ok(heights.every(height => height === heights[0]), 'Linhas de usuários têm a mesma altura');
      const heading = page.getByRole('columnheader').filter({ has: page.getByRole('button', { name: 'Ordenar por Conta', exact: true }) }).first();
      for (const order of ['ascending', 'descending', 'none']) {
        await heading.getByRole('button').click();
        assert.equal(await heading.getAttribute('aria-sort'), order);
      }
      await page.getByRole('button', { name: 'Mais filtros', exact: true }).click();
      let filterDialog = page.getByRole('dialog', { name: 'Filtrar usuários', exact: true });
      await filterDialog.getByRole('combobox', { name: /Clube/ }).click();
      await filterDialog.getByRole('option', { name: 'Ocian', exact: true }).click();
      await filterDialog.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
      await page.waitForFunction(() => window.__calls.some(c => c.route.includes('/admin/usuarios?') && c.route.includes('clube=1')));
      await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
      await page.getByRole('button', { name: /Alex de teste/ }).click();
      let dialog = page.getByRole('dialog', { name: 'Gerenciar conta', exact: true });
      await dialog.waitFor();
      assert.equal(await page.getByRole('dialog').count(), 1);
      await page.screenshot({ path: path.join(output, `conta-${scenario.width}.png`) });
      await dialog.getByRole('switch', { name: 'Situação da conta', exact: true }).click();
      await dialog.getByRole('button', { name: 'Revisar acesso', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Suspender conta', exact: true });
      await dialog.waitFor();
      assert.equal(await dialog.getByRole('button', { name: 'Confirmar alteração', exact: true }).isDisabled(), true);
      await dialog.getByRole('checkbox').check();
      await page.evaluate(() => { window.__failWrite = true; });
      await dialog.getByRole('button', { name: 'Confirmar alteração', exact: true }).click();
      await dialog.getByRole('alert').waitFor();
      assert.equal(await dialog.getByRole('checkbox').isChecked(), true, 'Falha preserva a confirmação');
      await dialog.getByRole('button', { name: 'Voltar', exact: true }).click();
      await page.getByRole('dialog', { name: 'Gerenciar conta', exact: true }).getByRole('button', { name: 'Fechar', exact: true }).click();

      await page.goto(base + 'chamados');
      await page.getByRole('button', { name: 'Novo chamado', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Novo chamado manual', exact: true });
      await dialog.getByRole('textbox', { name: 'Assunto (obrigatório)', exact: true }).fill('Falha no teste visual');
      await dialog.getByRole('textbox', { name: 'Descrição', exact: true }).fill('Descrição suficientemente longa para o chamado.');
      await dialog.getByRole('combobox', { name: /Tela \(obrigatória\)/ }).click();
      await dialog.getByRole('option', { name: 'Partidas', exact: true }).click();
      await dialog.getByRole('button', { name: 'Criar chamado', exact: true }).click();
      await dialog.getByRole('alert').waitFor();
      assert.equal(await dialog.getByRole('textbox', { name: 'Assunto (obrigatório)', exact: true }).inputValue(), 'Falha no teste visual');
      await page.evaluate(() => { window.__failWrite = false; });
      await dialog.getByRole('button', { name: 'Criar chamado', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      await page.getByRole('heading', { level: 1, name: 'Falha no teste visual', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Voltar à fila', exact: true }).click();
      const filterCalls = await page.evaluate(() => window.__calls.filter(c => c.route === '/admin/equipe/chamados/filtros').length);
      await page.getByRole('searchbox', { name: 'Buscar chamados', exact: true }).fill('placar');
      await page.waitForTimeout(400);
      await page.getByRole('searchbox', { name: 'Buscar chamados', exact: true }).fill('gol');
      await page.waitForTimeout(400);
      assert.equal(await page.evaluate(() => window.__calls.filter(c => c.route === '/admin/equipe/chamados/filtros').length), filterCalls, 'Busca não recarrega as opções da fila');

      await page.goto(base + 'manutencao');
      await page.getByRole('button', { name: 'Nova pausa', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Pausar uma função', exact: true });
      await dialog.getByRole('combobox', { name: /Função/ }).click();
      await dialog.getByRole('option', { name: 'Criação de partidas', exact: true }).click();
      await dialog.getByText('Toda a plataforma', { exact: true }).click();
      await dialog.getByText('Correção em andamento', { exact: true }).click();
      await dialog.getByRole('button', { name: 'Revisar impacto', exact: true }).click();
      await dialog.getByText(/Novas operações desta função serão bloqueadas/).waitFor();
      await page.screenshot({ path: path.join(output, `pausa-${scenario.width}.png`) });
      await page.evaluate(() => { window.__failWrite = true; });
      await dialog.getByRole('button', { name: 'Confirmar pausa', exact: true }).click();
      await dialog.getByRole('alert').waitFor();
      await dialog.getByRole('button', { name: 'Voltar', exact: true }).click();
      assert.equal(await dialog.getByRole('radio', { name: 'Correção em andamento', exact: true }).isChecked(), true);
      await page.evaluate(() => { window.__failWrite = false; });
      await dialog.getByRole('button', { name: 'Revisar impacto', exact: true }).click();
      await dialog.getByRole('button', { name: 'Confirmar pausa', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Reativar função', exact: true }).waitFor();

      await page.goto(base + 'logs');
      const consoleBox = page.getByRole('log', { name: 'Registros da API', exact: true });
      await consoleBox.waitFor();
      const consoleBounds = await consoleBox.boundingBox();
      const footerBounds = await page.locator('.desktop-log-status').boundingBox();
      assert.ok(consoleBounds.y + consoleBounds.height <= footerBounds.y + 1, 'Rodapé do console não cobre os registros');
      const scopeBounds = await page.locator('.desktop-log-scope').boundingBox();
      assert.ok(footerBounds.y + footerBounds.height <= scopeBounds.y + 1, 'Nota do histórico fica abaixo do console');
      const scroll = await page.evaluate(() => ({ page: scrollY, main: document.getElementById('main-content').scrollTop }));
      await page.evaluate(() => window.__emitLogs(3, 1500));
      await page.waitForTimeout(500);
      assert.equal(await page.locator('.log-linha').count(), 1000);
      assert.deepEqual(await page.evaluate(() => ({ page: scrollY, main: document.getElementById('main-content').scrollTop })), scroll, 'Novos logs não rolam a página');
      await page.getByRole('button', { name: 'Pausar', exact: true }).click();
      const last = await page.locator('.log-msg').last().innerText();
      await page.evaluate(() => window.__emitLogs(1503, 3)); await page.waitForTimeout(250);
      assert.equal(await page.locator('.log-msg').last().innerText(), last);
      await page.getByRole('button', { name: 'Retomar', exact: true }).click(); await page.waitForTimeout(250);
      assert.match(await page.locator('.log-msg').last().innerText(), /1505/);
      await page.getByRole('searchbox', { name: 'Filtrar texto', exact: true }).fill('/1505');
      assert.equal(await page.locator('.log-linha').count(), 1);
      await page.getByRole('button', { name: 'Opções dos logs', exact: true }).click();
      const menuBounds = await page.getByRole('menu', { name: 'Opções dos logs', exact: true }).boundingBox();
      assert.ok(menuBounds.y >= 0 && menuBounds.y + menuBounds.height <= scenario.height, 'Menu cabe na janela');
      await page.getByRole('menuitem', { name: 'Copiar exibidos', exact: true }).click();
      assert.deepEqual(await page.evaluate(() => window.__logExports.at(-1)), [1505]);
      await page.getByRole('button', { name: 'Opções dos logs', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Exportar .txt', exact: true }).click();
      assert.deepEqual(await page.evaluate(() => window.__logExports.at(-1)), [1505]);
      await page.getByRole('searchbox', { name: 'Filtrar texto', exact: true }).fill('');
      await page.getByRole('button', { name: 'Opções dos logs', exact: true }).click();
      await page.getByRole('menuitemradio', { name: /Mais recentes primeiro/ }).click();
      assert.match(await page.locator('.log-msg').first().innerText(), /1505/);
      await page.getByRole('button', { name: 'Opções dos logs', exact: true }).click();
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('menu').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Opções dos logs', exact: true }).evaluate(el => el === document.activeElement), true);
      await page.getByRole('button', { name: 'Ampliar console', exact: true }).click();
      assert.equal(await page.locator('.desktop-logs-expanded').count(), 1);
      const expanded = await page.locator('.desktop-logs-expanded').boundingBox();
      assert.equal(Math.round(expanded.x), 12);
      assert.equal(Math.round(expanded.y), 12);
      assert.equal(Math.round(expanded.width), scenario.width - 24);
      await page.screenshot({ path: path.join(output, `logs-ampliado-${scenario.width}.png`) });
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.desktop-logs-expanded').count(), 0);
      assert.equal(await page.getByText('Acompanhar novos', { exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: /Local|UTC/ }).count(), 0);
      await page.getByRole('button', { name: /^Nível dos logs:/ }).click();
      let logMenu = page.getByRole('menu', { name: /^Nível dos logs:/ });
      assert.equal(await logMenu.locator('[aria-checked="true"] .desktop-menu-selection-dot').count(), 1);
      await logMenu.getByRole('menuitemradio', { name: 'Só erros', exact: true }).click();
      assert.equal(await page.locator('.log-linha').count(), 0);
      await page.getByRole('button', { name: /^Nível dos logs:/ }).click();
      await page.getByRole('menuitemradio', { name: 'Todos os logs', exact: true }).click();
      const beforePeriod = await page.locator('.desktop-log-viewer').boundingBox();
      await page.getByRole('button', { name: /^Período dos logs:/ }).click();
      logMenu = page.getByRole('menu', { name: /^Período dos logs:/ });
      assert.equal(await logMenu.getByRole('menuitemradio').count(), 8);
      assert.equal(await logMenu.locator('[aria-checked="true"] .desktop-menu-selection-dot').count(), 1);
      assert.equal(await logMenu.getByText(/Custom|Personalizado/).count(), 0);
      assert.deepEqual(await page.locator('.desktop-log-viewer').boundingBox(), beforePeriod, 'O menu abre sobre o conteúdo sem deslocar o console');
      await page.screenshot({ path: path.join(output, `logs-periodos-${scenario.width}.png`) });
      await page.getByRole('menuitemradio', { name: 'Última hora', exact: true }).click();
      await page.getByRole('button', { name: 'Pausar', exact: true }).click();
      await page.getByRole('button', { name: /^Período dos logs:/ }).click();
      await page.getByRole('menuitemradio', { name: 'Ao vivo', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Pausar', exact: true }).count(), 1, 'Ao vivo retoma a atualização');
      await page.screenshot({ path: path.join(output, `logs-controles-${scenario.width}.png`), fullPage: true });
      await page.goto(base + 'ajustes');
      await page.getByRole('heading', { name: 'Ajustes', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.__logListeners.size), 0, 'Libera listener de logs ao sair');
      await page.getByRole('textbox', { name: 'URL da API', exact: true }).fill('http://servidor-inseguro.test');
      await page.getByRole('button', { name: 'Revisar alteração', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Trocar servidor?', exact: true });
      await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
      assert.equal(await page.evaluate(() => window.__configWrites), 0, 'Cancelar não altera servidor');
      await page.getByRole('button', { name: 'Revisar alteração', exact: true }).click();
      await dialog.getByRole('button', { name: 'Trocar servidor e sair', exact: true }).click();
      await dialog.getByRole('alert').waitFor();
      assert.equal(await page.getByRole('heading', { level: 1, name: 'Ajustes', exact: true }).count(), 1, 'Falha de configuração preserva a sessão');
      await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await page.evaluate(() => window.__expire());
      await page.getByRole('heading', { name: 'Bem-vindo de volta', exact: true }).waitFor();
      assert.deepEqual(errors, []);
      console.log(`PASS operações administrativas, recuperação, logs e layout ${scenario.width} ${scenario.theme}`);
      await context.close();
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
