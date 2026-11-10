// UI com IPC simulado: nenhum cadastro, convite ou permissão é gravado no banco real.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname,'../out/renderer');
const output = path.resolve(__dirname,'../../../test-results/desktop-clubes-ui');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'};
function fixture({theme}) {
  localStorage.setItem('ludora_tema',theme);
  window.__calls=[]; window.__failCreate=false;
  window.__clipboard='';Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__clipboard=text;}}});
  const noop=()=>()=>{};
  const club={id:1,nome:'Ocian',escudo:null,cidade:'Praia Grande',estado:'SP',ativo:true,plano:'DEMO',membros:2,jogadores:2,categorias:2,partidas:5,competicoes:1,cnpj:'11222333000181',endereco:{cep:'01001000',logradouro:'Praça da Sé',numero:'100',complemento:'',bairro:'Sé',cidade:'São Paulo',estado:'SP'}};
  const clubs=[club];
  const categories=[{id:11,nome:'sub-7',tipo:'INICIACAO',ativa:true,faixaIdade:7},{id:12,nome:'sub-12',tipo:'BASE',ativa:true,faixaIdade:12}];
  const members=[{usuario:{id:1,nome:'Administrador',email:'admin@example.test'},papel:'ADMIN',acesso_todas_categorias:true,categorias:[]},
    {usuario:{id:3,nome:'Técnico de teste',email:'tecnico@example.test'},papel:'TECNICO',acesso_todas_categorias:false,categorias:[{categoria_id:11}]}];
  const invites=[{id:'i1',email:'convidado@example.test',papel:'ADMIN',situacao:'PENDENTE',expira_em:'2100-12-10T12:00:00Z',codigo_disponivel:true},{id:'i2',email:'aceito@example.test',papel:'TECNICO',situacao:'ACEITO',expira_em:'2100-12-10T12:00:00Z'}];
  let code='ABCD-2345';
  const shellRows=[{id:901,nome:'Aurora FC sub-7',categoria:{nome:'sub-7',faixaIdade:7,clube_id:1,clube:{nome:'Ocian'}}},
    {id:902,nome:'Aurora FC sub-12',categoria:{nome:'sub-12',faixaIdade:12,clube_id:1,clube:{nome:'Ocian'}}},
    {id:903,nome:'Aurora FC',categoria:{nome:'sub-8',faixaIdade:8,clube_id:3,clube:{nome:'Santos'}}}];
  window.ludora={
    auth:{restaurar:async()=>({ok:true,persistente:true,usuario:{id:Number(localStorage.getItem('__test_user')||1),nome:'Admin',email:'admin@example.test',papel_plataforma:'SUPERADMIN'}}),aoExpirar:noop,sair:async()=>{}},
    config:{obter:async()=>({apiUrl:localStorage.getItem('__test_api')||'http://localhost:3000',apiUrlPadrao:'http://localhost:3000',versao:'0.0.1',plataforma:'win32',armazenamentoSeguro:true})},
    logs:{historico:async()=>({estado:'conectado',entradas:[]}),aoMudarEstado:noop,aoReceber:noop},
    api:{requisicao:async(method,route,body)=>{
      window.__calls.push({method,route,body});
      await new Promise(r=>setTimeout(r,40));
      const url=new URL(route,'http://fixture'); const p=url.pathname;
      if(method==='POST' && p==='/admin/clubes') {
        if(window.__failCreate) return {ok:false,status:409,data:{error:'CNPJ já cadastrado no teste'}};
        const created={...club,id:2,nome:body.nome}; clubs.push(created); return {ok:true,status:201,data:created};
      }
      if(method==='POST' && /\/membros\/99$/.test(p)) {
        if(window.__duplicatePerson)return {ok:false,status:409,data:{error:'Esta pessoa já possui vínculo com o clube.'}};
        members.push({usuario:{id:99,nome:'Pessoa disponível',email:'pessoa@example.test'},papel:body.papel,acesso_todas_categorias:body.acesso_todas_categorias,categorias:[]});
      }
      if(method==='POST' && p.endsWith('/convites')) {
        if(window.__inviteFail)return {ok:false,status:503,data:{error:'Falha simulada no envio'}};
        const convite={id:'i3',email:body.email,papel:'ADMIN',situacao:'PENDENTE',expira_em:'2100-12-10T12:00:00Z',codigo_disponivel:true};invites.push(convite);
        return {ok:true,status:201,data:{convite,codigo:code,email_enviado:true}};
      }
      if(method==='POST' && p.endsWith('/reenviar')) {code='WXYZ-6789';return {ok:true,status:200,data:{convite:invites[0],codigo:code,email_enviado:true}};}
      if(method==='POST' && p.endsWith('/revogar')) {invites[0].situacao='REVOGADO';return {ok:true,status:200,data:{ok:true}};}
      if(method!=='GET') return {ok:true,status:200,data:{ok:true}};
      let data;
      if(p==='/admin/clubes/cascas') data={grupos:[{...shellRows[0],nome:'Aurora FC',subs:[7,8,12],registros:3,origens:['Ocian','Santos']}],proximo:null};
      else if(p==='/admin/clubes/cascas/901/previa') data={time:{...shellRows[0],nome:'Aurora FC'},times:shellRows,jogos:[],subs:[7,8,12],agrupada:true};
      else if(p==='/admin/overview') data={totais:{clubes:clubs.length,usuarios:2,jogadores:2,partidas:5,partidasAoVivo:0},conexoes:{principal:1,admin:1},clubes:clubs};
      else if(p.endsWith('/resumo')) data=clubs.find(c=>c.id===Number(p.split('/')[3]));
      else if(p.endsWith('/membros')) data={membros:members,categorias:categories};
      else if(p.endsWith('/convites')) data={convites:invites};
      else if(p.endsWith('/codigo')) data={codigo:code,expira_em:'2100-12-10T12:00:00Z'};
      else if(p.endsWith('/pessoas-disponiveis')) {
        if(window.__personFail)return {ok:false,status:503,data:{error:'Falha simulada na consulta'}};
        data=url.searchParams.has('cursor')?{pessoas:members.some(m=>m.usuario.id===99)?[]:[{id:99,nome:'Pessoa disponível',email:'pessoa@example.test'}],proximo:null}:{pessoas:[{id:98,nome:'Outra pessoa',email:'outra@example.test'}],proximo:98};
      }
      else if(p.endsWith('/jogadores')) data=[{id:7,nome:'Jogador de teste',numCamisa:7,posicao:'Ala',dtNasc:'2019-04-10',categoria_id:11,ativo:true,foto:null}];
      else if(p.startsWith('/admin/cep/')) data={logradouro:'Praça da Sé',bairro:'Sé',cidade:'São Paulo',estado:'SP'};
      else if(p==='/admin/paulista/candidatos') data=[{eventoId:900,equipeId:20,nome:'Clube sugerido',escudo:null,categoria:'sub-7',divisao:'A2',ano:2026,partidas:4,timeId:null}];
      else if(p.endsWith('/atividade')) data=[];
      else throw Error(`Fixture ausente: ${method} ${route}`);
      return {ok:true,status:200,data};
    }},
  };
}
async function main(){
  fs.mkdirSync(output,{recursive:true});
  const server=http.createServer((req,res)=>{
    const file=path.resolve(root,'.'+new URL(req.url,'http://fixture').pathname.replace(/\/$/,'/index.html'));
    if(!file.startsWith(root+path.sep)) return res.writeHead(403).end();
    fs.readFile(file,(error,data)=>{res.writeHead(error?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(error?'Not found':data);});
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const base=`http://127.0.0.1:${server.address().port}/#/`;
  try {for(const scenario of [{width:1440,height:900,theme:'dark'},{width:900,height:700,theme:'light'},{width:640,height:480,theme:'dark'}]){
    const context=await browser.newContext({viewport:scenario,reducedMotion:'reduce'});
    const page=await context.newPage();page.setDefaultTimeout(10000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(fixture,scenario);
    await page.goto(base+'clubes?busca=Ocian');
    await page.locator('.platform-club-card').waitFor();
    await page.getByRole('button',{name:'Novo clube',exact:true}).click();
    let modal=page.getByRole('dialog',{name:'Novo clube',exact:true});
    await modal.getByRole('button',{name:'Reaproveitar time existente',exact:true}).click();
    let picker=page.getByRole('dialog',{name:'Reaproveitar time existente',exact:true});
    await picker.getByRole('button',{name:/Aurora FC/}).waitFor();
    assert.equal(await picker.locator('.club-shell-grid > button').count(),1,'Um único clube apesar de três cadastros por SUB/origem');
    await picker.getByRole('button',{name:/Aurora FC/}).click();
    picker=page.getByRole('dialog',{name:'Confirmar time existente',exact:true});
    await picker.getByRole('button',{name:'SUB-7',exact:true}).click();
    await picker.getByRole('button',{name:'SUB-8',exact:true}).click();
    await picker.getByRole('button',{name:'SUB-12',exact:true}).click();
    assert.equal(await picker.getByRole('button',{name:'Confirmar vínculo',exact:true}).isDisabled(),true);
    await picker.getByRole('button',{name:'SUB-12',exact:true}).click();
    await picker.getByText('Conferir cadastros de origem (3)',{exact:true}).click();
    assert.equal(await picker.getByRole('checkbox').count(),3);
    assert.equal(await picker.getByRole('checkbox').nth(0).isChecked(),false);
    assert.equal(await picker.getByRole('checkbox').nth(0).isDisabled(),true);
    await picker.getByRole('checkbox').nth(1).uncheck();
    assert.equal(await picker.getByRole('button',{name:'Confirmar vínculo',exact:true}).isDisabled(),true);
    await picker.getByRole('checkbox').nth(1).check();
    await page.screenshot({path:path.join(output,`reaproveitar-${scenario.width}.png`)});
    await picker.getByRole('button',{name:'Confirmar vínculo',exact:true}).click();
    assert.equal(await modal.getByLabel('Nome do clube',{exact:true}).inputValue(),'Aurora FC');
    await modal.getByLabel('Nome do clube',{exact:true}).fill('Clube em rascunho');
    await page.keyboard.press('Escape');
    await modal.waitFor({state:'detached'});
    await page.getByRole('button',{name:'Retomar cadastro',exact:true}).waitFor();
    await page.reload();
    await page.getByRole('button',{name:'Retomar cadastro',exact:true}).click();
    modal=page.getByRole('dialog',{name:'Novo clube',exact:true});
    assert.equal(await modal.getByLabel('Nome do clube',{exact:true}).inputValue(),'Clube em rascunho');
    await modal.getByLabel('CNPJ',{exact:true}).fill('11222333000181');
    await modal.getByLabel('CEP',{exact:true}).fill('01001000');
    await modal.getByText(/Endereço localizado\. Confira/).waitFor();
    await modal.getByLabel('Número',{exact:true}).fill('100');
    await modal.getByRole('button',{name:'Continuar',exact:true}).click();
    await modal.getByLabel('E-mail do primeiro administrador (opcional)',{exact:true}).fill('primeiro@example.test');
    await modal.getByRole('button',{name:'Plano: Teste (TRIAL)',exact:true}).click();
    await modal.getByRole('menuitemradio',{name:'Pago (PRO)',exact:true}).click();
    await modal.getByRole('button',{name:'Revisar após cadastro',exact:true}).click();
    assert.equal(await modal.getByRole('button',{name:'Revisar após cadastro',exact:true}).getAttribute('aria-pressed'),'true');
    await modal.getByLabel('E-mail do primeiro administrador (opcional)',{exact:true}).waitFor();
    await page.keyboard.press('Escape');
    await page.reload();
    await page.getByRole('button',{name:'Retomar cadastro',exact:true}).click();
    modal=page.getByRole('dialog',{name:'Novo clube',exact:true});
    await modal.getByRole('button',{name:'Revisar após cadastro',exact:true}).waitFor();
    assert.equal(await modal.getByRole('button',{name:'Revisar após cadastro',exact:true}).getAttribute('aria-pressed'),'true','Sugestão de vínculo preservada no rascunho');
    await modal.getByRole('button',{name:'Revisar após cadastro',exact:true}).click();
    await modal.getByRole('button',{name:'Revisar cadastro',exact:true}).click();
    await modal.getByRole('button',{name:'Etapa 1: Identidade',exact:true}).click();
    await modal.getByLabel('Nome do clube',{exact:true}).fill('Clube revisado');
    await modal.getByLabel('CNPJ',{exact:true}).fill('');
    await modal.getByRole('button',{name:'Etapa 3: Revisão',exact:true}).click();
    await modal.getByText('Informe nome, CNPJ e o endereço completo da sede.',{exact:true}).waitFor();
    await modal.getByLabel('CNPJ',{exact:true}).fill('11222333000181');
    await modal.getByRole('button',{name:'Etapa 3: Revisão',exact:true}).click();
    await modal.getByText('Clube revisado',{exact:true}).waitFor();
    await modal.getByRole('button',{name:'Fechar janela',exact:true}).click();
    await page.reload();
    await page.getByRole('button',{name:'Retomar cadastro',exact:true}).click();
    modal=page.getByRole('dialog',{name:'Novo clube',exact:true});
    await modal.getByRole('button',{name:'Confirmar e criar',exact:true}).waitFor();
    await modal.getByText('primeiro@example.test',{exact:true}).waitFor();
    await page.screenshot({path:path.join(output,`cadastro-${scenario.width}.png`)});
    await page.evaluate(()=>window.__failCreate=true);
    await modal.getByRole('button',{name:'Confirmar e criar',exact:true}).click();
    await modal.getByText('CNPJ já cadastrado no teste',{exact:true}).waitFor();
    assert.ok(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('ludora:clube:rascunho:'))),'Erro de criação preserva rascunho');
    await page.evaluate(()=>window.__failCreate=false);
    await modal.getByRole('button',{name:'Confirmar e criar',exact:true}).click();
    await page.getByRole('heading',{name:'Clube revisado',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('ludora:clube:rascunho:')).length),0,'Sucesso limpa o rascunho');
    const payload=await page.evaluate(()=>window.__calls.filter(c=>c.method==='POST' && c.route==='/admin/clubes').at(-1).body);
    assert.equal(payload.plano,'PRO');assert.equal(payload.admin_email,'primeiro@example.test');assert.equal(payload.nome,'Clube revisado');
    assert.deepEqual(payload.subs,[12]);assert.deepEqual(payload.casca_ids,[902]);assert.equal(payload.casca_id,902);assert.equal(payload.casca_agrupada,true,'SUBs escolhidos persistem no rascunho e no envio');
    assert.equal(await page.evaluate(()=>{const i=window.__calls.findIndex(c=>c.method==='POST'&&c.route==='/admin/clubes');return window.__calls.slice(i+1).some(c=>c.route==='/admin/overview');}),false,'Ficha não refaz consulta global da plataforma');
    const chip=page.locator('.club-plan-tag');const originalSize=await chip.boundingBox();
    await page.getByRole('button',{name:'Editar clube',exact:true}).click();
    const editedSize=await chip.boundingBox();assert.equal(originalSize.width,editedSize.width);assert.equal(originalSize.height,editedSize.height);
    await page.getByRole('button',{name:'Cancelar edição',exact:true}).click();
    await page.screenshot({path:path.join(output,`operacao-${scenario.width}.png`)});
    await page.getByRole('tab',{name:/^Acessos/}).click();
    const table=page.getByRole('table',{name:'Pessoas e permissões',exact:true});
    await table.waitFor();
    assert.equal(await table.evaluate(el=>!!el.closest('.card')),false,'Tabela de acessos fica fora de card');
    assert.equal(await table.locator('.desktop-role-badge').count(),2);
    await page.screenshot({path:path.join(output,`acessos-${scenario.width}.png`)});
    await table.getByRole('row').filter({hasText:'tecnico@example.test'}).getByRole('button',{name:'Alterar',exact:true}).click();
    let access=page.getByRole('dialog',{name:'Permissão · Técnico de teste',exact:true});
    await access.getByRole('button',{name:'Cargo no clube: Técnico',exact:true}).click();
    await access.getByRole('menuitemradio',{name:'Mesário',exact:true}).click();
    await access.getByRole('switch',{name:'Acesso a todas as categorias',exact:true}).click();
    await access.getByRole('button',{name:'Salvar',exact:true}).click();
    await access.waitFor({state:'detached'});
    const permission=await page.evaluate(()=>window.__calls.find(c=>c.method==='PUT'));
    assert.deepEqual(permission.body,{papel:'MESARIO',acesso_todas_categorias:true,categoria_ids:[11]});
    await page.evaluate(()=>window.__personFail=true);
    await page.getByRole('button',{name:'Adicionar pessoa',exact:true}).click();
    const people=page.getByRole('dialog',{name:'Adicionar pessoa ao clube',exact:true});
    await people.getByText('Falha simulada na consulta',{exact:true}).waitFor();
    await page.evaluate(()=>window.__personFail=false);
    await people.getByRole('button',{name:'Tentar novamente',exact:true}).click();
    await people.getByRole('button',{name:'Carregar mais pessoas',exact:true}).click();
    await people.locator('.user-identity').filter({hasText:'pessoa@example.test'}).getByRole('button',{name:'Escolher',exact:true}).click();
    access=page.getByRole('dialog',{name:'Permissão · Pessoa disponível',exact:true});
    await page.evaluate(()=>window.__duplicatePerson=true);
    await access.getByRole('button',{name:'Salvar',exact:true}).click();
    await access.getByRole('alert').getByText('Esta pessoa já possui vínculo com o clube.',{exact:true}).waitFor();
    await page.evaluate(()=>window.__duplicatePerson=false);
    await access.getByRole('button',{name:'Salvar',exact:true}).click();
    await access.waitFor({state:'detached'});
    await table.getByText('pessoa@example.test',{exact:true}).waitFor();
    await page.getByRole('tab',{name:'Estrutura',exact:true}).click();
    await page.getByRole('table',{name:'Tabela de jogadores',exact:true}).waitFor();
    assert.equal(await page.locator('.desktop-club-roster-table.desktop-data-table').count(),1);
    await page.getByRole('button',{name:'Desativar categoria',exact:true}).click();
    const catDialog=page.getByRole('dialog',{name:'Desativar SUB-7?',exact:true});
    assert.equal(await catDialog.getByRole('button',{name:'Confirmar',exact:true}).isDisabled(),true);
    await catDialog.getByRole('checkbox').check();assert.equal(await catDialog.getByRole('button',{name:'Confirmar',exact:true}).isEnabled(),true);
    await catDialog.getByRole('button',{name:'Cancelar',exact:true}).click();
    await page.screenshot({path:path.join(output,`estrutura-${scenario.width}.png`)});
    await page.getByRole('tab',{name:'Convites',exact:true}).click();
    const invites=page.getByRole('table',{name:'Convites do clube',exact:true});await invites.waitFor();
    assert.equal(await invites.evaluate(el=>!!el.closest('.card')),false);
    assert.equal(await invites.locator('.desktop-role-badge').count(),2);
    await invites.getByRole('button',{name:'Ver código',exact:true}).click();
    let codeDialog=page.getByRole('dialog',{name:'Código do convite',exact:true});
    await codeDialog.getByText('ABCD-2345',{exact:true}).waitFor();
    await codeDialog.getByRole('button',{name:'Copiar código',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.__clipboard),'ABCD-2345');await page.keyboard.press('Escape');
    await invites.getByRole('button',{name:'Reenviar',exact:true}).click();
    await page.getByRole('dialog',{name:'Reenviar convite?',exact:true}).getByRole('button',{name:'Confirmar reenvio',exact:true}).click();
    codeDialog=page.getByRole('dialog',{name:'Código do convite',exact:true});await codeDialog.getByText('WXYZ-6789',{exact:true}).waitFor();await page.keyboard.press('Escape');
    await invites.getByRole('button',{name:'Revogar',exact:true}).click();
    await page.getByRole('dialog',{name:'Revogar convite?',exact:true}).getByRole('button',{name:'Voltar',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.route.endsWith('/revogar')).length),0,'Cancelar revogação não grava');
    await page.screenshot({path:path.join(output,`convites-${scenario.width}.png`)});
    await page.getByLabel('E-mail do administrador (obrigatório)',{exact:true}).fill('novo@example.test');
    await page.evaluate(()=>window.__inviteFail=true);
    await page.getByRole('button',{name:'Enviar convite',exact:true}).click();
    await page.getByText('Falha simulada no envio',{exact:true}).waitFor();
    assert.equal(await page.getByLabel('E-mail do administrador (obrigatório)',{exact:true}).inputValue(),'novo@example.test');
    await page.evaluate(()=>window.__inviteFail=false);
    const before=await page.evaluate(()=>window.__calls.filter(c=>c.method==='POST' && c.route.endsWith('/convites')).length);
    await page.locator('.club-invite-fields').evaluate(form=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
    await page.getByRole('dialog',{name:'Código do convite',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.method==='POST' && c.route.endsWith('/convites')).length),before+1);
    await page.keyboard.press('Escape');
    await invites.getByText('novo@example.test',{exact:true}).waitFor();
    await page.getByRole('tab',{name:'Atividade',exact:true}).click();await page.getByText('Nenhuma alteração recente',{exact:true}).waitFor();
    assert.equal(await page.locator('.admin-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
    await page.getByRole('link',{name:'Voltar para clubes',exact:true}).click();
    await page.getByRole('button',{name:'Novo clube',exact:true}).click();
    modal=page.getByRole('dialog',{name:'Novo clube',exact:true});
    await modal.getByLabel('Nome do clube',{exact:true}).fill('Descartar este rascunho');
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Descartar rascunho',exact:true}).click();
    await page.getByRole('dialog',{name:'Descartar rascunho?',exact:true}).getByRole('button',{name:'Descartar rascunho',exact:true}).click();
    assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('ludora:clube:rascunho:')).length),0);
    if(scenario.width===1440) {
      await page.getByRole('button',{name:'Novo clube',exact:true}).click();
      modal=page.getByRole('dialog',{name:'Novo clube',exact:true});
      await modal.getByLabel('Nome do clube',{exact:true}).fill('Rascunho da conta 1');
      await page.keyboard.press('Escape');
      await page.evaluate(()=>localStorage.setItem('__test_user','2'));
      await page.reload();
      await page.getByRole('button',{name:'Novo clube',exact:true}).click();
      modal=page.getByRole('dialog',{name:'Novo clube',exact:true});
      assert.equal(await modal.getByLabel('Nome do clube',{exact:true}).inputValue(),'','Outra conta não recebe o rascunho');
      await page.keyboard.press('Escape');
      await page.evaluate(()=>{localStorage.setItem('__test_user','1');localStorage.setItem('__test_api','https://api.example.test');});
      await page.reload();
      await page.getByRole('button',{name:'Novo clube',exact:true}).click();
      modal=page.getByRole('dialog',{name:'Novo clube',exact:true});
      assert.equal(await modal.getByLabel('Nome do clube',{exact:true}).inputValue(),'','Outro servidor não recebe o rascunho');
      await page.keyboard.press('Escape');
      await page.evaluate(()=>localStorage.removeItem('__test_api'));
      await page.reload();
      await page.getByRole('button',{name:'Retomar cadastro',exact:true}).click();
      modal=page.getByRole('dialog',{name:'Novo clube',exact:true});
      assert.equal(await modal.getByLabel('Nome do clube',{exact:true}).inputValue(),'Rascunho da conta 1');
      await page.keyboard.press('Escape');
      await page.getByRole('button',{name:'Descartar rascunho',exact:true}).click();
      await page.getByRole('dialog',{name:'Descartar rascunho?',exact:true}).getByRole('button',{name:'Descartar rascunho',exact:true}).click();
    }
    assert.deepEqual(errors,[]);
    console.log(`PASS Clubes: rascunho, reabertura, etapas, falha e sucesso de criação, acessos, estrutura e convites ${scenario.width} ${scenario.theme}`);
    await context.close();
  }}finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
