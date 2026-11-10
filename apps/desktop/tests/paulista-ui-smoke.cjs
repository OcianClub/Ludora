// UI compilada com IPC simulado. Nenhuma chamada à Federação ou ao banco real.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../out/renderer');
const output = path.resolve(__dirname, '../../../test-results/desktop-paulista-ui');
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.woff2':'font/woff2' };

function fixture({ theme }) {
  localStorage.setItem('ludora_tema', theme);
  window.__calls = []; window.__failRead = false;
  const noop = () => () => {};
  const stamp = '2026-11-10T12:00:00Z';
  const clubes = [{id:1,nome:'Ocian',escudo:null},{id:2,nome:'Santos',escudo:null}];
  const equipe = {id:1,nome:'Ocian oficial',escudo:null,vinculo:{clubeId:1,motivo:'Conferido',clube:clubes[0]},sugestoes:[]};
  const catalogo = ['ACOMPANHADO','REVISAR_IDENTIDADE','ERRO','DESCOBERTO','PAUSADO'].map((estado,i)=>({
    id:900+i,ano:2026,categoria:`sub-${7+i}`,divisao:'A2',acompanhado:i === 0,estado,
    tentativaEm:stamp,sucessoEm:stamp,proximaEm:null,erro:i === 2 ? 'Falha de consulta simulada' : null,
    jogos:23,versao:1,equipes:[{...equipe,id:i+1}],
  }));
  catalogo[1].equipes = [{id:20,nome:'Santos oficial',escudo:null,vinculo:null,sugestoes:[{id:2,nome:'Santos'}]}];
  catalogo[0].equipes.push({id:2,nome:'Santos oficial',escudo:null,vinculo:{clubeId:2,motivo:'Conferido',clube:clubes[1]},sugestoes:[]});
  catalogo[3].equipes = [];
  catalogo[4].manutencao = {protocolo:'pausa-teste',motivo:'Conferência de dados',inicio:stamp};
  const recentes = [1,2,3,4].map(id=>({id,eventoId:900,criadoEm:stamp}));
  recentes.push({id:5,eventoId:901,criadoEm:'2026-11-09T12:00:00Z'});
  const fila = [{id:1,jogoId:'j1',tipo:'PLACAR',estado:'ABERTA',atualizadoEm:stamp,clubeIds:[1],jogo:{eventoId:900,mandante:'Ocian',visitante:'Santos',data:'2026-11-10',horario:'20:00'}}];
  window.ludora = {
    auth:{restaurar:async()=>({ok:true,persistente:true,usuario:{id:1,nome:'Admin de teste',email:'admin@example.test',papel_plataforma:'SUPERADMIN'}}),aoExpirar:noop,sair:async()=>{}},
    config:{obter:async()=>({apiUrl:'http://localhost:3000',apiUrlPadrao:'http://localhost:3000',versao:'0.0.1',plataforma:'win32',armazenamentoSeguro:true})},
    logs:{historico:async()=>({estado:'conectado',entradas:[]}),aoMudarEstado:noop},
    api:{requisicao:async(method,route,body)=>{
      window.__calls.push({method,route,body});
      await new Promise(resolve=>setTimeout(resolve,100));
      const pathname = new URL(route,'http://fixture').pathname;
      if (method !== 'GET') {
        if (pathname.endsWith('/acompanhamento')) catalogo[0].acompanhado = body.acompanhado;
        return {ok:true,status:200,data:{}};
      }
      if (window.__failRead) return {ok:false,status:503,data:{error:'Consulta indisponível no teste'}};
      if (pathname === '/admin/paulista') return {ok:true,status:200,data:{rotina:{descobertaEm:stamp,proximaEm:null,erro:null},catalogo,clubes,fila,recentes}};
      if (pathname.endsWith('/historico')) return {ok:true,status:200,data:[{id:1,acao:'SINCRONIZACAO',criadoEm:stamp,dados:{}}]};
      if (/\/eventos\/\d+$/.test(pathname)) return {ok:true,status:200,data:{
        snapshot:{equipes:[equipe,{id:2,nome:'Santos',escudo:null}],jogos:[{id:'j1',mandanteId:1,visitanteId:2}]},
        vinculos:[{equipeId:1,clubeId:1,nome:'Ocian',escudo:null}],
        pendencias:pathname.endsWith('/901') ? [] : [{id:1,jogoId:'j1',tipo:'PLACAR',estado:'ABERTA',dados:{oficial:[3,1],local:[2,1]}}],
      }};
      throw Error(`Fixture ausente: ${route}`);
    }},
  };
}

async function main() {
  fs.mkdirSync(output,{recursive:true});
  const server = http.createServer((req,res)=>{
    const file = path.resolve(root,'.'+new URL(req.url,'http://fixture').pathname.replace(/\/$/,'/index.html'));
    if (!file.startsWith(root+path.sep)) return res.writeHead(403).end();
    fs.readFile(file,(error,data)=>{res.writeHead(error?404:200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream'});res.end(error?'Not found':data);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    for (const scenario of [{width:1440,height:900,theme:'dark'},{width:900,height:700,theme:'light'},{width:640,height:480,theme:'dark'}]) {
      const context = await browser.newContext({viewport:scenario});
      const page = await context.newPage(); page.setDefaultTimeout(10000);
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(fixture,scenario);
      await page.goto(`http://127.0.0.1:${server.address().port}/#/paulista`);
      const title = page.getByRole('heading',{name:'Campeonato Paulista',exact:true});
      await title.waitFor();
      await page.getByRole('button',{name:'Atualizar painel',exact:true}).waitFor();
      assert.equal(await page.getByRole('tab').count(),6);
      await page.getByRole('tab',{name:/^Atualização com falha/}).click();
      assert.equal(await page.getByRole('tab',{name:/^Atualização com falha/}).getAttribute('aria-selected'),'true');
      await page.getByRole('tab',{name:/^Todos/}).click();
      const search = page.getByRole('searchbox',{name:'Buscar campeonatos',exact:true});
      const calls = await page.evaluate(()=>window.__calls.length);
      await search.fill('inexistente');
      await page.getByRole('heading',{name:'Nenhum clube encontrado',exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>window.__calls.length),calls,'Busca local não faz novas consultas');
      await search.fill('');
      assert.equal(await page.locator('.paulista-recent-tile').count(),2,'Atualizações repetidas ficam agrupadas por evento');
      await page.locator('.paulista-recent-tile').getByText(/4 alterações/).waitFor();
      await page.getByRole('button',{name:'Mais filtros',exact:true}).click();
      let dialog = page.getByRole('dialog',{name:'Filtrar campeonatos',exact:true});
      await dialog.getByRole('button',{name:'Ano: Todos',exact:true}).click();
      assert.equal(await dialog.locator('[aria-checked="true"] .desktop-menu-radio').count(),1);
      await dialog.getByRole('menuitemradio',{name:'2026',exact:true}).click();
      await dialog.getByRole('button',{name:'Aplicar filtros',exact:true}).click();
      assert.equal(await page.locator('[aria-label="Filtros ativos"] button').count(),1);
      await page.locator('[aria-label="Filtros ativos"] button').click();
      const club = page.locator('.paulista-club-card').filter({has:page.locator('.paulista-club-heading strong',{hasText:'Ocian'})}).first();
      await club.locator('.desktop-accordion-heading > button').click();
      await club.getByRole('button',{name:/^Paulista 2026 · A2 · sub-7/}).waitFor();
      assert.equal(await club.locator('.paulista-event-group').count(),1,'Ano e divisão aparecem uma vez por grupo');
      assert.equal(await club.locator('.paulista-event-tile').count(),3);
      assert.equal(await club.locator('.paulista-event-tile.platform-club-card').count(),3,'SUBs reutilizam o card da Visão global');
      await club.locator('.paulista-event-groups').screenshot({path:path.join(output,`subs-${scenario.width}-${scenario.theme}.png`)});
      await page.locator('.paulista-recent-section').screenshot({path:path.join(output,`recentes-${scenario.width}-${scenario.theme}.png`)});
      const sidebar = page.getByRole('button',{name:'Recolher navegação',exact:true});
      if (await sidebar.count()) { await sidebar.click(); await page.getByRole('button',{name:'Expandir navegação',exact:true}).click(); }
      assert.equal(await page.locator('.admin-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'Catálogo cabe com sidebar');
      await title.scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(output,`catalogo-${scenario.width}-${scenario.theme}.png`)});
      await club.getByRole('button',{name:/^Paulista 2026 · A2 · sub-7/}).click();
      await page.getByRole('heading',{name:'Sincronização',exact:true}).waitFor();
      await page.getByRole('heading',{name:'Vínculos dos clubes',exact:true}).waitFor();
      await page.getByRole('heading',{name:'Conferência do calendário',exact:true}).waitFor();
      assert.equal(await page.locator('.paulista-detail-alerts > h2 .icon').count(),1,'Cabeçalho usa ícone de calendário');
      await page.getByRole('button',{name:'Opções do vínculo de Ocian',exact:true}).click();
      await page.getByRole('menuitem',{name:'Desfazer vínculo',exact:true}).click();
      dialog=page.getByRole('dialog',{name:'Desfazer vínculo confirmado',exact:true});
      assert.equal(await dialog.getByRole('button',{name:'Registrar decisão',exact:true}).isDisabled(),true,'Desvincular exige conferência');
      await dialog.getByRole('button',{name:'Voltar',exact:true}).click();
      const follow = page.getByRole('switch',{name:'Acompanhamento automático',exact:true});
      assert.equal(await follow.getAttribute('aria-checked'),'true');
      await follow.click();
      dialog = page.getByRole('dialog',{name:'Desligar acompanhamento automático',exact:true});
      assert.equal(await follow.getAttribute('aria-checked'),'true','Abrir revisão não altera acompanhamento');
      await dialog.getByRole('button',{name:'Motivo: Edição encerrada',exact:true}).click();
      await dialog.getByRole('menuitemradio',{name:'Outro',exact:true}).click();
      await dialog.getByRole('textbox',{name:'Descreva o motivo',exact:true}).fill('Motivo de teste, sem gravação real.');
      await dialog.getByRole('button',{name:'Confirmar',exact:true}).click();
      await page.waitForFunction(()=>window.__calls.some(c=>c.method==='POST' && c.route.endsWith('/acompanhamento')));
      await page.waitForFunction(()=>document.querySelector('[role="switch"][aria-label="Acompanhamento automático"]')?.getAttribute('aria-checked')==='false');
      const write = await page.evaluate(()=>window.__calls.find(c=>c.method==='POST'));
      assert.deepEqual(write.body,{acompanhado:false,motivo:'Motivo de teste, sem gravação real.',confirmacao:'CONFIRMAR_IDENTIDADE'});
      const divergence = page.locator('.paulista-divergencia');
      await divergence.getByRole('button',{name:/^Placar divergente/}).click();
      await page.getByRole('table',{name:'Comparação da divergência',exact:true}).waitFor();
      await divergence.getByText(/Calendário conferido/).waitFor();
      await divergence.getByRole('button',{name:'Manter dado oficial',exact:true}).click();
      dialog=page.getByRole('dialog',{name:'Registrar conferência do dado oficial',exact:true});
      await dialog.getByRole('button',{name:'Voltar',exact:true}).click();
      await page.getByRole('status',{name:'Carregando detalhes do evento',exact:true}).waitFor({state:'detached'});
      await page.getByRole('table',{name:'Comparação da divergência',exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.method!=='GET').length),1,'Cancelar conferência não grava dados');
      assert.equal(await page.locator('.admin-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'Detalhes cabem na janela');
      await page.locator('.paulista-identity-grid').screenshot({path:path.join(output,`identidades-${scenario.width}-${scenario.theme}.png`)});
      await divergence.screenshot({path:path.join(output,`divergencia-${scenario.width}-${scenario.theme}.png`)});
      await page.locator('#main-content').evaluate(el=>el.scrollTo({top:0}));
      await page.waitForFunction(()=>document.getElementById('main-content').scrollTop===0);
      await page.screenshot({path:path.join(output,`evento-${scenario.width}-${scenario.theme}.png`)});
      await page.getByRole('button',{name:'Voltar a Ocian',exact:true}).click();
      await page.evaluate(()=>window.__failRead=true);
      await page.getByRole('button',{name:'Atualizar painel',exact:true}).click();
      await page.getByRole('heading',{name:'Não foi possível carregar a integração',exact:true}).waitFor();
      assert.ok(await page.locator('.paulista-club-card').count()>0,'Falha na atualização preserva catálogo');
      await page.goto(`http://127.0.0.1:${server.address().port}/#/paulista?evento=901&clube=2`);
      await page.reload();
      await page.getByText('Nenhuma divergência registrada',{exact:true}).waitFor();
      await page.getByRole('button',{name:'Confirmar Santos',exact:true}).click();
      dialog=page.getByRole('dialog',{name:'Confirmar Santos oficial como Santos',exact:true});
      await dialog.getByRole('textbox',{name:'Motivo da decisão',exact:true}).fill('Identidade conferida na fonte oficial.');
      assert.equal(await dialog.getByRole('button',{name:'Registrar decisão',exact:true}).isDisabled(),true,'Confirmar identidade exige aceite explícito');
      await dialog.getByRole('button',{name:'Voltar',exact:true}).click();
      await page.locator('.paulista-detail-workspace').screenshot({path:path.join(output,`evento-sem-alertas-${scenario.width}-${scenario.theme}.png`)});
      assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.method!=='GET').length),0,'Cancelar vínculo preserva dados');
      await page.goto(`http://127.0.0.1:${server.address().port}/#/paulista?evento=904&clube=1`);
      await page.getByRole('heading',{name:'Sincronização',exact:true}).waitFor();
      assert.equal(await page.getByRole('button',{name:'Consultar Federação agora',exact:true}).isDisabled(),true,'Manutenção continua bloqueando consultas');
      assert.deepEqual(errors,[]);
      console.log(`PASS Paulista: filtros, clubes, detalhes, confirmação, falha parcial e layout ${scenario.width} ${scenario.theme}`);
      await context.close();
    }
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
