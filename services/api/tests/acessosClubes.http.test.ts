import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'node:net';
import { prisma } from '../src/lib/prisma';
import { JWT_SECRET, JWT_OPTIONS } from '../src/config/env';
import members from '../src/modules/clubes/membros.routes';
import links from '../src/modules/clubes/vinculo-time.routes';
import { exigirGestorDoClube, exigirPartidaDoClube } from '../src/middlewares/permissoes.middleware';

// HTTP, assinatura JWT e middleware reais; somente a persistência é substituída.
// Não conecta ao Supabase e não altera contas existentes.
test('autorização HTTP de cargos, categorias e vínculos reversíveis', async t => {
  let role = 'ADMIN', managed = 1, self = false, outside = false, validCategories = 1;
  let transactionRole = 'ADMIN', previous: number | null = null;
  const writes: any[] = [], audits: any[] = [];
  // Delegates Prisma são proxies; MockTracker.method não encontra o descritor.
  function replace(target:any, key:string, value:any) { const before=target[key];target[key]=value;t.after(()=>{target[key]=before;}); }
  replace(prisma.usuario, 'findUnique', async () => ({versao_sessao:0}));
  replace(prisma.usuarioClube, 'findUnique', async () => ({id:1, usuario_id:1, clube_id:2, papel:role, acesso_todas_categorias:role==='ADMIN', categorias:[{categoria_id:9}]}));
  replace(prisma.partida, 'findUnique', async () => ({categoria_id:10,categoria:{clube_id:3}}));
  const tx = {
    usuarioClube: {
      findUnique: async () => ({papel:transactionRole}),
      findFirst: async () => outside ? null : ({id:5,usuario_id:self?1:5}),
      count: async () => managed,
      update: async (args:any) => { writes.push(args); },
    },
    categoria: { count:async () => validCategories },
    usuarioClubeCategoria: { deleteMany:async () => {} },
    time: {
      findMany: async () => outside ? [] : [{id:20,clube_representado_id:previous}],
      update: async (args:any) => { writes.push(args); previous=args.data.clube_representado_id; },
    },
    auditoriaVinculoTime: {create:async (args:any) => {audits.push(args.data);}},
  };
  replace(prisma, '$transaction', async (fn:any) => fn(tx));
  const app = express(); app.use(express.json(),members,links);
  app.patch('/partidas/:id', exigirGestorDoClube, exigirPartidaDoClube(req=>Number(req.params.id)), (_req,res)=>{res.json({ok:true});});
  const server=app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const token=jwt.sign({id:1,versao_sessao:0},JWT_SECRET,JWT_OPTIONS);
  async function patch(path:string, body:unknown, auth=true) {
    return fetch(base+path,{method:'PATCH',headers:{'Content-Type':'application/json','x-clube-id':'2',...(auth?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
  }
  try {
    await t.test('sem token: 401; visitante, olheiro e técnico não concedem cargos',async()=>{
      assert.equal((await patch('/membros/5',{papel:'ADMIN'},false)).status,401);
      for(const r of ['TORCEDOR','OLHEIRO','TECNICO']) {role=r;assert.equal((await patch('/membros/5',{papel:'ADMIN'})).status,403);}
      assert.equal(writes.length,0);role='ADMIN';
    });
    await t.test('admin não altera membro de outro clube, a si mesmo ou categoria externa',async()=>{
      outside=true;assert.equal((await patch('/membros/5',{papel:'TECNICO',categoria_ids:[9]})).status,409);outside=false;
      self=true;assert.equal((await patch('/membros/5',{papel:'TECNICO',categoria_ids:[9]})).status,409);self=false;
      validCategories=0;assert.equal((await patch('/membros/5',{papel:'TECNICO',categoria_ids:[99]})).status,409);validCategories=1;
      assert.equal(writes.length,0);
    });
    await t.test('papel é revalidado dentro da transação; atualização válida grava escopo',async()=>{
      transactionRole='TORCEDOR';assert.equal((await patch('/membros/5',{papel:'TECNICO',categoria_ids:[9]})).status,409);
      transactionRole='ADMIN';assert.equal((await patch('/membros/5',{papel:'TECNICO',categoria_ids:[9]})).status,200);
      assert.deepEqual(writes.pop().data,{papel:'TECNICO',acesso_todas_categorias:false,categorias:{create:[{categoria_id:9}]}});
    });
    await t.test('visitante e olheiro não escrevem partidas; admin não edita partida do adversário',async()=>{
      for(const r of ['TORCEDOR','OLHEIRO','ADMIN']) {role=r;assert.equal((await patch('/partidas/91',{})).status,403);}
      role='ADMIN';
    });
    await t.test('vincular exige administrar os dois clubes e rejeita times fora do escopo',async()=>{
      const body={time_ids:[20],clube_id:3,motivo:'Correção de identidade'};
      managed=0;assert.equal((await patch('/times/vinculo',body)).status,409);managed=1;
      outside=true;assert.equal((await patch('/times/vinculo',body)).status,409);outside=false;
      assert.equal(writes.length,0);assert.equal(audits.length,0);
      assert.equal((await patch('/times/vinculo',{...body,time_ids:[20,20]})).status,400);
    });
    await t.test('vincular/desvincular preserva ID do time e grava antes/depois com autor',async()=>{
      assert.equal((await patch('/times/vinculo',{time_ids:[20],clube_id:3,motivo:'Clube confirmado'})).status,200);
      assert.deepEqual(writes[0],{where:{id:20},data:{clube_representado_id:3}});
      assert.equal((await patch('/times/vinculo',{time_ids:[20],clube_id:null,motivo:'Vínculo incorreto'})).status,200);
      assert.deepEqual(writes[1],{where:{id:20},data:{clube_representado_id:null}});
      assert.deepEqual(audits.map(a=>[a.clube_anterior_id,a.clube_novo_id,a.usuario_id]),[[null,3,1],[3,null,1]]);
    });
  } finally { await new Promise<void>(resolve=>server.close(()=>resolve())); }
});
