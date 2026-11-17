import type { PrismaClient } from '@prisma/client';
import type { Server } from 'socket.io';
import { enviarPushParaUsuarios } from '../../services/notificacoes.service';
import { filtroPartidasAtrasadas, horarioPassado } from './horario';

// Derivado da agenda: não muda o status, a escalação ou o resultado do jogo.
export async function processarAtrasos(banco: PrismaClient, io: Server, agora = new Date(), apos = 0, enviarPush = enviarPushParaUsuarios) {
  const candidatas = await banco.partida.findMany({ where:{AND:[filtroPartidasAtrasadas(agora), {id:{gt:apos},fpfsJogo:null}]}, select:{id:true}, orderBy:{id:'asc'}, take:50 });
  for (const item of candidatas) {
    try {
    const avisos = await banco.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Partida" WHERE id = ${item.id} FOR UPDATE`;
      const p = await tx.partida.findUnique({where:{id:item.id},include:{categoria:true,mandante:true,visitante:true,fpfsJogo:true}});
      if (!p || p.fpfsJogo || !['AGENDADA','PREPARADA'].includes(p.status) || !horarioPassado(p.data.toISOString(),p.horario,agora)) return [];
      const clubeId = p.organizador_id ?? p.categoria.clube_id;
      const agenda = `${p.data.toISOString().slice(0,10)}T${p.horario || '23:59'}`;
      if (await tx.auditoriaPartida.findFirst({where:{partida_id:p.id,acao:'ATRASO_NOTIFICADO',dados:{path:['agenda'],equals:agenda}},select:{id:true}})) return [];
      const gestores = await tx.usuarioClube.findMany({where:{clube_id:clubeId,clube:{ativo:true},usuario:{suspenso:false},OR:[{papel:'ADMIN'},{papel:{in:['TECNICO','MESARIO']},OR:[{acesso_todas_categorias:true},{categorias:{some:{categoria_id:p.categoria_id}}}]}]},select:{usuario_id:true}});
      const ids = [...new Set(gestores.map(g=>g.usuario_id))];
      const result = [];
      for (const usuario_id of ids) result.push(await tx.notificacao.create({data:{usuario_id,clube_id:clubeId,partida_id:p.id,tipo:'PARTIDA_AGENDADA',titulo:'Partida atrasada',corpo:`${p.mandante.nome} × ${p.visitante.nome}: o horário previsto passou. Confira se pode iniciar, reagende ou cancele o confronto.`,dados:{acao:'REVISAR_ATRASO',partidaId:p.id,clubeId}}}));
      if (ids.length) await tx.auditoriaPartida.create({data:{partida_id:p.id,usuario_id:ids[0],clube_id:clubeId,acao:'ATRASO_NOTIFICADO',dados:{agenda,destinatarios:ids},criado_em:agora}});
      return result;
    },{timeout:10000});
    for (const n of avisos) {
      io.to(`usuario:${n.usuario_id}`).emit('notificacao_criada',n);
      void enviarPush([n.usuario_id],n.clube_id,'PARTIDA_AGENDADA',n.titulo,n.corpo,{acao:'REVISAR_ATRASO',partidaId:item.id,clubeId:n.clube_id}).catch(()=>console.error('Aviso de atraso salvo; push indisponível.'));
      io.to(`clube:${n.clube_id}`).emit('partida_atualizada',{id:item.id,atrasada:true});
    }
    } catch { console.error(`Não foi possível conferir o atraso da partida ${item.id}.`); }
  }
  return candidatas.length===50 ? candidatas.at(-1)!.id : 0;
}
export function iniciarAvisosAtraso(banco: PrismaClient, io: Server) {
  let executando=false, encerrado=false, cursor=0;
  const executar=async()=>{if(executando || encerrado)return;executando=true;try{cursor=await processarAtrasos(banco,io,new Date(),cursor);}catch{console.error('Não foi possível conferir partidas atrasadas.');}finally{executando=false;}};
  const inicio=setTimeout(()=>void executar(),10000), timer=setInterval(()=>void executar(),60000);
  inicio.unref(); timer.unref();
  return ()=>{encerrado=true;clearTimeout(inicio);clearInterval(timer);};
}
