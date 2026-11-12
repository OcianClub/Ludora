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
  window.__failDb = false; window.__dbDelay = 0; window.__failOverview = false;
  window.__lembreteEnviado = false;
  const noop = () => () => {};
  const admin = { id: 1, nome: 'Admin de teste', email: 'admin@example.test', papel_plataforma: 'SUPERADMIN' };
  const clubes = ['Ocian', 'Santos', 'Associação com nome longo para testar a distribuição dos elementos'].map((nome, i) => ({ id: i + 1, nome, escudo: null, cidade: 'Praia Grande', estado: 'SP', ativo: i !== 2, plano: 'DEMO', membros: 3, jogadores: 120, categorias: 8, partidas: 100, competicoes: 2, endereco: null, cnpj: null }));
  const overview = { clubes, totais: { clubes: 3, usuarios: 20, jogadores: 360, partidas: 300, partidasAoVivo: 2 }, conexoes: { principal: 2, admin: 1 } };
  const contas = [{ ...admin, clubes: [], suspenso: false }, { id: 2, nome: 'Alex de teste', email: 'alex@example.test', papel_plataforma: 'USUARIO', suspenso: false, clubes: [{ clube_id: 1, nome: 'Ocian', papel: 'TECNICO' }] }];
  contas.push({ id: 3, nome: 'Conta de nome muito extenso para testar truncamento', email: 'nome.extenso@example.test', papel_plataforma: 'USUARIO', suspenso: true, clubes: [{ clube_id: 1, nome: 'Ocian', papel: 'TECNICO' }, { clube_id: 2, nome: 'Santos', papel: 'MESARIO' }] });
  contas.push({ ...admin, id: 4, nome: 'Outra conta interna', email: 'outra@example.test', clubes: [], suspenso: false });
  const cadastro = [
    { id: 1, nome: 'Ocian', ativo: true, motivos: [], tarefas: [{ id: 'antiga', motivo: 'CNPJ', estado: 'CONCLUIDA', mensagem: 'Cadastro completo.', criadoEm: '2026-11-01T12:00:00Z', destinatarios: [25] }] },
    { id: 2, nome: 'Santos', ativo: true, motivos: [{ value: 'ESCUDO', label: 'Escudo do clube', mensagem: 'Complete o cadastro de Santos. Falta informar o escudo.' }], tarefas: [] },
    { id: 3, nome: clubes[2].nome, ativo: false, motivos: [{ value: 'CNPJ', label: 'CNPJ do clube', mensagem: 'Complete o CNPJ.' }], tarefas: [] },
  ];
  window.__cadastroCompleto = false;
  let pausas = [];
  let chamados = [{ id: 'ch-1', assunto: 'Problema visual na partida', descricao: 'Descrição detalhada para testar o atendimento.', criadoEm: '2026-11-09T20:00:00Z', revisao: 1, regra: 'MANUAL', fila: 'SUPORTE', status: 'NOVO', origem: 'CLIENTE', tipo: 'ERRO', prioridade: 'NORMAL', impacto: 'OPERACAO_BLOQUEADA', usuarioId: 2, ocorrencias: 1, clube: { nome: 'Ocian' }, clubeId: 1, restrito: false, rota: '/partidas', servico: 'web', versao: '0.0.1', historico: [] }];
  chamados[0].revisarEm = new Date(Date.now() + 86400000).toISOString();
  chamados.push(
    {...chamados[0],id:'ch-atrasado',assunto:'Revisão de prazo vencido',status:'EM_TRIAGEM',prioridade:'ALTA',criadoEm:'2026-11-07T20:00:00Z',revisarEm:new Date(Date.now() - 3600000).toISOString()},
    {...chamados[0],id:'ch-recorrente',assunto:'Falha recorrente na busca',status:'EM_ANDAMENTO',ocorrencias:3},
    {...chamados[0],id:'ch-meus',assunto:'Atendimento sob minha responsabilidade',status:'AGUARDANDO_CLIENTE',responsavelId:1},
    {...chamados[0],id:'ch-dev',assunto:'Ajuste para desenvolvimento',status:'ENCAMINHADO_DEVS',fila:'DESENVOLVIMENTO'},
  );
  const closedDate = (days) => new Date(Date.now() - days * 86400000).toISOString();
  for (const [suffix, days] of [['hoje', 0], ['ontem', 1], ['antigo', 50], ['ano-anterior', 420]]) {
    chamados.push({...chamados[0], id:`closed-${suffix}`, assunto:`Atendimento finalizado ${suffix}`, criadoEm:'2025-01-01T12:00:00Z', status:'RESOLVIDO', finalizadoEm:closedDate(days), historico:[{id:1,acao:'FINALIZAR',motivo:'Problema corrigido e conferido.',criadoEm:closedDate(days)}]});
  }
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
        if (/^\/admin\/overview\/partidas\/\d+\/lembrete$/.test(p)) {
          if (window.__lembreteEnviado) return { ok: false, status: 409, data: { error: 'Um lembrete já foi enviado nas últimas 24 horas.' } };
          window.__lembreteEnviado = true;
          if (window.__uncertainReminder) return { ok: false, status: 504, data: { error: 'Resposta perdida após salvar o lembrete.' } };
          return { ok: true, status: 201, data: { enviado: true } };
        }
        if (window.__failWrite) return { ok: false, status: 503, data: { error: 'Falha simulada. Dados preservados.' } };
        if (p === '/admin/cadastro-pendente/2') {
          cadastro[1].tarefas.push({ id: 'tarefa-cadastro-1', motivo: body.motivo, estado: 'PENDENTE', mensagem: body.mensagemEsperada, criadoEm: '2026-11-10T12:00:00Z', destinatarios: body.destinatarios });
          return { ok: true, status: 201, data: { caixasAtualizadas: body.destinatarios.length } };
        }
        if (p === '/admin/cadastro-pendente/tarefas/tarefa-cadastro-1/dispensar') {
          cadastro[1].tarefas[0].estado = 'DISPENSADA'; cadastro[1].tarefas[0].justificativa = body.motivo;
          return { ok: true, status: 200, data: { ok: true } };
        }
        if (p === '/admin/equipe/chamados') { chamados = [{ ...chamados[0], id: 'ch-2', assunto: body.assunto, descricao: body.descricao, usuarioId: null, responsavelId: null }, ...chamados]; return { ok: true, status: 200, data: { id: 'ch-2' } }; }
        if (method === 'PATCH' && p.startsWith('/admin/equipe/chamados/')) {
          const item = chamados.find(c => c.id === p.split('/').at(-1));
          if (body.acao === 'ATRIBUIR') item.responsavelId = admin.id;
          if (body.acao === 'FINALIZAR') { item.status = 'RESOLVIDO'; item.finalizadoEm = new Date().toISOString(); }
          if (body.acao === 'STATUS') { item.status = body.status; if (body.status !== 'RESOLVIDO') item.finalizadoEm = null; }
          item.revisao++;
          item.historico = [...item.historico,{id:item.historico.length + 1,acao:body.acao,motivo:body.motivo,publico:body.publico,autorNome:admin.nome,criadoEm:new Date().toISOString()}];
          return {ok:true,status:200,data:{ok:true}};
        }
        if (p === '/admin/equipe/manutencao') pausas.push({ id: 'pausa-1', ...body, ativa: true, inicio: new Date().toISOString(), revisao: 1, historico: [{id:1,operadorId:1,motivo:body.motivo,criadoEm:new Date().toISOString(),depois:{ativa:true}}] });
        if (p === '/admin/equipe/manutencao/pausa-1/reativar') {
          const pausa = pausas.find(p=>p.id === 'pausa-1'); pausa.ativa = false; pausa.revisao++;
          pausa.historico.unshift({id:2,operadorId:1,motivo:body.motivo,criadoEm:new Date().toISOString(),depois:{ativa:false}});
        }
        return { ok: true, status: 200, data: {} };
      }
      let data;
      if (p === '/admin/overview') {
        if (window.__failOverview) return { ok: false, status: 503, data: { error: 'Falha simulada' } };
        data = overview;
      }
      else if (p === '/admin/overview/operacao') {
        if (window.__failOverview) return { ok: false, status: 503, data: { error: 'Falha simulada' } };
        data = { consultadoEm: '2026-11-10T12:00:00Z', chamados: { abertos: 3, atrasados: 1 }, manutencao: 1, federacao: { pendencias: 0, falhas: 0, erroRotina: false }, semInicio: [], antigas: [{ id: 10, inicioAoVivo: '2026-11-08T12:00:00Z', organizador_id: 1, data: '2026-08-01T00:00:00Z', horario: '20:00', categoria: { nome: 'SUB-7', clube_id: 1 }, mandante: { nome: 'Ocian', escudo: null }, visitante: { nome: 'Santos', escudo: null } }] };
      }
      else if (/^\/admin\/overview\/partidas\/\d+\/lembrete$/.test(p)) data = { organizador: { id: 1, nome: 'Ocian', ativo: true }, gestores: [{ id: 25, nome: 'Responsável teste', papel: 'ADMIN' }, { id: 26, nome: 'Administrador', email: 'admin.um@example.test', papel: 'ADMIN' }, { id: 27, nome: 'Administrador', email: 'admin.dois@example.test', papel: 'ADMIN' }], podeEnviar: !window.__lembreteEnviado, ultimoEnvio: window.__lembreteEnviado ? '2026-11-10T12:00:00Z' : null, disponivelEm: window.__lembreteEnviado ? '2026-11-11T12:00:00Z' : null };
      else if (/^\/admin\/clubes\/\d+\/membros$/.test(p)) data = { categorias: [{ id: 7, nome: 'sub-7', tipo: 'INICIACAO', ativa: true, faixaIdade: 7 }], membros: [{ usuario: contas[1], papel: 'TECNICO', acesso_todas_categorias: true, categorias: [] }] };
      else if (p === '/admin/usuarios') data = [...contas].reverse().filter(u => `${u.nome} ${u.email}`.toLowerCase().includes((url.searchParams.get('busca') || '').toLowerCase()));
      else if (p === '/admin/cadastro-pendente') data = cadastro.map(c => window.__cadastroCompleto ? { ...c, motivos: [] } : c);
      else if (/^\/admin\/cadastro-pendente\/\d+\/destinatarios$/.test(p)) data = [{ id: 25, nome: 'Responsável pelo cadastro' }];
      else if (p === '/admin/equipe/chamados/filtros') data = { clubes: clubes.map(c => ({ value: c.id, label: c.nome })), responsaveis: [], contagens: { '': chamados.length, NOVO: chamados.filter(c=>c.status === 'NOVO').length, ATRASADO: 1, RECORRENTE: 1, MEUS: 1, ENCAMINHADOS: 1, FINALIZADOS: chamados.filter(c=>c.status === 'RESOLVIDO').length } };
      else if (p === '/admin/equipe/chamados/clubes') data = clubes.map(c => ({ value: c.id, label: c.nome }));
      else if (p === '/admin/equipe/chamados') data = chamados.filter(c => {
        const visao = url.searchParams.get('visao');
        return (!visao || visao === 'NOVO' && c.status === 'NOVO' || visao === 'ATRASADO' && c.status !== 'RESOLVIDO' && Date.parse(c.revisarEm) < Date.now() || visao === 'RECORRENTE' && c.ocorrencias > 1 || visao === 'MEUS' && c.responsavelId === 1 || visao === 'ENCAMINHADOS' && c.fila === 'DESENVOLVIMENTO' || visao === 'FINALIZADOS' && c.status === 'RESOLVIDO') && (!url.searchParams.get('status') || c.status === url.searchParams.get('status'));
      });
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

async function testarChamados(page, base, scenario) {
  await page.goto(base + 'chamados');
  await page.getByRole('button', { name: /Problema visual na partida/ }).waitFor();
  const primeiroChamado = page.locator('.desktop-tickets-page .ticket-card').first();
  assert.ok((await primeiroChamado.textContent()).includes('Revisão de prazo vencido'), 'Prioridade alta antiga aparece antes dos chamados normais recentes');
  assert.match(await primeiroChamado.innerText(), /Sem responsável[\s\S]*Revisão atrasada/);
  assert.equal(await page.locator('.ticket-queue .ticket-card').count(), 5, 'Cada chamado ativo aparece uma vez');
  assert.equal(await primeiroChamado.locator(':scope > .icon').count(), 0, 'Linha sem chevron decorativo');
  await page.mouse.move(5,5);
  await page.waitForTimeout(200); // Aguarda o fim do hover antes de comparar as superfícies.
  const superficie = await page.getByRole('button', {name:'Período: Todos os períodos',exact:true}).evaluate(el => getComputedStyle(el).backgroundColor);
  assert.equal(superficie, await page.locator('.ticket-toolbar .collection-search').evaluate(el => getComputedStyle(el).backgroundColor), 'Período e busca usam o mesmo fundo');
  assert.ok((await page.getByRole('heading', {level:1,name:'Chamados',exact:true}).boundingBox()).height >= 24, 'Título permanece legível na janela menor');
  if (scenario.width === 640) {
    const busca = await page.getByRole('searchbox', {name:'Buscar chamados',exact:true}).boundingBox();
    const filtros = await page.getByRole('button', {name:'Mais filtros',exact:true}).boundingBox();
    assert.ok(Math.abs(busca.y - filtros.y) < 5, 'Busca e filtros ficam na mesma linha');
  }
  for (const [label, assunto] of [['Novos', 'Problema visual na partida'], ['Revisão atrasada', 'Revisão de prazo vencido'], ['Recorrentes', 'Falha recorrente na busca'], ['Meus chamados', 'Atendimento sob minha responsabilidade']]) {
    await page.getByRole('tab', { name: new RegExp('^' + label) }).click();
    await page.getByRole('button', { name: new RegExp(assunto) }).waitFor();
    assert.equal(await page.locator('.desktop-tickets-page .ticket-card').count(), 1, 'Categoria mostra o exemplo correspondente');
  }
  await page.getByRole('tab', { name: /^Todos/ }).click();
  await page.getByRole('button', { name: /Problema visual na partida/ }).waitFor();
  await page.screenshot({ path: path.join(output, `chamados-fila-${scenario.width}.png`), fullPage: true });
  await page.getByRole('tab', {name:/^Finalizados/}).click();
  const closed = page.getByRole('region', {name:'Chamados finalizados',exact:true});
  await closed.getByRole('button', {name:/^Hoje/}).waitFor();
  assert.equal(await page.getByRole('button', {name:/Atendimento finalizado hoje/}).count(), 0, 'Encerrados começam recolhidos');
  const accordion = closed.getByRole('button', {name:/^Hoje/});
  await accordion.focus(); await page.keyboard.press('Enter');
  assert.equal(await accordion.getAttribute('aria-expanded'), 'true');
  await page.getByRole('button', {name:/Atendimento finalizado hoje/}).click();
  await page.getByRole('heading', {level:1,name:'Atendimento finalizado hoje'}).waitFor();
  assert.equal(await page.getByRole('button', {name:'Finalizar chamado',exact:true}).count(), 0, 'Não oferece finalizar novamente');
  await page.getByRole('heading', {name:'Histórico do atendimento',exact:true}).waitFor();
  await page.screenshot({path:path.join(output,`chamado-detalhe-${scenario.width}.png`),fullPage:true});
  await page.getByRole('button', {name:'Contexto e diagnóstico',exact:true}).click();
  await page.getByRole('button', {name:'Voltar à fila',exact:true}).click();
  assert.equal(await closed.getByRole('button', {name:/^Hoje/}).getAttribute('aria-expanded'), 'true', 'O grupo aberto é preservado ao voltar');
  await closed.getByRole('button', {name:/^Ontem/}).click();
  await page.getByRole('button', {name:/Atendimento finalizado ontem/}).waitFor();
  const closedRow = page.getByRole('button', {name:/Atendimento finalizado ontem/});
  assert.ok(await closedRow.evaluate(el=>Math.abs(el.getBoundingClientRect().width - el.parentElement.clientWidth) < 2), 'Linha do chamado encerrado ocupa toda a seção');
  await page.screenshot({path:path.join(output,`chamados-finalizados-${scenario.width}.png`),fullPage:true});
  await page.getByRole('tab', {name:/^Todos/}).click();
  await page.getByRole('button', {name:/Problema visual na partida/}).waitFor();
  await page.getByRole('button', { name: 'Mais filtros', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Filtrar chamados', exact: true });
  if (scenario.theme === 'dark') {
    assert.equal(await dialog.evaluate(el=>getComputedStyle(el).backgroundColor), 'rgb(11, 13, 18)');
    assert.equal(await dialog.getByRole('button', {name:'Situação: Todas as situações',exact:true}).evaluate(el=>getComputedStyle(el).backgroundColor), 'rgb(20, 23, 31)');
  }
  await dialog.getByRole('button', {name:'Limpar filtros',exact:true}).hover();
  await page.waitForTimeout(200);
  assert.equal(await dialog.getByRole('button', {name:'Limpar filtros',exact:true}).evaluate(el=>getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
  await dialog.getByRole('button', { name: 'Situação: Todas as situações', exact: true }).click();
  await dialog.getByRole('menuitemradio', { name: 'Em triagem', exact: true }).click();
  await dialog.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
  await page.getByRole('button', { name: /Revisão de prazo vencido/ }).waitFor();
  assert.equal(await page.locator('.desktop-tickets-page .ticket-card').count(), 1);
  await page.getByRole('button', { name: 'Limpar tudo', exact: true }).click();
  await page.getByRole('button', { name: /Problema visual na partida/ }).click();
  await page.getByRole('textbox', { name: 'Nota interna', exact: true }).fill('Informação restrita à equipe.');
  await page.getByRole('tab', { name: 'Responder ao cliente', exact: true }).click();
  assert.equal(await page.getByRole('textbox', { name: 'Resposta ao cliente', exact: true }).inputValue(), '');
  await page.getByRole('textbox', { name: 'Resposta ao cliente', exact: true }).fill('A equipe já está analisando a partida.');
  await page.getByRole('button', { name: 'Enviar resposta ao cliente', exact: true }).click();
  await page.getByRole('heading', { name: 'Resposta ao cliente', exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Nota interna', exact: true }).click();
  assert.equal(await page.getByRole('textbox', { name: 'Nota interna', exact: true }).inputValue(), 'Informação restrita à equipe.');
  await page.getByRole('button', { name: 'Registrar nota interna', exact: true }).click();
  await page.getByRole('heading', { name: 'Nota interna', exact: true }).waitFor();
  const visibilidade = await page.evaluate(() => window.__writes.filter(w => w.body?.acao === 'COMENTAR').slice(-2).map(w => w.body.publico));
  assert.deepEqual(visibilidade, [true, false], 'Resposta pública e nota privada usam rascunhos independentes');
  await page.getByRole('button', { name: 'Voltar à fila', exact: true }).click();
  await page.getByRole('button', { name: 'Novo chamado', exact: true }).click();
  await page.evaluate(() => { window.__failWrite = true; });
  dialog = page.getByRole('dialog', { name: 'Novo chamado manual', exact: true });
  await dialog.getByRole('textbox', { name: 'Assunto (obrigatório)', exact: true }).fill('Falha no teste visual');
  await dialog.getByRole('textbox', { name: 'Descrição', exact: true }).fill('Descrição suficientemente longa para o chamado.');
  await dialog.getByRole('button', { name: 'Tela (obrigatória): Selecione a tela', exact: true }).click();
  await dialog.getByRole('menuitemradio', { name: 'Partidas', exact: true }).click();
  await dialog.getByRole('radio', { name: 'Santos', exact: true }).check();
  await dialog.screenshot({ path: path.join(output, `chamado-novo-${scenario.width}.png`) });
  await dialog.getByRole('button', { name: 'Criar chamado', exact: true }).click();
  await dialog.getByRole('alert').waitFor();
  assert.equal(await dialog.getByRole('textbox', { name: 'Assunto (obrigatório)', exact: true }).inputValue(), 'Falha no teste visual');
  await page.evaluate(() => { window.__failWrite = false; });
  await dialog.getByRole('button', { name: 'Criar chamado', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  const escrito = await page.evaluate(() => window.__writes.filter(w => w.route === '/admin/equipe/chamados').at(-1));
  assert.equal(escrito.body.clubeId, 2, 'Card de clube envia o identificador correto');
  assert.equal(escrito.body.rota, '/partidas', 'Select da tela preserva o contrato da API');
  await page.getByRole('heading', { level: 1, name: 'Falha no teste visual', exact: true }).waitFor();
  await page.getByRole('button', {name:'Assumir chamado',exact:true}).click();
  dialog = page.getByRole('dialog', {name:'Assumir chamado',exact:true});
  await dialog.getByRole('textbox', {name:'Motivo da atribuição',exact:true}).fill('Conferido o relato no ambiente de teste.');
  await dialog.getByRole('button', {name:'Confirmar decisão',exact:true}).click();
  await page.getByRole('heading', {name:'Responsável atualizado',exact:true}).waitFor();
  await page.getByRole('button', {name:'Mais ações',exact:true}).click();
  await page.getByRole('button', {name:'Finalizar chamado',exact:true}).click();
  dialog = page.getByRole('dialog', {name:'Finalizar chamado',exact:true});
  await dialog.getByRole('textbox', {name:'Como o problema foi resolvido?',exact:true}).fill('Correção verificada e atendimento concluído.');
  await dialog.getByRole('button', {name:'Confirmar decisão',exact:true}).click();
  await dialog.waitFor({state:'detached'});
  await page.locator('.ticket-detail-summary .ticket-status[data-state="RESOLVIDO"]').waitFor();
  assert.equal(await page.getByRole('button', {name:'Finalizar chamado',exact:true}).count(), 0);
  await page.getByRole('button', {name:'Alterar status ou tipo',exact:true}).click();
  await page.getByRole('button', {name:'Novo status: Reaberto',exact:true}).waitFor();
  await page.getByRole('textbox', {name:'Motivo da alteração',exact:true}).fill('O cliente confirmou a necessidade de nova análise.');
  await page.getByRole('button', {name:'Registrar status',exact:true}).click();
  await page.locator('.ticket-detail-summary .ticket-status[data-state="REABERTO"]').waitFor();
  await page.getByRole('button', {name:'Finalizar chamado',exact:true}).waitFor();
  await page.getByRole('button', { name: 'Voltar à fila', exact: true }).click();
  const filterCalls = await page.evaluate(() => window.__calls.filter(c => c.route === '/admin/equipe/chamados/filtros').length);
  await page.getByRole('searchbox', { name: 'Buscar chamados', exact: true }).fill('placar');
  await page.waitForTimeout(400);
  await page.getByRole('searchbox', { name: 'Buscar chamados', exact: true }).fill('gol');
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.__calls.filter(c => c.route === '/admin/equipe/chamados/filtros').length), filterCalls, 'Busca não recarrega as opções da fila');
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
    for (const scenario of [{ width: 1440, height: 900, theme: 'dark' }, { width: 900, height: 700, theme: 'light' }, { width: 640, height: 480, theme: 'dark' }].filter(s => !process.env.DESKTOP_TEST_WIDTH || s.width === Number(process.env.DESKTOP_TEST_WIDTH))) {
      const context = await browser.newContext({ viewport: scenario });
      const page = await context.newPage(); page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(fixture, scenario);
      const base = `http://127.0.0.1:${server.address().port}/#/`;
      if (process.env.DESKTOP_TEST_SUPPORT_ONLY) {
        await testarChamados(page, base, scenario);
        assert.deepEqual(errors, []);
        console.log(`PASS chamados ${scenario.width}px ${scenario.theme}`);
        await context.close();
        continue;
      }
      for (const [route, title] of [['visao', 'Visão global'], ['clubes', 'Clubes'], ['usuarios', 'Usuários'], ['visao', 'Visão global'], ['chamados', 'Chamados'], ['manutencao', 'Manutenção'], ['paulista', 'Campeonato Paulista'], ['banco', 'Banco e integrações'], ['logs', 'Logs ao vivo'], ['ajustes', 'Ajustes']].filter(([route]) => !process.env.DESKTOP_TEST_OVERVIEW_ONLY || route === 'visao')) {
        await page.goto(base + route);
        await page.getByRole('heading', { level: 1, name: title, exact: true }).waitFor();
        await page.waitForTimeout(350);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${route}: sem overflow horizontal`);
        assert.equal(await page.locator('.admin-content').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, `${route}: conteúdo cabe na janela`);
        if (route === 'visao') {
          await page.getByText('3 abertos', { exact: true }).waitFor();
          await page.getByRole('button', { name: 'Atualizar', exact: true }).waitFor();
          const toolbarGap = await page.locator('.overview-club-toolbar').evaluate(toolbar => {
            const filter = toolbar.querySelector('.overview-club-filter > button').getBoundingClientRect();
            const view = toolbar.querySelector('.collection-mode-toggle').getBoundingClientRect();
            return Math.abs(filter.top - view.top) < 2 ? view.left - filter.right : view.top - filter.bottom;
          });
          assert.ok(toolbarGap >= 11, 'Filtro não encosta no seletor Tabela/Cards');
          const column = page.getByRole('columnheader').filter({ has: page.getByRole('button', { name: 'Ordenar por Clube', exact: true }) });
          for (const order of ['ascending', 'descending', 'none']) {
            await column.getByRole('button').click();
            assert.equal(await column.getAttribute('aria-sort'), order);
          }
          await page.getByRole('button', { name: 'Filtrar clubes na visão global', exact: true }).click();
          let clubFilters = page.getByRole('menu', { name: 'Filtrar clubes na visão global', exact: true });
          await clubFilters.screenshot({ path: path.join(output, `visao-filtros-${scenario.width}-${scenario.theme}.png`) });
          assert.equal(await page.getByRole('dialog').count(), 0, 'Filtros usam o menu compartilhado dos logs');
          await clubFilters.getByRole('menuitemradio', { name: 'Indisponível', exact: true }).click();
          assert.equal(await page.locator('.overview-club-table tbody tr').count(), 1, 'Filtro de situação aplicado');
          await page.getByRole('button', { name: 'Cards', exact: true }).click();
          assert.equal(await page.locator('.overview-club-cards .club-directory-card').count(), 1, 'Tabela e cards compartilham filtros');
          await page.getByRole('button', { name: 'Filtrar clubes na visão global', exact: true }).click();
          clubFilters = page.getByRole('menu', { name: 'Filtrar clubes na visão global', exact: true });
          assert.equal(await clubFilters.getByRole('menuitemradio', { name: 'Indisponível', exact: true }).getAttribute('aria-checked'), 'true');
          await clubFilters.getByRole('menuitem', { name: 'Limpar filtros', exact: true }).click();
          const filterTrigger = page.getByRole('button', { name: 'Filtrar clubes na visão global', exact: true });
          await filterTrigger.focus(); await page.keyboard.press('ArrowDown');
          await page.keyboard.press('Escape');
          assert.equal(await filterTrigger.getAttribute('aria-expanded'), 'false', 'Escape fecha o menu');
          assert.equal(await filterTrigger.evaluate(el => el === document.activeElement), true, 'Foco retorna ao botão');
          await page.getByRole('button', { name: 'Tabela', exact: true }).click();
          assert.equal(await page.locator('.overview-club-table tbody tr').count(), 3);
          const writesAntes = await page.evaluate(() => window.__writes.length);
          await page.getByRole('button', { name: 'Revisar partidas', exact: true }).click();
          const dialog = page.getByRole('dialog', { name: 'Revisar partidas ao vivo', exact: true });
          await dialog.locator('.overview-review-teams').getByText('Ocian', { exact: true }).waitFor();
          const reviewAlignment = await dialog.locator('.overview-old-matches > li').first().evaluate(card => {
            const home = card.querySelector('.overview-review-teams > span:first-child').getBoundingClientRect();
            const away = card.querySelector('.overview-review-teams > span:last-child').getBoundingClientRect();
            const separator = card.querySelector('.overview-review-teams > span:nth-child(2)').getBoundingClientRect();
            const request = card.querySelector('.overview-reminder > button').getBoundingClientRect();
            const link = card.querySelector('.overview-review-actions > a').getBoundingClientRect();
            return { crossOffset: Math.abs(separator.x + separator.width / 2 - (home.right + away.left) / 2), linkBelow: link.y >= request.bottom,
              actionsOffset: Math.abs(link.x - request.x) };
          });
          assert.ok(reviewAlignment.crossOffset < 2 && reviewAlignment.actionsOffset < 2 && reviewAlignment.linkBelow, 'Confronto alinhado e acesso ao clube abaixo da solicitação');
          await dialog.screenshot({ path: path.join(output, `visao-revisao-fechada-${scenario.width}-${scenario.theme}.png`) });
          assert.equal(await page.evaluate(() => window.__writes.length), writesAntes, 'Abrir revisão não envia notificação');
          await dialog.getByRole('button', { name: 'Solicitar revisão ao organizador', exact: true }).click();
          const enviar = dialog.getByRole('button', { name: 'Enviar lembrete', exact: true });
          await enviar.waitFor();
          const recipient = dialog.getByRole('button', { name: 'Gestor destinatário: Responsável teste · Administrador', exact: true });
          if (!await page.evaluate(() => window.__lembreteEnviado)) {
            await recipient.click();
            const options = dialog.getByRole('menu', { name: 'Gestor destinatário: Responsável teste · Administrador', exact: true });
            await options.waitFor();
            assert.equal(await options.getByRole('menuitemradio', { name: 'Administrador · admin.um@example.test', exact: true }).count(), 1);
            assert.equal(await options.getByRole('menuitemradio', { name: 'Administrador · admin.dois@example.test', exact: true }).count(), 1);
            assert.equal(await options.getByText('Administrador · Administrador', { exact: true }).count(), 0, 'Não repete o nome no cargo');
            assert.ok(await options.evaluate(el => el.firstElementChild.getBoundingClientRect().top - el.getBoundingClientRect().top >= 10), 'Respiro acima da primeira opção');
            const dimensions = await recipient.evaluate(button => {
              const field = button.getBoundingClientRect();
              const list = button.parentElement.querySelector('[role="menu"]').getBoundingClientRect();
              return { left: Math.abs(list.left - field.left), width: Math.abs(list.width - field.width) };
            });
            assert.ok(dimensions.left < 2 && dimensions.width < 2, 'Opções com a mesma largura e alinhamento do select');
            await dialog.screenshot({ path: path.join(output, `visao-responsavel-select-${scenario.width}-${scenario.theme}.png`) });
            const selected = options.getByRole('menuitemradio', { name: 'Responsável teste · Administrador', exact: true });
            assert.equal(await selected.getAttribute('aria-checked'), 'true');
            await selected.click();
          } else assert.equal(await recipient.isDisabled(), true, 'Select bloqueado após lembrete já enviado');
          assert.equal(await dialog.locator('.overview-reminder[data-open="true"]').evaluate(el => getComputedStyle(el).textAlign), 'left', 'Formulário alinhado à esquerda');
          await dialog.screenshot({ path: path.join(output, `visao-revisao-${scenario.width}-${scenario.theme}.png`) });
          if (!await page.evaluate(() => window.__lembreteEnviado)) {
            await page.evaluate(() => { window.__uncertainReminder = true; });
            await enviar.click();
            await dialog.getByText('Lembrete salvo nas notificações do gestor.', { exact: true }).waitFor();
          } else assert.equal(await enviar.isDisabled(), true, 'Novo envio permanece bloqueado ao reabrir');
          assert.equal(await page.evaluate(() => window.__writes.length), 1, 'Somente o envio explícito grava o lembrete');
          assert.equal(await page.evaluate(() => window.__writes[0].body.usuarioId), 25);
          await page.keyboard.press('Escape');
          await dialog.waitFor({ state: 'hidden' });
          assert.equal(await page.evaluate(() => window.__writes.every(w => w.route.endsWith('/lembrete'))), true, 'Não altera partidas de teste');
          await page.getByRole('searchbox', { name: 'Buscar clube na visão global', exact: true }).fill('Santos');
          assert.equal(await page.locator('.overview-club-table tbody tr').count(), 1);
          await page.getByRole('searchbox', { name: 'Buscar clube na visão global', exact: true }).fill('');
          await page.getByRole('button', { name: 'Cards', exact: true }).click();
          assert.equal(await page.locator('.overview-club-cards .club-directory-card').count(), 3);
          const statsTops = await page.locator('.overview-club-cards .club-directory-meta').evaluateAll(rows => rows.map(row => row.getBoundingClientRect().top));
          if (scenario.width === 1440) assert.ok(statsTops.every(top => Math.abs(top - statsTops[0]) < 2), 'Estatísticas dos cards alinhadas mesmo com nome extenso');
          assert.equal(await page.locator('.overview-club-cards .club-directory-card').evaluateAll(cards => cards.every(card => {
            const title = card.querySelector('.ticket-card-copy strong');
            return title.getBoundingClientRect().right <= card.getBoundingClientRect().right - 16;
          })), true, 'Nomes longos ficam contidos nos cards');
          assert.equal(await page.locator('.overview-club-cards .club-directory-card').evaluateAll(cards => cards.every(card => {
            const crest = card.querySelector('.club-badge').getBoundingClientRect();
            const status = card.querySelector('.overview-club-status').getBoundingClientRect();
            return Math.abs(crest.left - status.left) < 1 && status.top >= crest.bottom;
          })), true, 'Status alinhado à esquerda abaixo do escudo');
          await page.locator('.overview-club-cards').screenshot({ path: path.join(output, `visao-cards-${scenario.width}-${scenario.theme}.png`) });
          const scrolling = await page.evaluate(() => {
            const workspace = document.querySelector('.admin-workspace');
            workspace.scrollTop = workspace.scrollHeight;
            window.scrollTo(0, document.documentElement.scrollHeight);
            return { documentHeight: document.documentElement.scrollHeight, viewport: innerHeight,
              pageScroll: scrollY, sidebarTop: document.querySelector('.admin-sidebar').getBoundingClientRect().top,
              workspaceHeight: workspace.clientHeight, workspaceScroll: workspace.scrollTop,
              emptyTail: workspace.getBoundingClientRect().bottom - document.querySelector('.admin-content').getBoundingClientRect().bottom };
          });
          assert.ok(scrolling.documentHeight <= scrolling.viewport + 1 && scrolling.pageScroll === 0
            && Math.abs(scrolling.sidebarTop) < 1 && scrolling.workspaceHeight <= scrolling.viewport && scrolling.emptyTail <= 1,
          `Rolagem restrita ao conteúdo, sem espaço externo: ${JSON.stringify(scrolling)}`);
          await page.getByRole('button', { name: 'Tabela', exact: true }).click();
          await page.evaluate(() => { window.__failOverview = true; });
          await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
          await page.getByText('Não foi possível consultar a operação. As contagens de atenção não estão disponíveis.', { exact: true }).waitFor();
          assert.equal(await page.getByText('Consulta indisponível', { exact: true }).count(), 3);
          assert.equal(await page.locator('.overview-club-table tbody tr').count(), 3, 'Falha preserva clubes');
          await page.evaluate(() => { window.__failOverview = false; });
          await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
          await page.getByText('3 abertos', { exact: true }).waitFor();
          await page.getByRole('button', { name: 'Atualizar', exact: true }).waitFor();
          const expanded = await page.getByRole('button', { name: 'Recolher navegação', exact: true }).count();
          await page.getByRole('button', { name: expanded ? 'Recolher navegação' : 'Expandir navegação', exact: true }).click();
          assert.equal(await page.locator('.admin-content').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, 'Visão global cabe com outra largura da sidebar');
          await page.getByRole('button', { name: expanded ? 'Expandir navegação' : 'Recolher navegação', exact: true }).click();
          await page.locator('.overview-club-table').screenshot({ path: path.join(output, `visao-tabela-${scenario.width}-${scenario.theme}.png`) });
          await page.locator('.overview-now-grid').screenshot({ path: path.join(output, `visao-servicos-${scenario.width}-${scenario.theme}.png`) });
          await page.locator('.overview-v2 > .page-header').scrollIntoViewIfNeeded();
        }
        if (route === 'banco') {
          const sections = await page.locator('.desktop-bank-page .desktop-section-heading h2').allTextContents();
          assert.deepEqual(sections, ['Banco de dados', 'Integrações', 'Servidor', 'Registros por tabela']);
          assert.equal(await page.getByText('Upload não verificado nesta consulta.', { exact: true }).count(), 0, 'Armazenamento não configurado não é tratado como verificado');
          await page.getByText('Envio não verificado nesta consulta.', { exact: true }).waitFor();
          await page.getByText('Banco conectado', { exact: true }).waitFor();
          const recordSearch = page.getByRole('searchbox', { name: 'Buscar tabelas', exact: true });
          const callsBeforeSearch = await page.evaluate(() => window.__calls.length);
          await recordSearch.fill('comunicacao');
          await page.getByText('Nenhuma tabela encontrada', { exact: true }).waitFor();
          assert.equal(await page.locator('.bank-records-section .desktop-state-plain').count(), 1);
          await recordSearch.fill('ELENCO');
          assert.equal(await page.locator('.bank-records-table tbody tr').count(), 2, 'Busca por área ignora maiúsculas');
          await recordSearch.fill('partidas');
          assert.equal(await page.locator('.bank-records-table tbody tr').count(), 1);
          assert.equal(await page.evaluate(() => window.__calls.length), callsBeforeSearch, 'A busca filtra as contagens sem novas consultas');
          await recordSearch.fill('');
          assert.equal(await page.locator('.bank-records-table tbody tr').count(), 3);
          const statusColors = await page.locator('.bank-status > span').evaluateAll(els => els.map(el => getComputedStyle(el).backgroundColor));
          assert.notEqual(statusColors[0], statusColors[2], 'Conectado e apenas configurado têm indicadores distintos');
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
      if (process.env.DESKTOP_TEST_OVERVIEW_ONLY) {
        assert.deepEqual(errors, []);
        process.stdout.write(`PASS visão global e lembretes ${scenario.width} ${scenario.theme}\n`);
        await context.close(); continue;
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
      assert.equal(await page.locator('.desktop-users-table table.desktop-data-table').count(), 2, 'Usuários usa a tabela compartilhada com HTML semântico');
      const tab = page.getByRole('tab', { name: 'Cadastro dos clubes', exact: true });
      const tabStyle = await tab.evaluate(el => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor }));
      await tab.hover();
      assert.deepEqual(await tab.evaluate(el => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor })), tabStyle, 'Abas não mudam cores no hover');
      assert.equal(await tab.evaluate(el => getComputedStyle(el).justifyContent), 'flex-start', 'Texto das abas alinhado à esquerda');
      const stateColors = await page.locator('.desktop-user-state').evaluateAll(items => items.map(el => ({ suspended: el.dataset.suspended, color: getComputedStyle(el).color })));
      assert.notEqual(stateColors.find(s => s.suspended === 'false').color, stateColors.find(s => s.suspended === 'true').color, 'Ativa e Suspensa têm cores distintas');
      assert.equal(await page.locator('.desktop-user-role .desktop-role-badge > .icon, .desktop-user-role .desktop-role-badge > svg').count(), 4, 'Cargos mostram seus ícones');
      assert.equal(await page.locator('.desktop-user-line').first().getAttribute('data-self'), 'true', 'Minha conta fica no topo, independentemente da ordem recebida');
      assert.equal(await page.locator('.desktop-self-chip').textContent(), 'Você');
      const heading = page.getByRole('columnheader').filter({ has: page.getByRole('button', { name: 'Ordenar por Conta', exact: true }) }).first();
      const headerColor = await heading.getByRole('button').evaluate(el => getComputedStyle(el).color);
      for (const order of ['ascending', 'descending', 'none']) {
        await heading.getByRole('button').click();
        assert.equal(await heading.getAttribute('aria-sort'), order);
        assert.equal(await heading.getByRole('button').evaluate(el => getComputedStyle(el).color), headerColor, 'Ordenação não muda a cor do texto');
        assert.equal(await page.locator('.desktop-user-line').first().getAttribute('data-self'), 'true', 'Minha conta continua no topo ao ordenar');
      }
      await page.getByRole('button', { name: 'Mais filtros', exact: true }).click();
      let filterDialog = page.getByRole('dialog', { name: 'Filtrar usuários', exact: true });
      await filterDialog.getByRole('button', { name: 'Clube: Todos os clubes', exact: true }).click();
      await filterDialog.getByRole('menuitemradio', { name: 'Ocian', exact: true }).click();
      await filterDialog.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
      await page.waitForFunction(() => window.__calls.some(c => c.route.includes('/admin/usuarios?') && c.route.includes('clube=1')));
      await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
      await page.getByRole('button', { name: /Alex de teste/ }).click();
      let dialog = page.getByRole('dialog', { name: 'Gerenciar conta', exact: true });
      await dialog.waitFor();
      assert.equal(await page.getByRole('dialog').count(), 1);
      await dialog.getByRole('switch', { name: 'Papel interno', exact: true }).click();
      await dialog.getByRole('button', { name: 'Cargo na Ludora: Suporte', exact: true }).click();
      await dialog.getByRole('menuitemradio', { name: 'Desenvolvedor', exact: true }).click();
      await dialog.getByRole('button', { name: 'Cargo na Ludora: Desenvolvedor', exact: true }).waitFor();
      await dialog.getByRole('switch', { name: 'Papel interno', exact: true }).click();
      await dialog.getByRole('button', { name: 'Vincular a um clube', exact: true }).click();
      let clubDialog = page.getByRole('dialog', { name: 'Vincular a um clube', exact: true });
      assert.equal(await page.getByRole('dialog').count(), 1, 'Editor de clube substitui o gerenciamento, sem modais sobrepostos');
      await clubDialog.getByRole('radio', { name: 'Santos', exact: true }).check();
      await clubDialog.getByRole('button', { name: 'Cargo no clube: Técnico', exact: true }).click();
      await clubDialog.getByRole('menuitemradio', { name: 'Olheiro', exact: true }).click();
      assert.equal(await clubDialog.getByRole('switch', { name: 'Todas as categorias', exact: true }).count(), 0, 'Cargo de consulta não oferece controle de escopo gerencial');
      await clubDialog.getByRole('button', { name: 'Cargo no clube: Olheiro', exact: true }).click();
      await clubDialog.getByRole('menuitemradio', { name: 'Técnico', exact: true }).click();
      await clubDialog.getByRole('switch', { name: 'Todas as categorias', exact: true }).click();
      assert.equal(await clubDialog.getByRole('button', { name: 'Salvar vínculo', exact: true }).isDisabled(), true, 'Exige pelo menos um SUB quando o acesso é restrito');
      await clubDialog.getByRole('switch', { name: 'Todas as categorias', exact: true }).click();
      await clubDialog.screenshot({ path: path.join(output, `vincular-clube-${scenario.width}.png`) });
      await clubDialog.getByRole('button', { name: 'Voltar', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Gerenciar conta', exact: true });
      assert.equal(await page.evaluate(() => window.__writes.some(w => w.route.includes('/membros'))), false, 'Cancelar vínculo não grava alterações');
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

      await page.evaluate(() => { window.__failWrite = false; });
      const contasTab = page.getByRole('tab', { name: 'Contas e acessos', exact: true });
      await contasTab.focus();
      await contasTab.press('End');
      assert.equal(await tab.evaluate(el => el === document.activeElement), true, 'End move o foco para a última aba');
      await tab.press('Home');
      assert.equal(await contasTab.evaluate(el => el === document.activeElement), true, 'Home retorna à primeira aba');
      await contasTab.press('ArrowRight');
      assert.equal(await tab.getAttribute('aria-selected'), 'false', 'Mover foco não troca os dados antes da confirmação');
      await tab.press('Enter');
      assert.equal(await tab.getAttribute('aria-selected'), 'true', 'Enter seleciona a aba');
      assert.equal(await page.getByRole('tabpanel').getAttribute('aria-labelledby'), await tab.getAttribute('id'), 'Painel identifica a aba selecionada');
      await page.getByRole('group', { name: 'Clubes com pendências', exact: true }).waitFor();
      assert.equal(await page.getByRole('radio', { name: 'Ocian', exact: true }).count(), 0, 'Clube completo não aparece por ter tarefa antiga');
      await page.getByRole('radio', { name: 'Santos', exact: true }).check();
      await page.getByRole('button', { name: 'Dado pendente: Escolha o dado a atualizar', exact: true }).click();
      await page.getByRole('menuitemradio', { name: 'Escudo do clube', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Revisar aviso', exact: true }).isDisabled(), true, 'Exige um destinatário');
      await page.getByRole('checkbox', { name: 'Responsável pelo cadastro', exact: true }).check();
      await page.mouse.move(5,5);
      await page.waitForTimeout(200);
      if (scenario.theme === 'dark') {
        assert.equal(await page.locator('.registration-missing > li').first().evaluate(el=>getComputedStyle(el).backgroundColor), 'rgb(20, 23, 31)', 'Pendências reutilizam #14171F');
        assert.equal(await page.locator('.registration-recipients label').first().evaluate(el=>getComputedStyle(el).backgroundColor), 'rgb(20, 23, 31)', 'Destinatários reutilizam #14171F');
      }
      await page.screenshot({ path: path.join(output, `cadastro-formulario-${scenario.width}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Revisar aviso', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Revisar aviso', exact: true });
      await dialog.getByText('Complete o cadastro de Santos. Falta informar o escudo.', { exact: true }).waitFor();
      await dialog.getByRole('button', { name: 'Enviar aviso', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Dispensar tarefa', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Dispensar tarefa', exact: true });
      assert.equal(await dialog.getByRole('textbox').count(), 0, 'Justificativa livre só existe em Outro');
      const alturaFechado = (await dialog.boundingBox()).height;
      await dialog.getByRole('button', { name: 'Motivo da dispensa: Selecione o motivo', exact: true }).click();
      if (scenario.height >= 700) {
        assert.ok((await dialog.boundingBox()).height > alturaFechado + 100, 'Modal cresce para acomodar o seletor aberto');
        const menu = await dialog.getByRole('menu').boundingBox();
        const corpo = await dialog.locator('.modal-body').boundingBox();
        assert.ok(menu.y + menu.height <= corpo.y + corpo.height + 1, 'Opções ficam dentro da área visível do modal');
      }
      await dialog.screenshot({ path: path.join(output, `cadastro-motivos-aberto-${scenario.width}.png`) });
      await dialog.getByRole('menuitemradio', { name: 'Outro', exact: true }).click();
      await dialog.getByRole('textbox', { name: 'Descreva o motivo', exact: true }).fill('Curto');
      assert.equal(await dialog.getByRole('button', { name: 'Confirmar dispensa', exact: true }).isDisabled(), true);
      await dialog.getByRole('button', { name: 'Motivo da dispensa: Outro', exact: true }).click();
      await dialog.getByRole('menuitemradio', { name: 'Aviso registrado por engano', exact: true }).click();
      assert.equal(await dialog.getByRole('textbox').count(), 0);
      await dialog.screenshot({ path: path.join(output, `cadastro-dispensa-${scenario.width}.png`) });
      await dialog.getByRole('button', { name: 'Confirmar dispensa', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      await page.getByText('Este aviso de cadastro foi registrado por engano.', { exact: true }).waitFor();
      const cadastroWrites = await page.evaluate(() => window.__writes.filter(w => w.route.includes('/cadastro-pendente')));
      assert.equal(cadastroWrites.length, 2, 'Envio e dispensa geram somente uma gravação cada');
      assert.equal(cadastroWrites[1].body.motivo, 'Este aviso de cadastro foi registrado por engano.');
      await page.getByRole('button', { name: 'Atualizar', exact: true }).waitFor();
      await page.screenshot({ path: path.join(output, `cadastro-pendencias-${scenario.width}.png`), fullPage: true });
      await page.evaluate(() => { window.__cadastroCompleto = true; });
      await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
      await page.getByRole('heading', { name: 'Nenhum clube possui pendências', exact: true }).waitFor();
      assert.equal(await page.locator('.desktop-registration').getByRole('radio').count(), 0, 'Cadastro completo limpa a seleção e a lista');
      await page.screenshot({ path: path.join(output, `cadastro-vazio-${scenario.width}.png`), fullPage: true });

      await testarChamados(page, base, scenario);

      await page.goto(base + 'manutencao');
      await page.getByRole('heading', {name:'Nenhuma pausa ativa',exact:true}).waitFor();
      assert.equal(await page.locator('.desktop-state-plain').evaluate(el=>getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', 'Estado vazio sem card');
      await page.getByRole('button', { name: 'Nova pausa', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Pausar uma função', exact: true });
      await dialog.getByRole('button', {name:'Função: Selecione a função a pausar',exact:true}).click();
      await dialog.getByRole('menuitemradio', {name:'Criação de partidas',exact:true}).click();
      await dialog.getByRole('button', {name:'Alcance: Selecione o alcance',exact:true}).click();
      await dialog.getByRole('menuitemradio', {name:'Toda a plataforma',exact:true}).click();
      await dialog.getByRole('button', {name:'Motivo público da pausa: Selecione o motivo',exact:true}).click();
      for (const [label,tone] of [['Dados em conferência','review'],['Correção em andamento','fix'],['Instabilidade na operação','failure'],['Outro','other']]) {
        assert.equal(await dialog.getByRole('menuitemradio', {name:label,exact:true}).locator(`.maintenance-reason-icon[data-tone="${tone}"]`).count(), 1, `${label}: ícone específico`);
      }
      await dialog.screenshot({path:path.join(output,`pausa-motivos-${scenario.width}.png`)});
      await dialog.getByRole('menuitemradio', {name:'Correção em andamento',exact:true}).click();
      await dialog.screenshot({path:path.join(output,`pausa-formulario-${scenario.width}.png`)});
      await dialog.getByRole('button', { name: 'Revisar impacto', exact: true }).click();
      await dialog.getByText(/Novas operações desta função serão bloqueadas/).waitFor();
      await page.screenshot({ path: path.join(output, `pausa-${scenario.width}.png`) });
      await page.evaluate(() => { window.__failWrite = true; });
      await dialog.getByRole('button', { name: 'Confirmar pausa', exact: true }).click();
      await dialog.getByRole('alert').waitFor();
      await dialog.getByRole('button', { name: 'Voltar', exact: true }).click();
      assert.equal(await dialog.getByRole('button', {name:'Motivo público da pausa: Correção em andamento',exact:true}).count(), 1, 'Falha preserva o motivo escolhido');
      await page.evaluate(() => { window.__failWrite = false; });
      await dialog.getByRole('button', { name: 'Revisar impacto', exact: true }).click();
      await dialog.getByRole('button', { name: 'Confirmar pausa', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Reativar função', exact: true }).waitFor();

      const pausaEscrita = await page.evaluate(()=>window.__writes.filter(w=>w.route === '/admin/equipe/manutencao').at(-1));
      assert.equal(pausaEscrita.body.escopo, 'GLOBAL'); assert.equal(pausaEscrita.body.alvoId, 0);
      assert.ok(Date.parse(pausaEscrita.body.revisarEm) > Date.now());
      await page.getByRole('button', {name:/^Histórico da intervenção/}).click();
      await page.getByText('Função pausada', {exact:true}).waitFor();
      const reasonIcon = page.locator('.maintenance-card-header .maintenance-reason-icon');
      assert.equal(await reasonIcon.getAttribute('data-tone'), 'fix', 'Card herda o motivo da pausa');
      assert.equal(await reasonIcon.evaluate(el=>getComputedStyle(el).color), 'rgb(14, 120, 255)', 'Correção usa primary sem colorir o texto do card');
      await page.screenshot({path:path.join(output,`manutencao-ativa-${scenario.width}.png`),fullPage:true});
      await page.getByRole('button', {name:'Filtrar pausas',exact:true}).click();
      dialog = page.getByRole('dialog', {name:'Filtrar pausas',exact:true});
      await dialog.getByRole('button', {name:'Revisão: Todos os prazos',exact:true}).click();
      await dialog.getByRole('menuitemradio', {name:'Revisão atrasada',exact:true}).click();
      await dialog.getByRole('button', {name:'Aplicar filtros',exact:true}).click();
      await page.getByRole('heading', {name:'Nenhuma pausa ativa',exact:true}).waitFor();
      await page.getByRole('button', {name:'Limpar filtros',exact:true}).click();
      await page.getByRole('button', {name:'Reativar função',exact:true}).click();
      dialog = page.getByRole('dialog', {name:'Reativar função',exact:true});
      await dialog.getByRole('button', {name:'Motivo da reativação: Selecione o motivo',exact:true}).click();
      for (const [label,tone] of [['Correção validada pela equipe','success'],['Dados conferidos','checked'],['Serviço disponível novamente','success']]) {
        assert.equal(await dialog.getByRole('menuitemradio', {name:label,exact:true}).locator(`.maintenance-reason-icon[data-tone="${tone}"]`).count(), 1);
      }
      await dialog.getByRole('menuitemradio', {name:'Outro',exact:true}).click();
      await dialog.getByRole('textbox', {name:'Descreva o motivo',exact:true}).fill('Curto');
      assert.equal(await dialog.getByRole('button', {name:'Revisar impacto',exact:true}).isEnabled(), false);
      await dialog.getByRole('textbox', {name:'Descreva o motivo',exact:true}).fill('Correção conferida e validada pela equipe.');
      await dialog.getByRole('button', {name:'Revisar impacto',exact:true}).click();
      await dialog.getByRole('button', {name:'Confirmar reativação',exact:true}).click();
      await dialog.waitFor({state:'detached'});
      await page.getByRole('tab', {name:/^Encerradas/}).waitFor();
      assert.equal(await page.getByRole('tab', {name:/^Encerradas/}).getAttribute('aria-selected'), 'true');
      assert.equal(await page.getByRole('button', {name:'Reativar função',exact:true}).count(), 0);
      await page.getByRole('button', {name:/^Histórico da intervenção/}).click();
      await page.getByText('Função reativada', {exact:true}).waitFor();
      await page.screenshot({path:path.join(output,`manutencao-encerrada-${scenario.width}.png`),fullPage:true});
      await page.getByRole('button', {name:'Nova pausa',exact:true}).click();
      dialog = page.getByRole('dialog', {name:'Pausar uma função',exact:true});
      await dialog.getByRole('button', {name:'Função: Selecione a função a pausar',exact:true}).click();
      await dialog.getByRole('menuitemradio', {name:'Criação de partidas',exact:true}).click();
      await dialog.getByRole('button', {name:'Alcance: Selecione o alcance',exact:true}).click();
      await dialog.getByRole('menuitemradio', {name:'Um clube',exact:true}).click();
      await dialog.getByRole('radio', {name:'Santos',exact:true}).check();
      await dialog.getByRole('button', {name:'Motivo público da pausa: Selecione o motivo',exact:true}).click();
      await dialog.getByRole('menuitemradio', {name:'Dados em conferência',exact:true}).click();
      await dialog.screenshot({path:path.join(output,`pausa-clube-${scenario.width}.png`)});
      await dialog.getByRole('button', {name:'Revisar impacto',exact:true}).click();
      await dialog.getByText('Santos', {exact:true}).waitFor();
      await dialog.getByRole('button', {name:'Voltar',exact:true}).click();
      await dialog.getByRole('button', {name:'Cancelar',exact:true}).click();

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
      const wrapToggle = page.getByRole('menuitemcheckbox', { name: 'Quebrar linhas longas', exact: true });
      await wrapToggle.click();
      assert.equal(await wrapToggle.getAttribute('aria-checked'), 'true');
      assert.equal(await consoleBox.evaluate(el => el.classList.contains('log-wrap')), true);
      await page.keyboard.press('Space');
      assert.equal(await wrapToggle.getAttribute('aria-checked'), 'false');
      assert.equal(await page.locator('[role="menuitemradio"][aria-checked="true"] .desktop-menu-radio').count(), 1);
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
      assert.equal(await logMenu.locator('[aria-checked="true"] .desktop-menu-radio').count(), 1);
      await logMenu.getByRole('menuitemradio', { name: 'Só erros', exact: true }).click();
      assert.equal(await page.locator('.log-linha').count(), 0);
      await page.getByRole('button', { name: /^Nível dos logs:/ }).click();
      await page.getByRole('menuitemradio', { name: 'Todos os logs', exact: true }).click();
      const beforePeriod = await page.locator('.desktop-log-viewer').boundingBox();
      await page.getByRole('button', { name: /^Período dos logs:/ }).click();
      logMenu = page.getByRole('menu', { name: /^Período dos logs:/ });
      assert.equal(await logMenu.getByRole('menuitemradio').count(), 8);
      assert.equal(await logMenu.locator('[aria-checked="true"] .desktop-menu-radio').count(), 1);
      assert.equal(await logMenu.getByText(/Custom|Personalizado/).count(), 0);
      assert.deepEqual(await page.locator('.desktop-log-viewer').boundingBox(), beforePeriod, 'O menu abre sobre o conteúdo sem deslocar o console');
      await page.screenshot({ path: path.join(output, `logs-periodos-${scenario.width}.png`) });
      await page.getByRole('menuitemradio', { name: 'Última hora', exact: true }).click();
      await page.getByRole('button', { name: 'Pausar', exact: true }).click();
      await page.getByRole('button', { name: /^Período dos logs:/ }).click();
      await page.getByRole('menuitemradio', { name: 'Ao vivo', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Pausar', exact: true }).count(), 1, 'Ao vivo retoma a atualização');
      await page.screenshot({ path: path.join(output, `logs-controles-${scenario.width}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Opções dos logs', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Mais filtros', exact: true }).click();
      let logsFilter = page.getByRole('dialog', { name: 'Filtrar logs', exact: true });
      await logsFilter.getByRole('combobox', { name: /^Método HTTP/ }).click();
      await logsFilter.getByRole('option', { name: 'POST', exact: true }).click();
      await logsFilter.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
      assert.equal(await page.locator('.log-linha').count(), 0);
      await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
      await page.getByRole('button', { name: 'Opções dos logs', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Mais filtros', exact: true }).click();
      logsFilter = page.getByRole('dialog', { name: 'Filtrar logs', exact: true });
      await logsFilter.getByRole('spinbutton', { name: 'Lenta a partir de (ms)', exact: true }).fill('10');
      await logsFilter.getByRole('checkbox', { name: 'Somente lentas', exact: true }).check();
      await logsFilter.getByRole('button', { name: 'Aplicar filtros', exact: true }).click();
      assert.equal(await page.locator('.duration-lenta').count(), 1000);
      assert.equal(await page.locator('.http-2').count(), 1000);
      await page.locator('button.log-linha').first().click();
      const detail = page.getByRole('dialog', { name: 'Detalhes do registro', exact: true });
      await detail.getByText('Duração informada pela API', { exact: true }).waitFor();
      await detail.getByRole('button', { name: 'Copiar registro', exact: true }).click();
      assert.deepEqual(await page.evaluate(() => window.__logExports.at(-1)), [1505]);
      await detail.getByRole('button', { name: /^Fechar/ }).click();
      await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
      await consoleBox.evaluate(el => { el.scrollTop = 200; });
      await page.waitForTimeout(100);
      const readingAnchor = await consoleBox.evaluate(el => {
        const top = el.getBoundingClientRect().top;
        const row = [...el.querySelectorAll('.log-msg')].find(row => row.getBoundingClientRect().top >= top);
        return { text: row.textContent, y: row.getBoundingClientRect().top };
      });
      await page.evaluate(() => window.__emitLogs(1506, 5));
      await page.getByRole('button', { name: /Novos registros/ }).waitFor();
      const afterAnchor = await consoleBox.locator('.log-msg').filter({ hasText: readingAnchor.text }).first().boundingBox();
      assert.ok(Math.abs(afterAnchor.y - readingAnchor.y) <= 1, 'Novos logs preservam a linha que estava sendo lida, inclusive ao inserir no topo');
      await page.getByRole('button', { name: /Novos registros/ }).click();
      assert.equal(await consoleBox.evaluate(el => el.scrollTop), 0);
      await page.screenshot({ path: path.join(output, `logs-cores-${scenario.width}.png`), fullPage: true });
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
