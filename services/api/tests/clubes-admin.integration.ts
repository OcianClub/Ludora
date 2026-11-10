// Executar explicitamente. Recusa qualquer banco fora do PostgreSQL local de testes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { simularProvedor } from './suporte-operacoes.integration';

async function main() {
  const config=JSON.parse(fs.readFileSync(path.resolve('../../.local-demo/equipe/config.json'),'utf8'));
  const url=new URL(config.databaseUrl);
  assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55448');assert.equal(url.pathname,'/ludora_equipe');
  Object.assign(process.env,{DATABASE_URL:url.href,DIRECT_URL:url.href,JWT_SECRET:config.jwtSecret,NODE_ENV:'test',SUPERADMIN_EMAILS:'',
    PAULISTA_ENABLED:'false',PAULISTA_SYNC_DIARIA:'false',ATUALIZACAO_TEMPORADA:'false',PYTHON_AI_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',GOOGLE_PLACES_API_KEY:'',
    RESEND_API_KEY:'test-only',EMAIL_FROM:'noreply@equipe.example.test',INVITE_BASE_URL:'http://localhost/convite/token'});
  const migration=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy'],{env:process.env,encoding:'utf8'});
  assert.equal(migration.status,0,migration.stderr);
  const emails=simularProvedor();
  const {prisma}=await import('../src/lib/prisma.js');
  const {JWT_SECRET,JWT_OPTIONS}=await import('../src/config/env.js');
  const jwt=(await import('jsonwebtoken')).default;
  const {criarApp}=await import('../src/app.js');
  const {criarSocketServer}=await import('../src/realtime/socket.js');
  const io=criarSocketServer();const server=criarApp(io).listen(0,'127.0.0.1');io.attach(server);
  await new Promise<void>(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const tag=randomUUID().slice(0,8);const users:number[]=[],clubs:number[]=[],timesTeste:number[]=[],jogosTeste:number[]=[];
  let eventoTeste:number|null=null,equipeTeste:number|null=null;
  async function user(nome:string,papel:'SUPERADMIN'|'USUARIO'|'SUPORTE'='USUARIO') {
    const u=await prisma.usuario.create({data:{nome,email:`${tag}-${users.length}@equipe.example.test`,senha:'hash-inutilizavel-no-teste',papel_plataforma:papel}});
    users.push(u.id);return {...u,token:jwt.sign({id:u.id,versao_sessao:u.versao_sessao},JWT_SECRET,JWT_OPTIONS)};
  }
  try {
    const admin=await user('Operador','SUPERADMIN'),support=await user('Suporte','SUPORTE'),ordinary=await user('Gestor de clube');
    const club=await prisma.clube.create({data:{nome:`Auditoria ${tag}`}});clubs.push(club.id);
    const other=await prisma.clube.create({data:{nome:`Outro ${tag}`}});clubs.push(other.id);
    await prisma.usuarioClube.create({data:{usuario_id:ordinary.id,clube_id:club.id,papel:'ADMIN'}});
    const linked=await user('Ja vinculado'),candidate=await user('Disponivel'),suspended=await user('Suspenso');
    await prisma.usuario.update({where:{id:suspended.id},data:{suspenso:true}});
    await prisma.usuarioClube.create({data:{usuario_id:linked.id,clube_id:club.id,papel:'TORCEDOR'}});
    await prisma.usuarioClube.create({data:{usuario_id:candidate.id,clube_id:other.id,papel:'ADMIN'}});
    for(let i=0;i<23;i++)await user(`Paginado ${String(i).padStart(2,'0')}`);
    async function req(p:string,method='GET',body?:unknown,token:string|null=admin.token,clube?:number) {
      const res=await fetch(base+p,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{ }),...(clube?{'x-clube-id':String(clube)}:{})},body:body===undefined?undefined:JSON.stringify(body)});
      return {status:res.status,data:await res.json().catch(()=>null) as any,headers:res.headers};
    }
    const b=`/admin/clubes/${club.id}`;
    assert.equal((await req(`${b}/resumo`)).data.id,club.id);
    assert.equal((await req('/admin/clubes/2147483647/resumo')).status,404);
    const baseCnpj=String(Date.now()).slice(-12);
    const digit=(parte:string)=>{const soma=[...parte].reduce((n,d,i)=>n+Number(d)*(2+(parte.length-1-i)%8),0);return soma%11<2?'0':String(11-soma%11);};
    const cnpj13=baseCnpj+digit(baseCnpj),cnpj=cnpj13+digit(cnpj13);
    const createdClub=await req('/admin/clubes','POST',{nome:`Novo ${tag}`,cnpj,endereco:{cep:'01001000',logradouro:'Praça da Sé',numero:'1',bairro:'Sé',cidade:'São Paulo',estado:'SP'},subs:[7,12],admin_email:ordinary.email});
    assert.equal(createdClub.status,201);clubs.push(createdClub.data.id);
    assert.equal((await req(`/admin/clubes/${createdClub.data.id}/membros`)).data.categorias.length,2);
    assert.equal((await req(`/admin/clubes/${createdClub.data.id}`,'PATCH',{nome:`Atualizado ${tag}`})).status,200);
    assert.equal((await req(`/admin/clubes/${createdClub.data.id}/resumo`)).data.nome,`Atualizado ${tag}`);
    assert.equal((await req(`/admin/clubes/${createdClub.data.id}`,'PATCH',{cnpj:'123'})).status,400);
    for(const token of [null,support.token,ordinary.token]) {
      for(const [p,method,body] of [[`${b}/pessoas-disponiveis`,'GET',undefined],[`${b}/membros/${candidate.id}`,'POST',{papel:'TORCEDOR'}],[`${b}/convites/test/codigo`,'GET',undefined],[`${b}/convites/test/reenviar`,'POST',{}]] as const)
        assert.equal((await req(p,method,body,token)).status,token?403:401);
    }
    let cursor:number|null=null;const found:number[]=[];
    do {
      const r=await req(`${b}/pessoas-disponiveis?busca=${tag}&limite=5${cursor?`&cursor=${cursor}`:''}`);
      // A busca por email inclui a tag de todos os usuários criados nesta execução.
      assert.equal(r.status,200);found.push(...r.data.pessoas.map((p:any)=>p.id));cursor=r.data.proximo;
    } while(cursor);
    assert.ok(found.includes(candidate.id));assert.ok(!found.includes(linked.id));assert.ok(!found.includes(ordinary.id));assert.ok(!found.includes(suspended.id));assert.equal(new Set(found).size,found.length);
    assert.equal((await req(`${b}/pessoas-disponiveis?cursor=errado`)).status,400);
    assert.deepEqual((await req(`${b}/pessoas-disponiveis?busca=indisponivel-${tag}`)).data.pessoas,[]);
    const entry={papel:'TECNICO',acesso_todas_categorias:true,categoria_ids:[]};
    const race=await Promise.all([req(`${b}/membros/${candidate.id}`,'POST',entry),req(`${b}/membros/${candidate.id}`,'POST',entry)]);
    assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
    assert.equal(await prisma.usuarioClube.count({where:{usuario_id:candidate.id,clube_id:club.id}}),1);
    assert.equal((await req(`${b}/membros/${candidate.id}`,'POST',{papel:'ADMIN'})).status,409);
    assert.equal((await prisma.usuarioClube.findUniqueOrThrow({where:{usuario_id_clube_id:{usuario_id:candidate.id,clube_id:club.id}}})).papel,'TECNICO');
    assert.equal((await req(`${b}/membros/${ordinary.id}`,'DELETE')).status,409,'Último administrador protegido');
    const cat=await req(`${b}/categorias`,'POST',{idade:7});assert.equal(cat.status,201);
    const cats=(await req(`${b}/membros`)).data.categorias;const category=cats.find((c:any)=>c.faixaIdade===7);
    assert.ok(category);assert.equal((await req(`${b}/categorias/${category.id}`,'PATCH',{ativa:false})).status,200);
    assert.equal((await req(`${b}/categorias/${category.id}`,'PATCH',{ativa:true})).status,200);
    const foreign=await prisma.categoria.create({data:{clube_id:other.id,nome:'sub-8',tipo:'INICIACAO',faixaIdade:8}});
    assert.equal((await req(`${b}/categorias/${foreign.id}`,'DELETE')).status,404);
    assert.equal((await req(`${b}/membros/${candidate.id}`,'PUT',{papel:'MESARIO',categoria_ids:[foreign.id]})).status,400);
    const member=await prisma.usuarioClube.findUniqueOrThrow({where:{usuario_id_clube_id:{usuario_id:candidate.id,clube_id:club.id}}});
    await prisma.usuarioClubeCategoria.create({data:{usuario_clube_id:member.id,categoria_id:category.id}});
    assert.equal((await req(`${b}/categorias/${category.id}`,'DELETE')).status,409,'Categoria com vínculo não é removida');
    await prisma.usuarioClubeCategoria.deleteMany({where:{usuario_clube_id:member.id}});
    assert.equal((await req(`${b}/categorias/${category.id}`,'DELETE')).status,200);
    console.log('PASS associação: autorização, pesquisa paginada sem vínculos, suspensão, concorrência, último administrador e categorias isoladas.');
    const catsOrigem=await Promise.all([7,12].map(idade=>prisma.categoria.create({data:{clube_id:club.id,nome:`sub-${idade}`,tipo:idade<=10?'INICIACAO':'BASE',faixaIdade:idade}})));
    const nomeGrupo=`Aurora ${tag}`;
    async function timeTeste(nome:string,categoriaId:number,extra:Record<string,unknown>={}) {
      const t=await prisma.time.create({data:{nome,categoria_id:categoriaId,...extra}});timesTeste.push(t.id);return t;
    }
    const aurora7=await timeTeste(`${nomeGrupo} sub-7`,catsOrigem[0].id);
    const aurora12=await timeTeste(`${nomeGrupo} sub-12`,catsOrigem[1].id);
    const copia=await timeTeste(nomeGrupo,foreign.id);
    const adversario=await timeTeste(`Estrela ${tag}`,foreign.id);
    const protegido=await timeTeste(`Oficial ${tag}`,foreign.id);
    const ocupado=await timeTeste(`Vinculado ${tag}`,foreign.id,{clube_representado_id:other.id});
    await timeTeste(`Arquivado ${tag}`,foreign.id,{arquivado:true});
    const eid=-(Date.now()%1000000000);
    await prisma.fpfsEvento.create({data:{id:eid,ano:2026,titulo:'Teste isolado',divisao:'A2',categoria:'sub-8',payload:{},hash:tag}});eventoTeste=eid;
    await prisma.fpfsEquipe.create({data:{id:eid,nome:`Oficial ${tag}`}});equipeTeste=eid;
    await prisma.fpfsTime.create({data:{eventoId:eid,equipeId:eid,timeId:protegido.id}});
    const jogo=await prisma.partida.create({data:{mandante_id:aurora7.id,visitante_id:adversario.id,categoria_id:catsOrigem[0].id,data:new Date('2026-10-01'),horario:'10:00',status:'FINALIZADA',gols_mandante:2,gols_visitante:1}});jogosTeste.push(jogo.id);
    const listaAgrupada=await req(`/admin/clubes/cascas?agrupar=clube&nome=${tag}&limite=1`);
    assert.equal(listaAgrupada.status,200);assert.equal(listaAgrupada.data.grupos.length,1);assert.ok(listaAgrupada.data.proximo);
    const pagina2=await req(`/admin/clubes/cascas?agrupar=clube&nome=${tag}&limite=1&cursor=${listaAgrupada.data.proximo}`);
    assert.equal(pagina2.status,200);assert.notEqual(pagina2.data.grupos[0].id,listaAgrupada.data.grupos[0].id);
    const grupo=(await req(`/admin/clubes/cascas?agrupar=clube&nome=Aurora%20${tag}`)).data.grupos;
    assert.equal(grupo.length,1);assert.deepEqual(grupo[0].subs,[7,8,12]);assert.equal(grupo[0].registros,3);
    assert.equal((await req(`/admin/clubes/cascas?agrupar=clube&nome=Aurora%20${tag}%20sub-7`)).data.grupos.length,1,'Busca legada com sufixo encontra o clube');
    const previa=(await req(`/admin/clubes/cascas/${aurora7.id}/previa?agrupar=clube`)).data;
    assert.equal(previa.time.nome,nomeGrupo);assert.equal(previa.times.length,3);assert.equal(previa.jogos[0].id,jogo.id);
    assert.equal((await req(`/admin/clubes/cascas/${protegido.id}/previa?agrupar=clube`)).status,404);
    assert.equal((await req(`/admin/clubes/cascas/${ocupado.id}/previa?agrupar=clube`)).status,404);
    assert.ok(Array.isArray((await req(`/admin/clubes/cascas?nome=Aurora%20${tag}`)).data),'Contrato sem agrupamento preservado');
    const listaCompleta=(await req(`/admin/clubes/cascas?agrupar=clube&nome=${tag}`)).data.grupos;
    assert.equal(listaCompleta.some((g:any)=>/Oficial|Vinculado|Arquivado/.test(g.nome)),false);
    const cnpjBase=(BigInt(baseCnpj)+1n).toString().padStart(12,'0'),cp13=cnpjBase+digit(cnpjBase);
    const cadastroGrupo={nome:nomeGrupo,cnpj:cp13+digit(cp13),endereco:{cep:'01001000',logradouro:'Praça da Sé',numero:'1',bairro:'Sé',cidade:'São Paulo',estado:'SP'},subs:[7],casca_id:aurora7.id,casca_ids:[aurora7.id],casca_agrupada:true};
    assert.equal((await req('/admin/clubes','POST',{...cadastroGrupo,casca_ids:[aurora7.id,adversario.id]})).status,409,'Outro nome não pode ser injetado no grupo');
    assert.equal((await req('/admin/clubes','POST',{...cadastroGrupo,casca_ids:[aurora7.id,protegido.id]})).status,409,'Identidade oficial não é alterada pelo agrupamento local');
    assert.equal((await req('/admin/clubes','POST',{...cadastroGrupo,casca_ids:[aurora7.id,aurora12.id]})).status,400,'SUB não selecionado é rejeitado');
    const reaproveitado=await req('/admin/clubes','POST',cadastroGrupo);assert.equal(reaproveitado.status,201);clubs.push(reaproveitado.data.id);
    assert.equal((await prisma.time.findUniqueOrThrow({where:{id:aurora7.id}})).clube_representado_id,reaproveitado.data.id);
    assert.equal((await prisma.time.findUniqueOrThrow({where:{id:aurora12.id}})).clube_representado_id,null);
    assert.equal((await prisma.time.findUniqueOrThrow({where:{id:copia.id}})).clube_representado_id,null);
    assert.equal((await prisma.partida.findUniqueOrThrow({where:{id:jogo.id}})).gols_mandante,2,'Histórico e placar preservados');
    assert.deepEqual((await req(`/admin/clubes/${reaproveitado.data.id}/membros`)).data.categorias.map((c:any)=>c.faixaIdade),[7]);
    const proxBase=(BigInt(baseCnpj)+2n).toString().padStart(12,'0'),prox13=proxBase+digit(proxBase);
    assert.equal((await req('/admin/clubes','POST',{...cadastroGrupo,nome:`Concorrente ${tag}`,cnpj:prox13+digit(prox13)})).status,409,'Seleção antiga não pode transferir um time já vinculado');
    console.log('PASS reaproveitamento: clube único, SUBs entre origens, paginação, seleção parcial, contrato legado, isolamento oficial, histórico e vínculo concorrente.');
    const created=await req(`${b}/convites`,'POST',{email:`dest-${tag}@equipe.example.test`,papel:'ADMIN',entrega:'email'});
    assert.equal(created.status,201);assert.equal(created.data.email_enviado,true);assert.equal(emails.length,1);
    const id=created.data.convite.id;let code=created.data.codigo;
    const stored=await prisma.conviteClube.findUniqueOrThrow({where:{id}});
    assert.ok(stored.codigo_cifrado);assert.ok(!stored.codigo_cifrado.includes(code));
    const list=await req(`${b}/convites`);assert.equal(list.status,200);assert.ok(!JSON.stringify(list.data).includes(code));assert.ok(!JSON.stringify(list.data).includes('codigo_cifrado'));assert.equal(list.data.convites[0].codigo_disponivel,true);
    const read=await req(`${b}/convites/${id}/codigo`);assert.equal(read.status,200);assert.equal(read.data.codigo,code);assert.equal(read.headers.get('cache-control'),'no-store');
    await prisma.clube.update({where:{id:club.id},data:{ativo:false}});
    assert.equal((await req(`${b}/convites/${id}/codigo`)).status,423);
    assert.equal((await req(`${b}/convites/${id}/reenviar`,'POST',{email:`inactive-${tag}@equipe.example.test`})).status,423);
    await prisma.clube.update({where:{id:club.id},data:{ativo:true}});
    assert.equal((await req(`/admin/clubes/${other.id}/convites/${id}/codigo`)).status,404);
    assert.equal((await req(`/convites/codigo/${code}`)).status,200,'Consulta pública preservada');
    const resend=await req(`${b}/convites/${id}/reenviar`,'POST');assert.equal(resend.status,200);assert.notEqual(resend.data.codigo,code);assert.equal(emails.length,2);
    assert.equal((await req(`/convites/codigo/${code}`)).status,404);code=resend.data.codigo;
    assert.equal((await req(`${b}/convites/${id}/codigo`)).data.codigo,code);
    await prisma.conviteClube.update({where:{id},data:{expira_em:new Date(Date.now()-1000)}});
    assert.equal((await req(`${b}/convites/${id}/codigo`)).status,410);
    assert.equal((await req(`${b}/convites`)).data.convites[0].situacao,'EXPIRADO');
    assert.equal((await req(`${b}/convites?status=PENDENTE`)).data.convites.length,0);
    assert.equal((await req(`${b}/convites/${id}/reenviar`,'POST')).status,200,'Expirado pode ser reenviado');
    assert.equal((await req(`${b}/convites/${id}/revogar`,'POST')).status,200);
    assert.equal((await req(`${b}/convites/${id}/codigo`)).status,410);
    assert.equal((await req(`${b}/convites/${id}/reenviar`,'POST')).status,200,'Revogado pode ser renovado conforme contrato existente');
    await prisma.conviteClube.update({where:{id},data:{status:'ACEITO'}});
    assert.equal((await req(`${b}/convites/${id}/codigo`)).status,410);assert.equal((await req(`${b}/convites/${id}/reenviar`,'POST')).status,409);
    const open=await req(`${b}/convites`,'POST',{email:'',entrega:'codigo',papel:'ADMIN'});assert.equal(open.status,201);
    assert.equal((await req(`${b}/convites/${open.data.convite.id}/reenviar`,'POST',{email:`bucket-${tag}@equipe.example.test`})).status,400);
    await prisma.conviteClube.update({where:{id:open.data.convite.id},data:{codigo_cifrado:null}});
    assert.equal((await req(`${b}/convites/${open.data.convite.id}/codigo`)).status,409,'Convite antigo não é alterado para recuperar código');
    assert.equal((await req(`${b}/convites`,'POST',{email:'inválido',entrega:'email',papel:'ADMIN'})).status,400);
    const firstPage=await req(`${b}/convites?limite=1`);assert.equal(firstPage.data.convites.length,1);assert.ok(firstPage.data.proximo);
    const secondPage=await req(`${b}/convites?limite=1&cursor=${firstPage.data.proximo}`);assert.equal(secondPage.status,200);assert.equal(secondPage.data.convites.length,1);assert.notEqual(firstPage.data.convites[0].id,secondPage.data.convites[0].id);
    const {logs}=await import('../src/modules/admin/superadmin.js');
    assert.ok(!JSON.stringify(logs.snapshot(500)).includes(code),'Código não aparece nos logs');
    console.log('PASS convites: criação/envio simulado, consulta sem cache, cifra, isolamento, código público, rotação, expiração, revogação, aceite e legado.');
  } finally {
    await prisma.partida.deleteMany({where:{id:{in:jogosTeste}}});
    if(eventoTeste!==null)await prisma.fpfsTime.deleteMany({where:{eventoId:eventoTeste}});
    if(eventoTeste!==null)await prisma.fpfsEvento.delete({where:{id:eventoTeste}});
    if(equipeTeste!==null)await prisma.fpfsEquipe.delete({where:{id:equipeTeste}});
    await prisma.auditoriaVinculoTime.deleteMany({where:{time_id:{in:timesTeste}}});
    await prisma.time.deleteMany({where:{id:{in:timesTeste}}});
    await prisma.conviteClube.deleteMany({where:{clube_id:{in:clubs}}});
    await prisma.usuarioClube.deleteMany({where:{clube_id:{in:clubs}}});
    await prisma.categoria.deleteMany({where:{clube_id:{in:clubs}}});
    await prisma.clube.deleteMany({where:{id:{in:clubs}}});
    await prisma.usuario.deleteMany({where:{id:{in:users}}});
    await new Promise<void>(r=>io.close(()=>r()));await prisma.$disconnect();
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
