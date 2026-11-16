import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prisma } from '../src/lib/prisma';
import { criarSuporteRoutes } from '../src/modules/suporte/routes';
test('avisos de suporte: leitura persistente, dono, encerramento, remoção e novas respostas', async t => {
  const tickets = new Map([['one',{id:'one',usuarioId:7,status:'NOVO'}],['other',{id:'other',usuarioId:8,status:'NOVO'}]]);
  const history: any[] = [{id:10,chamadoId:'one',acao:'COMENTAR',publico:true}, {id:20,chamadoId:'other',acao:'COMENTAR',publico:true}, {id:30,chamadoId:'one',acao:'COMENTAR',publico:false}];
  let seq=100, conflict=false;
  const patch=(target:any,key:string,value:any)=>{const old=target[key];target[key]=value;t.after(()=>{target[key]=old;});};
  const matches=(h:any,w:any)=> (!w.chamadoId || typeof w.chamadoId==='string' ? !w.chamadoId || h.chamadoId===w.chamadoId : w.chamadoId.in.includes(h.chamadoId)) &&
    (!w.operadorId || h.operadorId===w.operadorId) && (!w.acao || (typeof w.acao==='string'?h.acao===w.acao:w.acao.in.includes(h.acao))) &&
    (w.publico===undefined || h.publico===w.publico) && (!w.id || h.id<=w.id.lte);
  patch(prisma.suporteChamado,'findFirst',async({where}:any)=>tickets.get(where.id)?.usuarioId===where.usuarioId?tickets.get(where.id):null);
  patch(prisma.suporteHistorico,'findMany',async({where,distinct}:any)=>{
    let items=history.filter(h=>matches(h,where)&&(!where.chamado || (tickets.get(h.chamadoId)?.usuarioId===where.chamado.usuarioId && tickets.get(h.chamadoId)?.status!=='RESOLVIDO'))).sort((a,b)=>b.id-a.id);
    if(distinct)items=items.filter((h,i)=>items.findIndex(v=>v.chamadoId===h.chamadoId)===i);return items;
  });
  patch(prisma.suporteHistorico,'findFirst',async({where}:any)=>history.filter(h=>matches(h,where)).sort((a,b)=>b.id-a.id)[0]||null);
  patch(prisma.suporteHistorico,'create',async({data}:any)=>{const saved={id:++seq,...data};history.push(saved);return saved;});
  patch(prisma,'$transaction',async(fn:any)=>{if(conflict){conflict=false;throw Object.assign(Error(),{code:'P2034'});}return fn(prisma);});
  const emissions:any[]=[];const router=criarSuporteRoutes({of:()=>({to:(room:string)=>({emit:(event:string)=>emissions.push({room,event})})})} as any);
  async function call(method:string,path:string,user=7,id='one',body:any={}){
    const layer=(router as any).stack.find((l:any)=>l.route?.path===path&&l.route.methods[method]);let status=200,result:any;
    const res={status(n:number){status=n;return res;},json(v:any){result=v;return res;}};
    await layer.route.stack.at(-1).handle({usuarioId:user,params:{id},body},res);return {status,result};
  }
  const pending=async()=> (await call('get','/suporte/avisos')).result.map((a:any)=>a.id);
  assert.deepEqual(await pending(),[10]);
  assert.equal((await call('patch','/suporte/:id/lido',8,'one',{respostaId:10})).status,404);
  assert.equal((await call('patch','/suporte/:id/lido',7,'one',{respostaId:0})).status,400);
  assert.equal((await call('patch','/suporte/:id/lido',7,'one',{respostaId:10})).status,200);
  assert.deepEqual(await pending(),[]);const count=history.length;
  await call('patch','/suporte/:id/lido',7,'one',{respostaId:10});assert.equal(history.length,count);
  assert.ok(emissions.every(e=>e.room==='usuario:7'&&e.event==='avisos_suporte_atualizados'));
  history.push({id:40,chamadoId:'one',acao:'COMENTAR',publico:true});assert.deepEqual(await pending(),[40]);
  await call('patch','/suporte/:id/lido',7,'one',{respostaId:10});assert.deepEqual(await pending(),[40],'opening an old answer cannot acknowledge a newer answer');
  conflict=true;assert.equal((await call('patch','/suporte/:id/lido',7,'one',{respostaId:40})).status,409);assert.deepEqual(await pending(),[40]);
  await call('patch','/suporte/:id/lido',7,'one',{respostaId:40});await call('patch','/suporte/:id/lido',7,'one',{respostaId:10});assert.deepEqual(await pending(),[]);
  history.push({id:50,chamadoId:'one',acao:'STATUS',publico:true});tickets.get('one')!.status='RESOLVIDO';assert.deepEqual(await pending(),[]);
  tickets.get('one')!.status='REABERTO';assert.deepEqual(await pending(),[50]);tickets.delete('one');assert.deepEqual(await pending(),[]);
  assert.equal((await call('patch','/suporte/:id/lido',7,'one',{respostaId:50})).status,404);
});
