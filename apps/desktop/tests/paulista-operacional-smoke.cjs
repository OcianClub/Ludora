const { _electron, chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

async function main() {
  const root = process.cwd(), local = path.join(root, '.local-demo/equipe');
  const out = path.join(root, 'test-results/paulista-operacional');
  await fs.mkdir(out, { recursive: true });
  const contas = JSON.parse(await fs.readFile(path.join(local, 'contas.json'), 'utf8'));
  const dados = JSON.parse(await fs.readFile(path.join(local, 'paulista-operacional.json'), 'utf8'));
  const profile = await fs.mkdtemp(path.join(local, 'paulista-profile-'));
  await fs.writeFile(path.join(profile, 'config.json'), JSON.stringify({ apiUrl: 'http://127.0.0.1:3018' }));
  const wrapper = path.join(profile, 'launch.cjs');
  await fs.writeFile(wrapper, `const { app } = require('electron'); app.setPath('userData', ${JSON.stringify(profile)}); require(${JSON.stringify(path.join(root, 'apps/desktop/out/main/index.js'))});`);
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_RENDERER_URL;
  const app = await _electron.launch({ executablePath: require(path.join(root, 'apps/desktop/node_modules/electron')), args: [wrapper], env });
  const page = await app.firstWindow();
  page.setDefaultTimeout(12000);
  const api = (method, endpoint, body) => page.evaluate(({ method, endpoint, body }) => window.ludora.api.requisicao(method, endpoint, body), { method, endpoint, body });
  const login = async papel => {
    const c = contas.find(c => c.papel === papel);
    await page.getByLabel('E-mail', { exact: true }).fill(c.email);
    await page.getByLabel('Senha', { exact: true }).fill(c.senha);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  };
  try {
    await login('SUPERADMIN');
    await page.getByRole('link', { name: 'Campeonato Paulista', exact: true }).click();
    const fila = page.locator('.ticket-day').filter({ has: page.getByRole('heading', { name: /^Alertas/ }) });
    const expandir = fila.getByRole('button', { name: /^Ver os outros/ });
    const semAlertas = page.locator('.paulista-club-card').filter({ hasText: dados.clubeSemAlertas });
    await semAlertas.locator('.desktop-accordion-heading > button').getByText('0 alertas', { exact: true }).waitFor();
    await semAlertas.locator('.desktop-accordion-heading > button').click();
    await semAlertas.getByRole('button', { name: /Sub-12/ }).waitFor();
    const clube = page.locator('.paulista-club-card').filter({ hasText: dados.clubeNome });
    await clube.locator('.desktop-accordion-heading > button').getByText('3 alertas', { exact: true }).waitFor();
    if (await expandir.count()) {
      assert.equal(await fila.locator('.ticket-card').count(), 5);
      await expandir.click();
      assert.ok(await fila.locator('.ticket-card').count() > 5);
      await page.screenshot({ path: path.join(out, 'fila-expandida.png') });
      await fila.getByRole('button', { name: 'Mostrar menos alertas' }).click();
    }
    await clube.locator('.desktop-accordion-heading > button').click();
    await clube.getByRole('button', { name: /Alteração no calendário/ }).waitFor();
    await page.screenshot({ path: path.join(out, 'clubes-com-e-sem-alertas.png') });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 720));
    assert.equal(await page.locator('#main-content').evaluate(el => el.scrollWidth > el.clientWidth), false);
    await page.screenshot({ path: path.join(out, 'clubes-900.png') });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1360, 860));
    await clube.locator('.desktop-accordion-heading > button').click();
    await page.getByRole('searchbox', { name: 'Buscar campeonatos' }).fill(dados.clubeNome);
    await page.getByRole('button', { name: 'Mais filtros' }).click();
    const filtros = page.getByRole('dialog', { name: 'Filtrar campeonatos' });
    await filtros.getByRole('button', { name: /^Tipo de pendência:/ }).click();
    await filtros.getByRole('menuitemradio', { name: 'Placar divergente', exact: true }).click();
    await filtros.getByRole('button', { name: 'Aplicar filtros' }).click();
    await page.getByRole('button', { name: /Ocian Sandbox.*Placar divergente/ }).click();
    const tabela = page.getByRole('table', { name: 'Comparação da divergência' });
    await tabela.getByRole('cell', { name: '5 × 2', exact: true }).waitFor();
    await tabela.getByRole('cell', { name: '6 × 2', exact: true }).waitFor();
    assert.match(await page.getByRole('link', { name: 'Abrir fonte oficial', exact: true }).getAttribute('href'), /admfutsal\.com\.br\/evento\//);
    assert.ok(page.url().includes(`clube=${dados.clubeId}`));
    await page.getByRole('switch', { name: 'Acompanhamento automático' }).click();
    const desligar = page.getByRole('dialog', { name: 'Desligar acompanhamento automático' });
    await desligar.getByText(/Cancela as próximas consultas/).waitFor();
    assert.equal(await desligar.locator('input[type=text]').count(), 0);
    await desligar.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await desligar.waitFor({ state: 'hidden' });
    await page.getByRole('switch', { name: 'Acompanhamento automático', checked: false }).waitFor();
    await page.getByRole('button', { name: 'Consultar Federação agora', exact: true }).click();
    await page.getByRole('dialog', { name: 'Consultar Federação agora' }).getByRole('button', { name: 'Voltar', exact: true }).click();
    await page.screenshot({ path: path.join(out, 'comparacao-escuro.png') });
    await page.getByRole('button', { name: 'Solicitar correção ao clube' }).click();
    const clubeRevisao = page.getByRole('dialog', { name: 'Solicitar correção ao clube' });
    await clubeRevisao.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await page.locator('#paulista-pendencia-ativa button.ticket-card').getByText('Aguardando clube', { exact: true }).waitFor();
    const cliente = contas.find(c => c.papel === 'USUARIO');
    const loginWeb = await fetch('http://127.0.0.1:3018/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cliente),
    });
    assert.equal(loginWeb.status, 200);
    const sessao = await loginWeb.json();
    const navegador = await chromium.launch({ channel: 'msedge', headless: true });
    try {
      const web = await navegador.newPage();
      await web.addInitScript(({ s, clube }) => {
        localStorage.setItem('ludora_token', s.token);
        localStorage.setItem('ludora_usuario', JSON.stringify(s.usuario));
        localStorage.setItem('ludora_clube_id', String(clube.id));
        localStorage.setItem('ludora_clube', JSON.stringify(clube));
      }, { s: sessao, clube: { id: dados.clubeId, nome: dados.clubeNome, meuPapel: 'ADMIN' } });
      await web.goto(`http://localhost:5198/competicoes/paulista?evento=${dados.eventoId}&ano=2027&faixa=BASE&aba=avisos`);
      await web.getByText('Placar divergente', { exact: true }).waitFor();
      await web.getByText(/Federação 5 × 2 · Clube 6 × 2/).waitFor();
      await web.getByText(/A equipe Ludora pediu que o clube confira/).waitFor();
      await web.screenshot({ path: path.join(out, 'web-aviso-clube.png') });
    } finally { await navegador.close(); }
    await page.getByRole('button', { name: 'Encaminhar aos desenvolvedores', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Encaminhar aos desenvolvedores' });
    const passos = 'Open the published result and compare it with the local report.';
    await modal.getByRole('button', { name: /^Motivo:/ }).click();
    await modal.getByRole('menuitemradio', { name: 'Outro', exact: true }).click();
    await modal.getByLabel('Descreva o motivo').fill(passos);
    await modal.getByRole('button', { name: 'Criar chamado técnico' }).click();
    const link = page.getByRole('link', { name: 'Abrir chamado vinculado' });
    await link.waitFor();
    await page.locator('#paulista-pendencia-ativa').getByText(/Chamado técnico vinculado ·/).waitFor();
    const id = (await link.getAttribute('href')).split('id=')[1];
    const rota = `/admin/paulista/eventos/${dados.eventoId}/pendencias/${dados.pendenciaId}/chamado`;
    const repetido = await api('POST', rota, { motivo: passos });
    assert.equal(repetido.status, 200); assert.equal(repetido.data.chamadoId, id);
    assert.equal((await api('POST', rota.replace(`eventos/${dados.eventoId}`, 'eventos/999999'), { motivo: passos })).status, 404);
    await page.getByRole('button', { name: 'Solicitar análise de vínculo' }).click();
    const vinculo = page.getByRole('dialog', { name: 'Solicitar análise de vínculo' });
    await vinculo.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await page.getByRole('link', { name: 'Acompanhar análise' }).waitFor();
    await page.getByRole('button', { name: 'Manter dado oficial', exact: true }).click();
    const manter = page.getByRole('dialog', { name: 'Registrar conferência do dado oficial' });
    await manter.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await page.locator('#paulista-pendencia-ativa button.ticket-card').getByText('Conferida', { exact: true }).waitFor();
    await tabela.getByRole('cell', { name: '6 × 2', exact: true }).waitFor();
    await page.getByRole('radio', { name: 'Tema claro', exact: true }).click();
    await page.screenshot({ path: path.join(out, 'chamado-vinculado-claro.png') });
    await page.getByRole('link', { name: 'Configurar pausa' }).click();
    const pausa = page.getByRole('dialog', { name: 'Pausar uma função' });
    assert.equal(await pausa.getByRole('radio', { name: /agenda oficial/i }).isChecked(), true);
    await pausa.getByText('Descrever motivo', { exact: true }).click();
    await pausa.getByLabel('Descreva o motivo').fill('Calendário oficial em conferência pela operação.');
    await pausa.getByRole('button', { name: 'Revisar impacto' }).click();
    await pausa.getByRole('button', { name: 'Confirmar pausa' }).click();
    await pausa.waitFor({ state: 'hidden' });
    assert.equal((await api('POST', `/admin/paulista/eventos/${dados.eventoId}/sincronizar`, {})).status, 423);
    await page.getByRole('button', { name: 'Sair da conta' }).click();
    await login('DESENVOLVEDOR');
    await page.getByRole('link', { name: 'Chamados', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Buscar chamados' }).fill(id);
    await page.getByRole('button', { name: /Paulista 2027.*A3 TESTE/ }).click();
    await page.getByText(passos, { exact: true }).waitFor();
    assert.equal((await api('POST', rota, { motivo: passos })).status, 403);
    console.log('PASS comparação Federação/Ludora, filtro real, chamado idempotente, pausa do evento e acesso técnico no Electron.');
  } catch (e) { await page.screenshot({ path: path.join(out, 'falha.png') }); throw e; }
  finally { await app.close(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
